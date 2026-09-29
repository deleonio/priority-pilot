import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../../database.js';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import type { UserRole } from '../../models/user.js';
import { PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { requireRole } from '../requireAuth.js';
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
};

const toDto = (user: User): AdminUserDto => ({
	id: user.id,
	email: user.email,
	displayName: user.displayName,
	role: user.role,
	plan: user.plan,
	createdAt: user.createdAt.toISOString(),
});

const LAST_ADMIN_MESSAGE = 'Es muss mindestens einen Administrator geben — ernenne zuerst eine andere Person.';

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
export const createAdminRouter = (pillarClassifier: PillarClassifier = classifyPillarsWithMistral): Router => {
	const adminRouter = Router();

	// GET /admin/users — alle Nutzer der App (nur Admins). `requireRole` läuft als Route-Middleware
	// (nicht als `router.use(...)`) — ein pfadloses `.use()` auf einem ohne Präfix gemounteten Router
	// (siehe express/index.ts) würde JEDEN nachfolgenden Request abfangen, nicht nur `/admin/*`.
	adminRouter.get(
		'/admin/users',
		requireRole('admin'),
		async (_req: Request, res: Response<AdminUserDto[] | ErrorDto>) => {
			try {
				const users = await User.findAll({ order: [['displayName', 'ASC']] });
				res.json(users.map(toDto));
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

	return adminRouter;
};
