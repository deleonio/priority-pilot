import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Op } from 'sequelize';
import { Subscription, User } from '../../models/index.js';
import CancellationToken from '../../models/cancellationToken.js';
import { sendError, type ErrorDto } from '../http-error.js';
import { THROTTLED_MESSAGE } from './rateLimit.js';
import { recordCancellation } from './billingSubscriptions.js';
import { createPaypalProvider, type PaypalProviderDeps } from '../../logics/billing/paypalProvider.js';
import { sendCancellationConfirmation } from '../../logics/cancellationMail.js';
import { displayLabel } from '../../logics/invoices.js';
import { isMailConfigured, sendMailToUser, type MailSender } from '../../logics/mail.js';
import { publicBaseUrl } from '../../logics/magicLink.js';
import type { Plan } from '../../logics/plans.js';
import { EMAIL_RE } from '../../logics/waitlist.js';

/**
 * Kündigung ohne Login über die Website (#2317, § 312k BGB; Vertrag `docs/spec/issue-2317.md`).
 * Die Anfrage antwortet immer gleich (keine Konto-Erkennung von außen); nur zu einem laufenden
 * PayPal-Abo geht ein Einmal-Link an die Konto-Adresse. Erst das POST der Bestätigung kündigt —
 * ein GET auf den Link (Mail-Scanner, Prefetch) liest nur.
 *
 * Bewusst VOR der CSRF-Prüfung gemountet: es gibt keine Session, der Einmal-Token ist der Nachweis.
 * Die Limiter laufen anders als `authLimiter` auch außerhalb der Produktion (AK6 ist testbar, die
 * App-E2E-Suite ruft diese Endpunkte nicht).
 */

export interface PublicCancellationDeps {
	paypalClient?: PaypalProviderDeps['client'];
	mailSender?: MailSender;
}

const HOUR_MS = 60 * 60 * 1000;
const TOKEN_TTL_MS = 24 * HOUR_MS;
// Kündbar ist nur ein laufendes Abo — Muster `wasRunning` im CANCELLED-Webhook (`paypal.ts`).
const RUNNING_STATUSES = ['active', 'past_due', 'suspended'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const normalizedEmail = (body: unknown): string =>
	typeof (body as { email?: unknown } | undefined)?.email === 'string'
		? (body as { email: string }).email.trim().toLowerCase()
		: '';

const limiter = (max: number, keyGenerator: (req: Request) => string) =>
	rateLimit({
		windowMs: HOUR_MS,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		message: THROTTLED_MESSAGE,
		keyGenerator,
	});

const effectiveLabel = (effective: string | null | undefined): string =>
	effective
		? `zum ${new Date(`${effective}T00:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC' })}`
		: 'zum nächstmöglichen Zeitpunkt';

const findValidToken = (token: unknown) =>
	typeof token === 'string' && token !== ''
		? CancellationToken.findOne({
				where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
			})
		: Promise.resolve(null);

export const createPublicCancellationRouter = (deps: PublicCancellationDeps = {}): Router => {
	const router = Router();
	const { checkout } = createPaypalProvider({ client: deps.paypalClient });

	// POST /public/cancellation/request — immer 202 `{}` (AK3); je IP und je Adresse begrenzt (AK6).
	router.post(
		'/public/cancellation/request',
		limiter(20, (req) => ipKeyGenerator(req.ip as string)),
		limiter(3, (req) => `email:${normalizedEmail(req.body)}`),
		async (req: Request, res: Response<Record<string, never> | ErrorDto>) => {
			const body = req.body as { kind?: unknown; reason?: unknown; effective?: unknown } | undefined;
			const email = normalizedEmail(req.body);
			const kind = body?.kind;
			const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
			const effective = typeof body?.effective === 'string' && DATE_RE.test(body.effective) ? body.effective : null;
			if (!EMAIL_RE.test(email) || (kind !== 'ordinary' && kind !== 'extraordinary')) {
				sendError(res, 400, 'Bitte E-Mail-Adresse und Art der Kündigung angeben.');
				return;
			}
			if (kind === 'extraordinary' && reason === '') {
				sendError(res, 400, 'Bitte einen Grund angeben.');
				return;
			}
			const user = await User.findOne({ where: { email } });
			const subscription = user
				? await Subscription.findOne({ where: { userId: user.id, provider: 'paypal', status: RUNNING_STATUSES } })
				: null;
			if (user && subscription && (deps.mailSender || isMailConfigured())) {
				const token = randomBytes(32).toString('base64url');
				await CancellationToken.create({
					email: user.email,
					tokenHash: hashToken(token),
					expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
					subscriptionId: subscription.id,
					kind,
					reason: kind === 'extraordinary' ? reason : null,
					effective,
				});
				// Nicht abwarten: die Antwortzeit verrät sonst, ob ein Abo besteht.
				void sendMailToUser(
					{ email: user.email },
					{
						subject: 'Balamentum: Kündigung bestätigen',
						text: [
							'Hallo,',
							'',
							'wir haben eine Kündigung deines Abos ohne Anmeldung erhalten. Bitte bestätige sie über diesen Link (24 Stunden gültig):',
							'',
							`${publicBaseUrl() ?? ''}/kuendigen/bestaetigen/?token=${token}`,
							'',
							`Vertrag: ${displayLabel(subscription.plan as Plan, subscription.period)}`,
							`Art der Kündigung: ${kind === 'extraordinary' ? 'außerordentlich' : 'ordentlich'}`,
							`Zeitpunkt: ${effectiveLabel(effective)}`,
							'',
							'Wenn du diese Kündigung nicht angefordert hast, ignoriere diese Mail — dein Abo läuft dann unverändert weiter.',
						].join('\n'),
					},
					deps.mailSender,
				);
			}
			res.status(202).json({});
		},
	);

	// GET /public/cancellation/confirm?token= — reine Anzeige für die Bestätigungsseite (AK5): kündigt und verbraucht nichts.
	router.get(
		'/public/cancellation/confirm',
		async (req: Request, res: Response<{ contract: string; kind: string; effective: string } | ErrorDto>) => {
			const row = await findValidToken(req.query.token);
			const subscription = row ? await Subscription.findByPk(row.subscriptionId) : null;
			if (!row || !subscription) {
				sendError(res, 400, 'Link ungültig oder abgelaufen.');
				return;
			}
			res.status(200).json({
				contract: displayLabel(subscription.plan as Plan, subscription.period),
				kind: row.kind === 'extraordinary' ? 'außerordentlich' : 'ordentlich',
				effective: effectiveLabel(row.effective),
			});
		},
	);

	// POST /public/cancellation/confirm — löst die Kündigung bei PayPal aus (AK4, AK5), Ergebnis wie `POST /billing/subscriptions/cancel`.
	router.post('/public/cancellation/confirm', async (req: Request, res: Response<Record<string, never> | ErrorDto>) => {
		const row = await findValidToken((req.body as { token?: unknown } | undefined)?.token);
		const subscription = row ? await Subscription.findByPk(row.subscriptionId) : null;
		if (!row || !subscription || !RUNNING_STATUSES.includes(subscription.status)) {
			sendError(res, 400, 'Link ungültig oder abgelaufen.');
			return;
		}
		// Atomarer Verbrauch (Muster `consumeLoginToken`): zwei parallele Bestätigungen kündigen nie doppelt.
		const [affected] = await CancellationToken.update({ usedAt: new Date() }, { where: { id: row.id, usedAt: null } });
		if (affected !== 1) {
			sendError(res, 400, 'Link ungültig oder abgelaufen.');
			return;
		}
		try {
			await checkout.cancel(subscription.externalSubscriptionId);
		} catch {
			// Kündigung nicht erfolgt — der Link bleibt für einen neuen Versuch gültig.
			await CancellationToken.update({ usedAt: null }, { where: { id: row.id } });
			sendError(res, 502, 'PayPal war nicht erreichbar.');
			return;
		}
		await recordCancellation(
			subscription,
			{ kind: row.kind, reason: row.reason ?? '', email: row.email },
			deps.mailSender,
		);
		await sendCancellationConfirmation(subscription, new Date(), deps.mailSender);
		res.status(200).json({});
	});

	return router;
};
