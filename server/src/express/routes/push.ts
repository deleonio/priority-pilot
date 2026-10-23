import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { UniqueConstraintError } from 'sequelize';
import { FcmToken, PushSubscription } from '../../models/index.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { getVapidPublicKey, isPushConfigured, sendPushToUser } from '../../logics/push.js';
import type { PushSender } from '../../logics/push.js';
import { pickRandomQuote } from '../../logics/pushTestQuote.js';
import { validateNonEmptyString, validateRequestBody } from '../../logics/requestValidation.js';
import type { ValidationResult } from '../../logics/requestValidation.js';
import { spracheAusHeader } from '../../logics/careSuggestionData.js';
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

/**
 * Validiert den Body von `POST /push/subscribe` rein strukturell: `endpoint` muss ein nicht-leerer
 * String sein und `keys` die beiden nicht-leeren Schlüssel `p256dh`/`auth` enthalten (so liefert es
 * `PushManager.subscribe().toJSON()`). `expirationTime` ist optional (Zahl oder `null`).
 */
const validateSubscription = (body: unknown): ValidationResult<{ ok: true; value: ValidSubscription }> => {
	const bodyResult = validateRequestBody(body);
	if (!bodyResult.ok) {
		return bodyResult;
	}
	const { endpoint, keys, expirationTime } = bodyResult.value;
	const endpointCheck = validateNonEmptyString(endpoint, 'endpoint');
	if (!endpointCheck.ok) {
		return endpointCheck;
	}
	if (typeof keys !== 'object' || keys === null) {
		return { ok: false, message: 'keys muss ein Objekt mit p256dh und auth sein.' };
	}
	const { p256dh, auth } = keys as Record<string, unknown>;
	const p256dhCheck = validateNonEmptyString(p256dh, 'keys.p256dh');
	if (!p256dhCheck.ok) {
		return p256dhCheck;
	}
	const authCheck = validateNonEmptyString(auth, 'keys.auth');
	if (!authCheck.ok) {
		return authCheck;
	}
	if (expirationTime !== undefined && expirationTime !== null && typeof expirationTime !== 'number') {
		return { ok: false, message: 'expirationTime muss eine Zahl oder null sein.' };
	}
	return {
		ok: true,
		value: {
			endpoint: endpointCheck.value,
			p256dh: p256dhCheck.value,
			auth: authCheck.value,
			expirationTime: typeof expirationTime === 'number' ? expirationTime : null,
		},
	};
};

/** `token` aus dem Body von `/push/fcm/*` — `null`, wenn es fehlt, leer oder unplausibel lang ist. */
const fcmTokenOf = (body: unknown): string | null => {
	const { token } = (body ?? {}) as Record<string, unknown>;
	const tokenCheck = validateNonEmptyString(token, 'token');
	return tokenCheck.ok && tokenCheck.value.length <= 4096 ? tokenCheck.value : null;
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
		const endpointCheck = validateNonEmptyString(endpoint, 'endpoint');
		if (!endpointCheck.ok) {
			sendError(res, 400, endpointCheck.message);
			return;
		}
		const { value: endpointValue } = endpointCheck;
		const userId = getUserId(req);

		try {
			// Nur die eigene Subscription entfernen (Datenisolation): endpoint + userId müssen passen.
			await PushSubscription.destroy({
				where: { endpoint: endpointValue, ...(userId !== undefined ? { userId } : {}) },
			});
			res.status(200).json({ endpoint: endpointValue });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	// POST /push/fcm/register — FCM-Token der Android-App für den eingeloggten Nutzer speichern (#1670,
	// ADR 0016). Idempotent; ein Token, das bisher einem anderen Nutzer gehörte, wechselt zum aktuellen
	// (ein Gerät gehört dem zuletzt angemeldeten Konto). Unabhängig von der VAPID-Konfiguration.
	router.post('/push/fcm/register', async (req: Request, res: Response<ErrorDto>) => {
		const token = fcmTokenOf(req.body);
		if (token === null) {
			sendError(res, 400, 'token muss ein nicht-leerer String sein.');
			return;
		}
		const userId = getUserId(req) ?? null;
		const [row, created] = await FcmToken.findOrCreate({ where: { token }, defaults: { token, userId } });
		if (!created && row.userId !== userId) {
			await row.update({ userId });
		}
		res.status(204).end();
	});

	// POST /push/fcm/unregister — FCM-Token des eingeloggten Nutzers entfernen. Idempotent; fremde Tokens
	// bleiben unberührt (Datenisolation).
	router.post('/push/fcm/unregister', async (req: Request, res: Response<ErrorDto>) => {
		const token = fcmTokenOf(req.body);
		if (token === null) {
			sendError(res, 400, 'token muss ein nicht-leerer String sein.');
			return;
		}
		await FcmToken.destroy({ where: { token, ...ownerScope(getUserId(req)) } });
		res.status(204).end();
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
		const { en, ...deutsch } = pickRandomQuote();
		const quote = spracheAusHeader(req.get('accept-language')) === 'en' ? { ...deutsch, text: en } : deutsch;
		const payload = { title: quote.text, body: `— ${quote.author}`, url: '/' };
		// pushSender ist undefined im Produktivbetrieb → sendPushToUser nutzt seinen web-push-Default.
		const { sent } = pushSender
			? await sendPushToUser(userId, payload, pushSender)
			: await sendPushToUser(userId, payload);
		res.json({ sent, quote });
	});

	return router;
};
