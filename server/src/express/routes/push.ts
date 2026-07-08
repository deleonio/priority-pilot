import { Router } from 'express';
import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { PushSubscription } from '../../models/index.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { getVapidPublicKey, isPushConfigured, sendPushToUser } from '../../logics/push.js';
import type { PushSender } from '../../logics/push.js';
import { pickRandomQuote } from '../../logics/pushTestQuote.js';
import type { components } from '../../api';

type VapidPublicKeyDto = components['schemas']['VapidPublicKey'];
type PushSubscriptionAckDto = components['schemas']['PushSubscriptionAck'];
type TestPushResultDto = components['schemas']['TestPushResult'];
type ErrorDto = components['schemas']['Error'];

/** Ein validierter Subscription-Body (Ausschnitt des Browser-`PushSubscription`-JSON). */
interface ValidSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
	expirationTime: number | null;
}

type ValidationResult = { ok: true; value: ValidSubscription } | { ok: false; message: string };

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/**
 * Validiert den Body von `POST /push/subscribe` rein strukturell: `endpoint` muss ein nicht-leerer
 * String sein und `keys` die beiden nicht-leeren Schlüssel `p256dh`/`auth` enthalten (so liefert es
 * `PushManager.subscribe().toJSON()`). `expirationTime` ist optional (Zahl oder `null`).
 */
const validateSubscription = (body: unknown): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { endpoint, keys, expirationTime } = body as Record<string, unknown>;
	if (typeof endpoint !== 'string' || endpoint.trim() === '') {
		return { ok: false, message: 'endpoint muss ein nicht-leerer String sein.' };
	}
	if (typeof keys !== 'object' || keys === null) {
		return { ok: false, message: 'keys muss ein Objekt mit p256dh und auth sein.' };
	}
	const { p256dh, auth } = keys as Record<string, unknown>;
	if (typeof p256dh !== 'string' || p256dh.trim() === '') {
		return { ok: false, message: 'keys.p256dh muss ein nicht-leerer String sein.' };
	}
	if (typeof auth !== 'string' || auth.trim() === '') {
		return { ok: false, message: 'keys.auth muss ein nicht-leerer String sein.' };
	}
	if (expirationTime !== undefined && expirationTime !== null && typeof expirationTime !== 'number') {
		return { ok: false, message: 'expirationTime muss eine Zahl oder null sein.' };
	}
	return {
		ok: true,
		value: { endpoint, p256dh, auth, expirationTime: typeof expirationTime === 'number' ? expirationTime : null },
	};
};

/**
 * Baut den Web-Push-Router. `pushSender` ist injizierbar (Default: web-push in {@link sendPushToUser}),
 * damit Tests den Netzwerk-Versand ohne echte VAPID-Schlüssel ersetzen können (Vorbild: injizierte
 * Mistral-Clients in `AppDeps`).
 */
export const createPushRouter = (pushSender?: PushSender) => {
	const router = Router();

	// GET /push/vapid-public-key — liefert den öffentlichen VAPID-Schlüssel, den das Frontend für
	// `PushManager.subscribe({ applicationServerKey })` benötigt. 503, wenn Web-Push nicht konfiguriert ist.
	router.get('/push/vapid-public-key', (_req: Request, res: Response<VapidPublicKeyDto | ErrorDto>) => {
		const publicKey = getVapidPublicKey();
		if (!publicKey) {
			sendError(res, 503, 'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).');
			return;
		}
		res.json({ publicKey });
	});

	// POST /push/subscribe — Browser-Subscription unter dem eingeloggten Nutzer speichern. Idempotent:
	// eine bereits bekannte `endpoint`-Zeile dieses Nutzers wird aktualisiert (Schlüssel), statt dupliziert;
	// fremde Endpoints werden nicht übernommen.
	router.post('/push/subscribe', async (req: Request, res: Response<PushSubscriptionAckDto | ErrorDto>) => {
		if (!isPushConfigured()) {
			sendError(res, 503, 'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).');
			return;
		}
		const validation = validateSubscription(req.body);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}
		const { endpoint, p256dh, auth, expirationTime } = validation.value;
		const userId = getUserId(req);

		try {
			const existing = await PushSubscription.findOne({ where: { endpoint, ...ownerScope(userId) } });
			if (existing) {
				await existing.update({ p256dh, auth, expirationTime });
				res.status(201).json({ endpoint });
				return;
			}
			await PushSubscription.create({ endpoint, p256dh, auth, expirationTime, userId });
			res.status(201).json({ endpoint });
		} catch (err) {
			if (err instanceof UniqueConstraintError) {
				// Endpoint already exists under a different user (concurrent subscribe or cross-user race).
				// Return idempotent 201 — the subscription exists in the DB, just under another owner.
				res.status(201).json({ endpoint });
				return;
			}
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	// POST /push/unsubscribe — die Subscription des eingeloggten Nutzers zum `endpoint` löschen.
	// Idempotent: unbekannter Endpoint ⇒ trotzdem 200 (nichts zu tun), damit das Frontend robust bleibt.
	router.post('/push/unsubscribe', async (req: Request, res: Response<PushSubscriptionAckDto | ErrorDto>) => {
		if (!isPushConfigured()) {
			sendError(res, 503, 'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).');
			return;
		}
		const { endpoint } = (req.body ?? {}) as Record<string, unknown>;
		if (typeof endpoint !== 'string' || endpoint.trim() === '') {
			sendError(res, 400, 'endpoint muss ein nicht-leerer String sein.');
			return;
		}
		const userId = getUserId(req);

		try {
			// Nur die eigene Subscription entfernen (Datenisolation): endpoint + userId müssen passen.
			await PushSubscription.destroy({ where: { endpoint, ...(userId !== undefined ? { userId } : {}) } });
			res.status(200).json({ endpoint });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	// POST /push/test — sendet einen Test-Push mit einem zufälligen Zitat an alle Subscriptions des
	// eingeloggten Nutzers (#386). Datenisolation über sendPushToUser/ownerScope. 503, wenn Web-Push
	// nicht konfiguriert ist; ohne Subscription 200 mit sent=0 (kein Fehler).
	router.post('/push/test', async (req: Request, res: Response<TestPushResultDto | ErrorDto>) => {
		if (!isPushConfigured()) {
			sendError(res, 503, 'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).');
			return;
		}
		const userId = getUserId(req);
		const quote = pickRandomQuote();
		const payload = { title: quote.text, body: `— ${quote.author}`, url: '/' };
		// pushSender ist undefined im Produktivbetrieb → sendPushToUser nutzt seinen web-push-Default.
		const { sent } = pushSender
			? await sendPushToUser(userId, payload, pushSender)
			: await sendPushToUser(userId, payload);
		res.json({ sent, quote });
	});

	return router;
};
