import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

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

export const usersRouter = Router();

// GET /users/search?query= — volle E-Mail ODER displayName-Fragment ab 3 Zeichen.
usersRouter.get('/users/search', async (req: Request, res: Response<UserSearchDto[] | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const raw = typeof req.query.query === 'string' ? req.query.query.trim() : '';
		const isFullEmail = raw.includes('@') && raw.length > 0;
		if (!isFullEmail && raw.length < MIN_QUERY_LENGTH) {
			res.json([]);
			return;
		}
		const where = isFullEmail ? { email: raw } : { displayName: { [Op.like]: `%${raw}%` } };
		const found = await User.findAll({ where, order: [['displayName', 'ASC']] });
		res.json(found.map((hit) => ({ id: hit.id, displayName: hit.displayName ?? hit.email })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
