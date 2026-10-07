import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import type { createCsrfUtilities } from '../csrf.js';

/**
 * Inhaltliche Präferenzen am Konto (#2398): KI-, Balance-Priorität-, Expertenmodus- und
 * Geo-Schalter gelten auf jedem angemeldeten Gerät. Muster `/balance-variant` (#2009) — der GET
 * stellt den CSRF-Token als Antwort-Header bereit, der Client sendet den PUT als einzelnen
 * Fire-and-forget-Aufruf.
 *
 * Bewusst OHNE Dev-Pass-Through-Nutzer (anders als `resolveGeoUser`): ohne Session gibt es kein
 * Konto, die Werte bleiben gerätelokal. Ein geteilter Dev-Nutzer würde den Gerätespiegel jedes
 * sessionlosen Aufrufs mit fremden Schalterständen überschreiben.
 */

type AccountPreferencesDto = {
	aiEnabled: boolean;
	balancePriority: boolean;
	expertMode: boolean;
	geolocationEnabled: boolean;
};

type Field = keyof AccountPreferencesDto;

/** Bisherige Frontend-Defaults — gelten, solange am Konto nichts gespeichert ist. */
const DEFAULTS: AccountPreferencesDto = {
	aiEnabled: true,
	balancePriority: true,
	expertMode: false,
	geolocationEnabled: false,
};

const FIELDS = Object.keys(DEFAULTS) as Field[];

const toDto = (user: User): AccountPreferencesDto => ({
	aiEnabled: user.aiEnabled ?? DEFAULTS.aiEnabled,
	balancePriority: user.balancePriority ?? DEFAULTS.balancePriority,
	expertMode: user.expertMode ?? DEFAULTS.expertMode,
	geolocationEnabled: user.geolocationEnabled ?? DEFAULTS.geolocationEnabled,
});

const findUser = async (req: Request): Promise<User | null> => {
	const userId = getUserId(req);
	return userId === undefined ? null : User.findByPk(userId);
};

type CsrfDeps = Pick<ReturnType<typeof createCsrfUtilities>, 'generateCsrfToken'>;

export const createAccountPreferencesRouter = (csrf: CsrfDeps): Router => {
	const accountPreferencesRouter = Router();

	// GET /account-preferences — gespeicherte Präferenzen, fehlende mit Default.
	accountPreferencesRouter.get(
		'/account-preferences',
		async (req: Request, res: Response<AccountPreferencesDto | ErrorDto>) => {
			try {
				const user = await findUser(req);
				if (!user) {
					sendError(res, 401, 'Anmeldung erforderlich.');
					return;
				}
				res.set('x-csrf-token', csrf.generateCsrfToken(req, res));
				res.json(toDto(user));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	// PUT /account-preferences — Teilmenge speichern; Nicht-boolean oder kein Feld → 400 ohne Persistenz.
	accountPreferencesRouter.put(
		'/account-preferences',
		async (req: Request, res: Response<AccountPreferencesDto | ErrorDto>) => {
			try {
				const user = await findUser(req);
				if (!user) {
					sendError(res, 401, 'Anmeldung erforderlich.');
					return;
				}
				const body = (req.body ?? {}) as Partial<Record<Field, unknown>>;
				const sent = FIELDS.filter((field) => field in body);
				if (sent.length === 0 || sent.some((field) => typeof body[field] !== 'boolean')) {
					sendError(res, 400, `Ungültige Präferenzen: erlaubt sind ${FIELDS.join(', ')} als boolean.`);
					return;
				}
				await user.update(Object.fromEntries(sent.map((field) => [field, body[field]])));
				res.json(toDto(user));
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	return accountPreferencesRouter;
};
