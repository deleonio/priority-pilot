import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import sequelize from '../../database.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';
import { validateQueryEinzelwert } from '../../logics/requestValidation.js';

/**
 * Nutzersuche für den Einladungsfluss (#1212, AK1/AK2). Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts).
 *
 * Datenschutz-Vertrag: Die E-Mail trifft nur als **vollständige Adresse** (Exact-Match) und
 * verlässt den Server nie — das DTO enthält ausschließlich `id` und `displayName`. Namenssuche
 * erst ab 3 Zeichen; kürzere Anfragen und Nulltreffer sind kein Fehler, sondern 200 mit [].
 */

type UserSearchDto = {
	id: number;
	displayName: string;
};

const MIN_QUERY_LENGTH = 3;
const SEARCH_LIMIT = 10;

export const usersRouter = Router();

// GET /users/search?query= — volle E-Mail ODER displayName-Fragment ab 3 Zeichen.
usersRouter.get('/users/search', async (req: Request, res: Response<UserSearchDto[] | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const queryErgebnis = validateQueryEinzelwert(req.query.query, 'query');
		if (!queryErgebnis.ok) {
			sendError(res, 400, queryErgebnis.message);
			return;
		}
		const raw = queryErgebnis.value !== undefined ? queryErgebnis.value.trim() : '';
		const isFullEmail = raw.includes('@') && raw.length > 0;
		if (!isFullEmail && raw.length < MIN_QUERY_LENGTH) {
			res.json([]);
			return;
		}
		if (isFullEmail) {
			const exact = await User.findAll({ where: { email: raw.toLowerCase() }, limit: SEARCH_LIMIT });
			res.json(exact.map((hit) => ({ id: hit.id, displayName: hit.displayName ?? hit.email })));
			return;
		}
		// `!` als ESCAPE-Zeichen: `%`, `_` und `!` im Suchtext gelten literal (kein Aufzählen per Wildcard).
		const pattern = `%${raw.replace(/[!%_]/g, '!$&')}%`;
		const found = await User.findAll({
			where: sequelize.literal(
				`${sequelize.getQueryInterface().quoteIdentifier('displayName')} LIKE ${sequelize.escape(pattern)} ESCAPE '!'`,
			),
			order: [['displayName', 'ASC']],
			limit: SEARCH_LIMIT,
		});
		res.json(found.map((hit) => ({ id: hit.id, displayName: hit.displayName ?? '' })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
