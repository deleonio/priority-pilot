import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import Subscription from '../../models/subscription.js';
import WebhookEvent from '../../models/webhookEvent.js';
import {
	applyPlanChange,
	verifyWebhookSignature,
	type PaypalVerifier,
	type PaypalWebhookEvent,
} from '../../logics/paypal.js';
import { sendError } from '../http-error.js';

/**
 * Zahlungsanbieter-Schnittstelle (Issue #1495, T6b): Webhook-Eingang und Rückkehr-URL.
 *
 * Der Router wird in `express/index.ts` bewusst VOR `express.json()`, der CSRF-Prüfung und
 * `requireAuth` gemountet (Muster `inviteLinksPublicRouter`/`plansPublicRouter`): PayPal ruft ohne
 * Session und ohne CSRF-Token auf, und die Signaturprüfung braucht den **unveränderten Rohbody**.
 * `express.raw()` hängt deshalb nur an dieser einen Route — global gemountet verlören alle anderen
 * Routen ihren geparsten JSON-Body.
 *
 * Der Nutzerbezug entsteht ausschließlich über `resource.id` → `Subscription.externalSubscriptionId`;
 * `req.session.user` ist hier immer leer.
 */

export interface BillingDeps {
	/** Signaturprüfung — Tests injizieren einen Fake, Produktion nutzt den PayPal-Aufruf. */
	paypalVerifier?: PaypalVerifier;
}

const PROVIDER = 'paypal';

/** Header-Kopie mit kleingeschriebenen Namen (Express liefert sie bereits so, der Typ nicht). */
const headersOf = (req: Request): Record<string, string> =>
	Object.fromEntries(
		Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : (value ?? '')]),
	);

export const createBillingRouter = (deps: BillingDeps = {}): Router => {
	const router = Router();
	const verify: PaypalVerifier =
		deps.paypalVerifier ?? ((rawBody, headers) => verifyWebhookSignature(rawBody, headers));

	router.post('/webhooks/paypal', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
		const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
		const verification = await verify(rawBody, headersOf(req));

		if (verification === 'invalid') {
			// Ungültige Signatur: nichts persistieren, nichts wirksam werden lassen (AK1/AK2).
			sendError(res, 400, 'Signatur des Webhook-Ereignisses ist ungültig.');
			return;
		}

		let event: PaypalWebhookEvent;
		try {
			event = JSON.parse(rawBody.toString('utf8')) as PaypalWebhookEvent;
		} catch {
			sendError(res, 400, 'Webhook-Ereignis ist kein gültiges JSON.');
			return;
		}

		const externalEventId = event.id ?? '';
		const eventType = event.event_type ?? '';

		if (verification === 'unreachable') {
			// PayPal war nicht erreichbar: Ereignis nur unverifiziert ablegen (nicht wirksam, aber auch
			// nicht verloren) und mit 503 antworten, damit PayPal die Zustellung wiederholt (AK2).
			await WebhookEvent.create({
				provider: PROVIDER,
				externalEventId,
				eventType,
				rawPayload: rawBody.toString('utf8'),
				verified: false,
				receivedAt: new Date(),
			}).catch((error: unknown) => {
				if (!(error instanceof UniqueConstraintError)) throw error;
			});
			sendError(res, 503, 'Signatur konnte nicht geprüft werden.');
			return;
		}

		// Dedup (AK3): der Unique-Index (provider, externalEventId) entscheidet, wer verarbeiten darf —
		// ein zweiter Zustellversuch scheitert hier und wird ohne Wirkung mit 200 quittiert.
		let stored;
		try {
			stored = await WebhookEvent.create({
				provider: PROVIDER,
				externalEventId,
				eventType,
				rawPayload: rawBody.toString('utf8'),
				verified: true,
				receivedAt: new Date(),
			});
		} catch (error) {
			if (!(error instanceof UniqueConstraintError)) throw error;
			// Die Zeile existiert schon — zwei Fälle, die der Unique-Index nicht unterscheidet:
			// (a) echtes Duplikat einer bereits verarbeiteten Zustellung → ohne Wirkung mit 200 quittieren;
			// (b) Wiederholung nach einem `unreachable`-Eingang (Zeile liegt unverifiziert und
			//     unverarbeitet vor) → die Verifikation jetzt nachholen, statt das Ereignis dauerhaft
			//     unverifiziert liegen zu lassen (ADR 0013: die Verifikation muss wiederholbar sein).
			const existing = await WebhookEvent.findOne({ where: { provider: PROVIDER, externalEventId } });
			if (!existing || existing.get('verified') === true || existing.get('processedAt')) {
				res.status(200).json({ status: 'duplicate' });
				return;
			}
			await existing.update({ eventType, rawPayload: rawBody.toString('utf8'), verified: true });
			stored = existing;
		}

		const subscription = await Subscription.findOne({
			where: { provider: PROVIDER, externalSubscriptionId: event.resource?.id ?? '' },
		});
		if (subscription) {
			await applyPlanChange(subscription, event, new Date());
		}
		await stored.update({ processedAt: new Date() });

		res.status(200).json({ status: 'processed' });
	});

	// GET /billing/return — Rückkehr aus dem PayPal-Bezahlvorgang. Bewusst OHNE Zustandsänderung
	// (AK5): wirksam wird ein Abo allein über das verifizierte Webhook-Ereignis; die Rückkehr-URL ist
	// nur ein Navigationsziel und wäre sonst ein ungeprüfter Hebel auf den Plan.
	router.get('/billing/return', (_req: Request, res: Response) => {
		res.status(200).json({ status: 'pending' });
	});

	return router;
};
