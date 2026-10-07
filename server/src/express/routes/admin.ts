import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../../database.js';
import { parseId, sendError, type ErrorDto } from '../http-error.js';
import Invoice from '../../models/invoice.js';
import { AiUsage, AllowedEmail, Subscription, User } from '../../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES } from '../../models/subscription.js';
import type { UserRole } from '../../models/user.js';
import { PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { requireRole } from '../requireAuth.js';
import { serializeInvoice, type InvoiceDto } from './billingSubscriptions.js';
import { currentYearMonth } from '../aiQuotaMeter.js';
import { validateProviderQuery } from '../llmProviderQuery.js';
import { classifyPillarsWithMistral, type PillarClassifier } from '../../llm/llm.js';
import type { components } from '../../api';
import {
	parseStatusFilter,
	reassignStatusForAllUsers,
	reassignTaskPillarsForAllUsers,
} from '../../logics/reassignTaskPillars.js';
import { acquireGlobalRun, releaseGlobalRun } from '../../logics/reassignLock.js';
import { BACKGROUND_PORTION_SIZE, readBackgroundRun, startBackgroundRun } from '../../logics/reassignBackgroundRun.js';
import { ladeCareWirkung, type CareWirkung } from '../../logics/careWirkung.js';
import { ladeKpis, type KpiAuswertung } from '../../logics/kpiKennzahlen.js';
import { activateTopWaitlist, activateWaitlistEntry, listWaitlistRanked } from '../../logics/waitlist.js';
import { deleteAccount } from '../../logics/deleteAccount.js';
import { syncUserPlan } from '../../logics/billing/lifecycle.js';
import { createPaypalProvider, type PaypalProviderDeps } from '../../logics/billing/paypalProvider.js';
import { PaypalHttpError } from '../../logics/paypal.js';
import type { MailSender } from '../../logics/mail.js';

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member/tester) plus Batch-Endpunkt zur
 * Neuberechnung der Säulenverteilung aller Aufgaben. Der Router hängt hinter dem globalen
 * `requireAuth` — Nutzerliste und Rollenvergabe bleiben `requireRole('admin')`-gated
 * (Tester, #1566), nur der Paket-PATCH ist für Tester auf die eigene Id geöffnet.
 */

type ReassignRunStartedDto = components['schemas']['ReassignRunStarted'];
type ReassignPillarsStatusDto = components['schemas']['OwnReassignPillarsStatus'];

type AdminUserDto = {
	id: number;
	email: string;
	displayName: string;
	role: UserRole;
	plan: Plan;
	createdAt: string;
	/** KI-Anfragen im laufenden Monat (#1783 AK7) — nur in der Nutzerliste. */
	aiRequestsThisMonth?: number;
	/** Abo-Status je Nutzer (#1959) — `null` ohne Abo, `locked` = Admin-Sperre. */
	subscriptionStatus?: string | null;
};

/** Abo-Eintrag der Nutzerverwaltung (#2295) — Grundlage der Lösch-Aktionen je Abo. */
type AdminSubscriptionDto = components['schemas']['AdminSubscription'];

const toSubscriptionDto = (sub: Subscription): AdminSubscriptionDto => ({
	id: sub.get('id') as number,
	provider: sub.get('provider') as AdminSubscriptionDto['provider'],
	plan: sub.get('plan') as Plan,
	status: sub.status,
	currentPeriodEnd: (sub.get('currentPeriodEnd') as Date | null)?.toISOString() ?? null,
	createdAt: (sub.get('createdAt') as Date).toISOString(),
});

/** Zugelassene Adresse mit Herkunft (#1983, AK6) — auch ohne bestehendes Konto. */
type AllowedEmailDto = components['schemas']['AllowedEmail'];

const toDto = (user: User): AdminUserDto => ({
	id: user.id,
	email: user.email,
	displayName: user.displayName,
	role: user.role,
	plan: user.plan,
	createdAt: user.createdAt.toISOString(),
});

const LAST_ADMIN_MESSAGE = 'Es muss mindestens einen Administrator geben — ernenne zuerst eine andere Person.';

/** List-DTO der Warteliste (#1982): Position 1-basiert, referralCount = geworbene Anmeldungen. */
type AdminWaitlistEntryDto = {
	id: number;
	email: string;
	status: 'waiting' | 'activated';
	position: number;
	referralCount: number;
	accessMailStatus: 'sent' | 'failed' | null;
	createdAt: string;
};

/**
 * Stuft `id` auf eine Nicht-Admin-Rolle (`member`/`tester`) zurück — aber nur, wenn danach noch
 * mindestens ein Admin übrig bleibt.
 * Die Prüfung steckt als Subquery in EINEM bedingten UPDATE statt in „erst zählen, dann
 * schreiben": Zwei parallele Rückstufungen der beiden letzten Admins könnten sonst beide den
 * Count `2` sehen und die App ohne Administrator zurücklassen (TOCTOU). Ein einzelnes UPDATE ist
 * in SQLite atomar; auf eine Transaktion wird bewusst verzichtet (Tests laufen mit `:memory:` und
 * einer einzigen Verbindung, parallele `BEGIN`s würden dort kollidieren). Bereits zurückgestufte
 * Konten (`role <> 'admin'`) bleiben idempotent erreichbar (kein falsches 409).
 * @returns `false`, wenn `id` der letzte verbleibende Admin ist und nichts geändert wurde.
 */
const demoteUnlessLastAdmin = async (id: number, targetRole: Exclude<UserRole, 'admin'>): Promise<boolean> => {
	// Tabellen-/Spaltenname und Quoting kommen aus Modell und Dialekt (kein hart kodiertes
	// Backtick-SQL) — ein Dialekt- oder Tabellenwechsel bricht die Subquery dann nicht still.
	const qi = sequelize.getQueryInterface();
	const tableName = User.getTableName();
	const usersTable = qi.quoteIdentifier(typeof tableName === 'string' ? tableName : tableName.tableName);
	const roleColumn = qi.quoteIdentifier('role');
	const adminCount = sequelize.literal(`(SELECT COUNT(*) FROM ${usersTable} WHERE ${roleColumn} = 'admin')`);
	const [affected] = await User.update(
		{ role: targetRole },
		{
			where: {
				id,
				[Op.or]: [{ role: { [Op.ne]: 'admin' } }, sequelize.where(adminCount, Op.gt, 1)],
			},
		},
	);
	return affected > 0;
};

/**
 * Erstellt den Admin-Router. Der Säulen-Klassifikator des Backfill-Endpunkts ist injizierbar
 * (Default: realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen — Muster
 * `createSuggestPillarsRouter`.
 */
export const createAdminRouter = (
	pillarClassifier: PillarClassifier = classifyPillarsWithMistral,
	deps: { paypalClient?: PaypalProviderDeps['client']; mailSender?: MailSender } = {},
): Router => {
	const adminRouter = Router();
	// Admin-Storno (#1959) nutzt denselben injizierbaren PayPal-Client wie die Selbstkündigung
	// (Muster `createBillingSubscriptionsRouter`).
	const { checkout } = createPaypalProvider({ client: deps.paypalClient });

	// GET /admin/users — alle Nutzer der App (nur Admins). `requireRole` läuft als Route-Middleware
	// (nicht als `router.use(...)`) — ein pfadloses `.use()` auf einem ohne Präfix gemounteten Router
	// (siehe express/index.ts) würde JEDEN nachfolgenden Request abfangen, nicht nur `/admin/*`.
	adminRouter.get(
		'/admin/users',
		requireRole('admin'),
		async (_req: Request, res: Response<AdminUserDto[] | ErrorDto>) => {
			try {
				const users = await User.findAll({ order: [['displayName', 'ASC']] });
				const usage = await AiUsage.findAll({ where: { yearMonth: currentYearMonth() } });
				const countByUser = new Map(usage.map((row) => [row.userId, row.count]));
				// #1959: Abo-Status je Nutzer (null ohne Abo) — Grundlage der Zeilen-Aktionen.
				// Abo-Historie legt je Abschluss eine neue Zeile an: jüngste Zeile gewinnt (first-wins
				// nach `id DESC`), sonst entscheidet die DB-Zeilenfolge über den angezeigten Status.
				const subs = await Subscription.findAll({ order: [['id', 'DESC']] });
				const statusByUser = new Map<number, string>();
				for (const sub of subs) {
					const userId = sub.get('userId') as number;
					if (!statusByUser.has(userId)) statusByUser.set(userId, sub.get('status') as string);
				}
				res.json(
					users.map((user) => ({
						...toDto(user),
						aiRequestsThisMonth: countByUser.get(user.id) ?? 0,
						subscriptionStatus: statusByUser.get(user.id) ?? null,
					})),
				);
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/allowed-emails — zugelassene Adressen mit Herkunft (#1983, AK6). Auch Adressen
	// ohne Konto erscheinen hier (Einladung/Delegation pflegt die Zulassung, das Konto entsteht
	// beim ersten Login); die Nutzerliste oben bleibt davon unberührt.
	adminRouter.get(
		'/admin/allowed-emails',
		requireRole('admin'),
		async (_req: Request, res: Response<AllowedEmailDto[] | ErrorDto>) => {
			try {
				const entries = await AllowedEmail.findAll({ order: [['createdAt', 'ASC']] });
				res.json(
					entries.map((entry) => ({
						email: entry.email,
						origin: entry.origin,
						createdAt: entry.createdAt.toISOString(),
					})),
				);
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// PATCH /admin/users/:id/role — Rolle eines Nutzers ändern (nur Admins). Der letzte verbleibende
	// Admin darf nicht zurückgestuft werden (409), damit die App nie ohne Administrator dasteht.
	adminRouter.patch(
		'/admin/users/:id/role',
		requireRole('admin'),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			try {
				const id = Number(req.params.id);
				if (!Number.isInteger(id) || id <= 0) {
					sendError(res, 400, 'Ungültige Nutzer-Id.');
					return;
				}
				const body = (req.body ?? {}) as { role?: unknown };
				if (body.role !== 'admin' && body.role !== 'member' && body.role !== 'tester') {
					sendError(res, 400, 'Die Rolle muss "admin", "member" oder "tester" sein.');
					return;
				}
				const target = await User.findByPk(id);
				if (!target) {
					sendError(res, 404, 'Nutzer nicht gefunden.');
					return;
				}
				if (body.role !== 'admin') {
					// Jede Rückstufung eines Admins (auf member ODER tester) hängt am Letzter-Admin-Guard —
					// auch via tester darf die App nie ohne Administrator dastehen (#1566 AK1).
					if (!(await demoteUnlessLastAdmin(target.id, body.role))) {
						sendError(res, 409, LAST_ADMIN_MESSAGE);
						return;
					}
					await target.reload();
				} else {
					await target.update({ role: body.role });
				}
				res.json(toDto(target));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// PATCH /admin/users/:id/plan — Paket eines Nutzers setzen (Admins; Tester nur die eigene Id,
	// #1566 AK3/AK4). Bis zur Selbstbedienung (T7) ist das der einzige Weg, ein Paket zu vergeben;
	// deshalb bewusst manuell und ohne Zahlungsbezug. Muster wie oben bei der Rolle — nur ohne
	// Letzter-Admin-Schutz. Das eigene-Id-Limit für Tester erzwingt der Server (403), das
	// Frontend-Gating allein reichte nicht.
	adminRouter.patch(
		'/admin/users/:id/plan',
		requireRole(['admin', 'tester']),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			try {
				const id = Number(req.params.id);
				if (!Number.isInteger(id) || id <= 0) {
					sendError(res, 400, 'Ungültige Nutzer-Id.');
					return;
				}
				const requesterId = req.session?.user?.id;
				const requester = typeof requesterId === 'number' ? await User.findByPk(requesterId) : undefined;
				if (requester?.role === 'tester' && requester.id !== id) {
					sendError(res, 403, 'Tester dürfen nur das eigene Paket setzen.');
					return;
				}
				const body = (req.body ?? {}) as { plan?: unknown };
				if (!PLAN_VALUES.includes(body.plan as Plan)) {
					sendError(res, 400, `Das Paket muss eines von ${PLAN_VALUES.join(', ')} sein.`);
					return;
				}
				const target = await User.findByPk(id);
				if (!target) {
					sendError(res, 404, 'Nutzer nicht gefunden.');
					return;
				}
				await target.update({ plan: body.plan as Plan });
				res.json(toDto(target));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// POST /admin/users/:id/subscription/lock — sperrt das Abo eines Nutzers (#1959, AK1): der
	// Zugriff auf das bezahlte Paket stoppt sofort, weil ALLE Guards `User.plan` lesen — daher der
	// Abgleich über `syncUserPlan`. Danach wird das PayPal-Abo gekündigt (#2242), damit nicht weiter
	// abgebucht wird; scheitert das, bleibt die lokale Sperre und ein erneutes Sperren wiederholt die
	// Kündigung. Die Sperre blockiert keinen neuen Abschluss (`locked` ist kein offenes Abo — „bezahlt = Zugang"), eine
	// Entsperrung ist nicht vorgesehen.
	adminRouter.post(
		'/admin/users/:id/subscription/lock',
		requireRole('admin'),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			try {
				const id = Number(req.params.id);
				if (!Number.isInteger(id) || id <= 0) {
					sendError(res, 400, 'Ungültige Nutzer-Id.');
					return;
				}
				const target = await User.findByPk(id);
				if (!target) {
					sendError(res, 404, 'Nutzer nicht gefunden.');
					return;
				}
				// Abo-Historie legt je Abschluss eine neue Zeile an — Zeile deterministisch wählen:
				// offenes Abo vor alten Zeilen (Bestandsmuster `ACTIVE_FIRST`), bei Gleichstand die
				// jüngste; ohne Statusfilter, damit Re-Lock idempotent 200 bleibt.
				const subscription = await Subscription.findOne({
					where: { userId: id },
					order: [
						['status', 'ASC'],
						['id', 'DESC'],
					],
				});
				if (!subscription) {
					sendError(res, 404, 'Kein Abo gefunden.');
					return;
				}
				await subscription.update({ status: 'locked' });
				await syncUserPlan(subscription, 'free');
				await target.reload();
				if (subscription.get('provider') !== 'google') {
					try {
						await checkout.cancel(subscription.get('externalSubscriptionId') as string);
					} catch (error) {
						// 404/422: bereits gekündigt (Muster #2276) — alles andere heißt: PayPal bucht evtl. weiter.
						if (!(error instanceof PaypalHttpError && (error.status === 404 || error.status === 422))) {
							sendError(res, 502, 'PayPal war nicht erreichbar.');
							return;
						}
					}
				}
				res.json({ ...toDto(target), subscriptionStatus: 'locked' });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/users/:id/invoices — Rechnungen eines Nutzers (#1958 AK1, nur Admins). Spiegel
	// der Eigentümer-Route GET /billing/invoices — dieselben Felder via `serializeInvoice`, dieselbe
	// Ordnung (neueste zuerst), damit beide Ansichten identisch sind.
	adminRouter.get(
		'/admin/users/:id/invoices',
		requireRole('admin'),
		async (req: Request, res: Response<InvoiceDto[] | ErrorDto>) => {
			const id = parseId(req.params.id);
			if (id === null) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			try {
				const invoices = await Invoice.findAll({ where: { userId: id }, order: [['periodStart', 'DESC']] });
				res.json(invoices.map(serializeInvoice));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// POST /admin/users/:id/subscription/cancel — Admin-Storno (#1959, AK2): löst die Kündigung
	// beim Zahlungsdienstleister aus (Muster Selbstkündigung, #2048); wirksam wird sie
	// ausschließlich über das Webhook-Ereignis (ADR 0013) — das Paket läuft bis zum Periodenende
	// weiter. Google-Play-Abos sind serverseitig nicht kündbar (409, ADR 0017); sie lassen sich
	// aber sperren.
	adminRouter.post(
		'/admin/users/:id/subscription/cancel',
		requireRole('admin'),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			try {
				const id = Number(req.params.id);
				if (!Number.isInteger(id) || id <= 0) {
					sendError(res, 400, 'Ungültige Nutzer-Id.');
					return;
				}
				const target = await User.findByPk(id);
				if (!target) {
					sendError(res, 404, 'Nutzer nicht gefunden.');
					return;
				}
				const subscription = await Subscription.findOne({
					where: { userId: id, status: OPEN_SUBSCRIPTION_STATUSES },
				});
				if (!subscription) {
					// Gekündigt mit laufendem Zeitraum ist kein fehlendes Abo — 409 statt 404 (#2048).
					const cancelled = await Subscription.findOne({
						where: { userId: id, status: 'cancelled', currentPeriodEnd: { [Op.gt]: new Date() } },
					});
					if (cancelled) {
						sendError(res, 409, 'Das Abo ist bereits gekündigt.');
						return;
					}
					sendError(res, 404, 'Kein Abo gefunden.');
					return;
				}
				if (subscription.get('provider') === 'google') {
					sendError(
						res,
						409,
						'Google-Play-Abos können serverseitig nicht gekündigt werden — das Abo lässt sich aber sperren.',
					);
					return;
				}
				try {
					await checkout.cancel(subscription.get('externalSubscriptionId') as string);
					res.json({ ...toDto(target), subscriptionStatus: subscription.get('status') as string });
				} catch (error) {
					// 4xx heißt: PayPal lehnt ab — verständlicher 409 statt 502 (Muster Selbstkündigung).
					if (error instanceof PaypalHttpError && error.status < 500) {
						sendError(res, 409, 'Das Abo ist bereits gekündigt.');
						return;
					}
					sendError(res, 502, 'PayPal war nicht erreichbar.');
				}
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/users/:id/subscriptions — Abos eines Nutzers (#2295, nur Admins), neueste zuerst;
	// Grundlage der Lösch-Aktionen je Abo in der Nutzerverwaltung.
	adminRouter.get(
		'/admin/users/:id/subscriptions',
		requireRole('admin'),
		async (req: Request, res: Response<AdminSubscriptionDto[] | ErrorDto>) => {
			const id = parseId(req.params.id);
			if (id === null) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			try {
				const subscriptions = await Subscription.findAll({ where: { userId: id }, order: [['id', 'DESC']] });
				res.json(subscriptions.map(toSubscriptionDto));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	/**
	 * Löscht Abos samt Rechnungen restlos (#2295) — nur vor dem Go-live vertretbar, im Livebetrieb
	 * bräuchte es eine Storno-Gutschrift. Erst kündigt PayPal jedes Abo (404/422 = bereits gekündigt,
	 * jeder andere Fehler bricht ab, BEVOR etwas gelöscht ist), dann entfernt EINE Transaktion Abos,
	 * ihre Rechnungen und die darauf verweisenden Gutschriften und berechnet `users.plan` neu.
	 */
	const deleteSubscriptions = async (
		res: Response<AdminUserDto | ErrorDto>,
		target: User,
		subscriptions: Subscription[],
	): Promise<void> => {
		if (
			subscriptions.some((sub) => sub.get('provider') === 'google' && OPEN_SUBSCRIPTION_STATUSES.includes(sub.status))
		) {
			sendError(
				res,
				409,
				'Google-Play-Abos können serverseitig nicht gekündigt werden — das Abo lässt sich aber sperren.',
			);
			return;
		}
		for (const sub of subscriptions) {
			if (sub.get('provider') === 'google') continue;
			try {
				await checkout.cancel(sub.get('externalSubscriptionId') as string);
			} catch (error) {
				if (!(error instanceof PaypalHttpError && (error.status === 404 || error.status === 422))) {
					sendError(res, 502, 'PayPal hat die Kündigung abgelehnt oder war nicht erreichbar — nichts wurde gelöscht.');
					return;
				}
			}
		}
		const subscriptionIds = subscriptions.map((sub) => sub.get('id') as number);
		await sequelize.transaction(async (transaction) => {
			const invoiceIds = (
				await Invoice.findAll({ where: { subscriptionId: subscriptionIds }, attributes: ['id'], transaction })
			).map((invoice) => invoice.get('id') as number);
			await Invoice.destroy({ where: { creditForInvoiceId: invoiceIds }, transaction });
			await Invoice.destroy({ where: { id: invoiceIds }, transaction });
			await Subscription.destroy({ where: { id: subscriptionIds }, transaction });
			// Paket des jüngsten noch laufenden Abos (offen oder gekündigt mit Restlaufzeit), sonst free.
			const running = await Subscription.findOne({
				where: {
					userId: target.id,
					[Op.or]: [
						{ status: OPEN_SUBSCRIPTION_STATUSES.filter((status) => status !== 'approval_pending') },
						{ status: 'cancelled', currentPeriodEnd: { [Op.gt]: new Date() } },
					],
				},
				order: [['id', 'DESC']],
				transaction,
			});
			await target.update({ plan: (running?.get('plan') as Plan | undefined) ?? 'free' }, { transaction });
		});
		res.json(toDto(target));
	};

	// DELETE /admin/users/:id/subscriptions/:subscriptionId — ein Abo restlos löschen (#2295 AK1/AK2).
	adminRouter.delete(
		'/admin/users/:id/subscriptions/:subscriptionId',
		requireRole('admin'),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			const id = parseId(req.params.id);
			const subscriptionId = parseId(req.params.subscriptionId);
			if (id === null || subscriptionId === null) {
				sendError(res, 400, 'Ungültige Id.');
				return;
			}
			try {
				const target = await User.findByPk(id);
				// Fremde Abo-Id = unbekannt (404), damit fremde Daten unberührt bleiben (AK5).
				const subscription = target && (await Subscription.findOne({ where: { id: subscriptionId, userId: id } }));
				if (!target || !subscription) {
					sendError(res, 404, target ? 'Abo nicht gefunden.' : 'Nutzer nicht gefunden.');
					return;
				}
				await deleteSubscriptions(res, target, [subscription]);
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// DELETE /admin/users/:id/subscriptions — alle Abos eines Nutzers restlos löschen (#2295 AK3).
	adminRouter.delete(
		'/admin/users/:id/subscriptions',
		requireRole('admin'),
		async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
			const id = parseId(req.params.id);
			if (id === null) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			try {
				const target = await User.findByPk(id);
				if (!target) {
					sendError(res, 404, 'Nutzer nicht gefunden.');
					return;
				}
				await deleteSubscriptions(res, target, await Subscription.findAll({ where: { userId: id } }));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// DELETE /admin/users/:id — fremdes Konto auf Wunsch des Nutzers löschen (#2327). Dieselbe Funktion
	// und Regeln wie die Selbstlöschung (`DELETE /auth/me`); die Session des Admins bleibt bestehen.
	adminRouter.delete('/admin/users/:id', requireRole('admin'), async (req: Request, res: Response<ErrorDto>) => {
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 400, 'Ungültige Nutzer-Id.');
			return;
		}
		if (id === req.session?.user?.id) {
			sendError(res, 400, 'Das eigene Konto löschst du in den Einstellungen.');
			return;
		}
		try {
			const result = await deleteAccount(id, { paypalClient: deps.paypalClient });
			if (result === 'not_found') {
				sendError(res, 404, 'Nutzer nicht gefunden.');
			} else if (result === 'paypal_unavailable') {
				res.status(502).json({ message: 'PayPal war nicht erreichbar.', code: result });
			} else if (result === 'subscription_active') {
				res.status(409).json({ message: 'Das Konto hat ein laufendes Abo.', code: result });
			} else if (result === 'last_group_admin') {
				res
					.status(409)
					.json({ message: 'Das Konto ist letzter Admin einer Gruppe mit weiteren Mitgliedern.', code: result });
			} else {
				res.status(204).end();
			}
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	// GET /admin/users/:id/invoices/:invoiceId/pdf — gespeichertes Rechnungs-PDF eines Nutzers
	// (#1958 AK2, nur Admins), byte-identisch zum Eigentümer-Download. Die Rechnung muss zum
	// Nutzer auf der Route gehören; ohne pdfBytes oder bei fremder Id 404 — wie die Eigentümer-Route
	// wird eine fremde Rechnung weder inhaltlich noch über den Status verraten.
	adminRouter.get(
		'/admin/users/:id/invoices/:invoiceId/pdf',
		requireRole('admin'),
		async (req: Request, res: Response<Buffer | ErrorDto>) => {
			const id = parseId(req.params.id);
			if (id === null) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			const invoiceId = parseId(req.params.invoiceId);
			if (invoiceId === null) {
				sendError(res, 404, 'Rechnung nicht gefunden.');
				return;
			}
			try {
				const invoice = await Invoice.findOne({ where: { id: invoiceId, userId: id } });
				const pdfBytes = invoice?.get('pdfBytes') as Buffer | null | undefined;
				if (!invoice || !pdfBytes) {
					sendError(res, 404, 'Rechnung nicht gefunden.');
					return;
				}
				res
					.status(200)
					.set('Content-Type', 'application/pdf')
					.set('Content-Disposition', `attachment; filename="${invoice.get('number') as string}.pdf"`)
					.send(pdfBytes);
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// POST /admin/tasks/reassign-pillars — Batch: Säulenverteilung ALLER Aufgaben (aller Konten,
	// inklusive erledigter) anhand des Aufgabenkontexts (Titel/Beschreibung) per KI-Klassifikator
	// neu berechnen und speichern. Status/Punkte/Streak bleiben unberührt (kein Reopen im
	// Status-Sinn), siehe logics/reassignTaskPillars.ts. Admin-Trigger: nach einer Änderung am
	// Säulensystem (umbenannt, neu angelegt) einmal manuell auslösen — bewusst KEIN Cron, damit
	// niemand unbemerkt laufend Kontingente verbrennt.
	adminRouter.post(
		'/admin/tasks/reassign-pillars',
		requireRole('admin'),
		async (req: Request, res: Response<ReassignRunStartedDto | ErrorDto>) => {
			// Provider-Query-Parameter validieren (#749) — gleiche Pinning-Regel wie suggest-pillars.
			const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
			if (!providerValidation.ok) {
				sendError(res, 400, providerValidation.message);
				return;
			}
			const rawLimit = (req.query as Record<string, unknown>).limit;
			let limit = BACKGROUND_PORTION_SIZE;
			if (rawLimit !== undefined) {
				const parsed = Number(rawLimit);
				if (!Number.isInteger(parsed) || parsed < 1) {
					sendError(res, 400, 'limit muss eine ganze Zahl >= 1 sein.');
					return;
				}
				limit = parsed;
			}
			// offset (Finding #5): setzt einen portionierten Lauf bei den Aufgaben fort, die vorherige
			// Aufrufe bereits verarbeitet (oder übersprungen) haben — ohne ihn träfe jeder Aufruf wieder
			// dieselbe erste `limit`-Portion, `remaining` bliebe konstant.
			const rawOffset = (req.query as Record<string, unknown>).offset;
			let offset = 0;
			if (rawOffset !== undefined) {
				const parsed = Number(rawOffset);
				if (!Number.isInteger(parsed) || parsed < 0) {
					sendError(res, 400, 'offset muss eine ganze Zahl >= 0 sein.');
					return;
				}
				offset = parsed;
			}
			// Statusauswahl (#1614): begrenzt den Lauf auf offene bzw. erledigte Aufgaben.
			const status = parseStatusFilter((req.query as Record<string, unknown>).status);
			if (status === null) {
				sendError(res, 400, 'status muss all, open oder done sein.');
				return;
			}
			// restart (#1614): `true` beginnt den Lauf für alle Konten neu; sonst setzt er fort.
			const rawRestart = (req.query as Record<string, unknown>).restart;
			if (rawRestart !== undefined && rawRestart !== 'true' && rawRestart !== 'false') {
				sendError(res, 400, 'restart muss true oder false sein.');
				return;
			}
			if (!acquireGlobalRun()) {
				sendError(res, 409, 'Es läuft bereits ein Batch-Lauf — erst dessen Ende abwarten.');
				return;
			}
			// Hintergrundlauf (#1642): sofort antworten, der Server holt die Portionen selbst ab.
			// `restart` gilt nur für die erste Portion — danach setzt der Lauf fort.
			let first = true;
			startBackgroundRun(
				'global',
				async (failedOffset) => {
					const restart = first && rawRestart === 'true';
					first = false;
					return reassignTaskPillarsForAllUsers({
						classifier: pillarClassifier,
						provider: providerValidation.provider,
						limit,
						offset: offset + failedOffset,
						status,
						restart,
					});
				},
				releaseGlobalRun,
			);
			res.status(202).json({ running: true, processed: 0 });
		},
	);

	// GET /admin/tasks/reassign-pillars/status — Stand des Batches (#1614): wie viele Aufgaben
	// seit dem jeweiligen Kontostart noch nicht erfolgreich neu berechnet wurden. Kein KI-Aufruf.
	adminRouter.get(
		'/admin/tasks/reassign-pillars/status',
		requireRole('admin'),
		async (req: Request, res: Response<ReassignPillarsStatusDto | ErrorDto>) => {
			const status = parseStatusFilter((req.query as Record<string, unknown>).status);
			if (status === null) {
				sendError(res, 400, 'status muss all, open oder done sein.');
				return;
			}
			try {
				// Lauf-Stand VOR dem Zählen festhalten: endete der Lauf währenddessen, meldete die
				// Antwort sonst `running: false` mit einem Zählstand aus der Laufzeit (#1642).
				const run = { ...readBackgroundRun('global') };
				const result = await reassignStatusForAllUsers(status);
				res.json({
					...result,
					startedAt: result.startedAt?.toISOString() ?? null,
					running: run.running ?? false,
					processed: run.processed ?? 0,
					...(run.result === undefined ? {} : { result: run.result }),
				});
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/care-wirkung — Wirkung der Fürsorge-Vorschläge und -Pushes (#1798): Wochenquoten
	// und 4-/12-Wochen-Bindung je Push-Gruppe, nur Summen (`logics/careWirkung.ts`).
	adminRouter.get(
		'/admin/care-wirkung',
		requireRole('admin'),
		async (_req: Request, res: Response<CareWirkung | ErrorDto>) => {
			try {
				res.json(await ladeCareWirkung());
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/kpis — Markteinführungs-Kennzahlen (#1989): Aktivierung, Day-7-Rückkehr, Share-Rate
	// und Einladungen je Registrierungsperiode als Quoten (`logics/kpiKennzahlen.ts`).
	adminRouter.get(
		'/admin/kpis',
		requireRole('admin'),
		async (req: Request, res: Response<KpiAuswertung | ErrorDto>) => {
			const zeitraum = (req.query as Record<string, unknown>).zeitraum;
			if (zeitraum !== 'woche' && zeitraum !== 'monat') {
				sendError(res, 400, 'zeitraum muss woche oder monat sein.');
				return;
			}
			try {
				res.json(await ladeKpis(zeitraum));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// GET /admin/waitlist — Warteliste im Referral-Rang (#1982, ADR 0019): die Freischalt-Reihenfolge
	// (Eingeladene zuerst, dann Warteliste nach Rang) wird von `logics/waitlist.ts` vorgeberechnet.
	adminRouter.get(
		'/admin/waitlist',
		requireRole('admin'),
		async (_req: Request, res: Response<AdminWaitlistEntryDto[] | ErrorDto>) => {
			try {
				res.json(await listWaitlistRanked());
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// POST /admin/waitlist/:id/activate — schaltet einen einzelnen Eintrag frei (idempotent);
	// danach nimmt der bestehende Login-Flow die Adresse an (`isDbEmailAllowed`/`AllowedEmail`,
	// #1982 AK3). Verschickt die Freischalt-Mail mit Login-Link (#2305).
	adminRouter.post(
		'/admin/waitlist/:id/activate',
		requireRole('admin'),
		async (req: Request, res: Response<{ status: 'activated'; accessMailStatus: 'sent' | 'failed' } | ErrorDto>) => {
			const id = Number(req.params.id);
			if (!Number.isInteger(id) || id <= 0) {
				sendError(res, 400, 'Ungültige Eintrags-Id.');
				return;
			}
			try {
				const result = await activateWaitlistEntry(id, deps.mailSender);
				if (result === null) {
					sendError(res, 404, 'Wartelisten-Eintrag nicht gefunden.');
					return;
				}
				res.json(result);
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// POST /admin/waitlist/activate-top — schaltet die Top-N-Einträge nach Position auf einmal frei
	// („Welle“); bereits freigeschaltete zählen nicht doppelt (#1982 AK4).
	adminRouter.post(
		'/admin/waitlist/activate-top',
		requireRole('admin'),
		async (req: Request, res: Response<{ activatedCount: number } | ErrorDto>) => {
			const { count } = (req.body ?? {}) as { count?: unknown };
			if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) {
				sendError(res, 400, 'count muss eine ganze Zahl >= 1 sein.');
				return;
			}
			try {
				res.json({ activatedCount: await activateTopWaitlist(count, deps.mailSender) });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	return adminRouter;
};
