import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { establishSession } from '../establishSession.js';
import { issueAppToken } from '../apiTokenAuth.js';
import { isDbEmailAllowed, isEmailAllowed } from '../../logics/allowedEmails.js';
import { verifyGoogleIdToken, type GoogleKeysSource } from '../../logics/googleOidc.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import type { components } from '../../api';

type NativeGoogleLoginRequestDto = components['schemas']['NativeGoogleLoginRequest'];
type AppTokenDto = components['schemas']['AppToken'];

/**
 * Native Google-Anmeldung der Android-App (ADR 0023): Die App holt über den Credential Manager ein
 * ID-Token von Google, ohne Browser. Hängt wie `authRouter` unter `/auth/*`, der Auth-Limiter greift.
 * `keys` ist injizierbar (Default: Googles JWKS), Muster `createMagicLinkRouter`.
 */
export const createNativeGoogleRouter = (keys?: GoogleKeysSource) => {
	const router = Router();

	// POST /auth/native/google — ID-Token einlösen; im Kanal `play` mit App-Token statt Session-Cookie.
	router.post('/auth/native/google', async (req: Request, res: Response<AppTokenDto | ErrorDto>) => {
		const { idToken } = (req.body ?? {}) as Partial<NativeGoogleLoginRequestDto>;
		const identity =
			typeof idToken === 'string' && idToken !== '' ? await verifyGoogleIdToken(idToken, keys) : 'invalid';
		if (identity === 'unreachable') {
			sendError(res, 503, 'Google ist gerade nicht erreichbar.');
			return;
		}
		if (identity === 'invalid') {
			sendError(res, 400, 'Die Google-Anmeldung ist ungültig.');
			return;
		}
		if (!(await isDbEmailAllowed(identity.email)) && !isEmailAllowed(identity.email)) {
			sendError(res, 403, 'Für diese Adresse ist die Anmeldung nicht freigegeben.');
			return;
		}
		const user = await upsertOAuthUser({
			email: identity.email,
			displayName: identity.name ?? identity.email,
			avatarUrl: identity.picture ?? null,
		});
		if (req.get('X-Client-Channel') === 'play') {
			res.json({ token: await issueAppToken(user.id) });
			return;
		}
		establishSession(req, user, (sessionErr) => {
			if (sessionErr) {
				sendError(res, 500, 'Session-Fehler.');
				return;
			}
			res.status(204).end();
		});
	});

	return router;
};
