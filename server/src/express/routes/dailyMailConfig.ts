import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Pro-User Schalter „Morgen-Mail“ (#1426, Default: ein). Muster: `/split-hint-config` (#1994) —
 * derselbe Nutzer-Auflösungs-Weg inkl. Dev-Pass-Through, bewusst ohne Plan-Gate.
 */

type DailyMailConfigDto = { dailyMailEnabled: boolean };

export const dailyMailConfigRouter = Router();

// GET /daily-mail-config — gespeicherter Schalter des Users, sonst Default (ein).
dailyMailConfigRouter.get('/daily-mail-config', async (req: Request, res: Response<DailyMailConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({ dailyMailEnabled: user.dailyMailEnabled ?? true });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /daily-mail-config — Schalter speichern; Nicht-Boolean → 400 ohne Persistenz.
dailyMailConfigRouter.put('/daily-mail-config', async (req: Request, res: Response<DailyMailConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const dailyMailEnabled = (req.body as { dailyMailEnabled?: unknown } | undefined)?.dailyMailEnabled;
		if (typeof dailyMailEnabled !== 'boolean') {
			sendError(res, 400, 'Ungültige Konfiguration: dailyMailEnabled muss Boolean sein.');
			return;
		}
		await User.update({ dailyMailEnabled }, { where: { id: user.id } });
		res.json({ dailyMailEnabled });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
