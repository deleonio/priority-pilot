import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Pro-User Schalter „Hinweis zum Aufteilen“ (#1994, Default: ein). Muster: `/care-config` (#1794) —
 * derselbe Nutzer-Auflösungs-Weg inkl. Dev-Pass-Through, bewusst ohne Plan-Gate.
 */

type SplitHintConfigDto = { splitHintEnabled: boolean };

export const splitHintConfigRouter = Router();

// GET /split-hint-config — gespeicherter Schalter des Users, sonst Default (ein).
splitHintConfigRouter.get('/split-hint-config', async (req: Request, res: Response<SplitHintConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({ splitHintEnabled: user.splitHintEnabled ?? true });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /split-hint-config — Schalter speichern; Nicht-Boolean → 400 ohne Persistenz.
splitHintConfigRouter.put('/split-hint-config', async (req: Request, res: Response<SplitHintConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const splitHintEnabled = (req.body as { splitHintEnabled?: unknown } | undefined)?.splitHintEnabled;
		if (typeof splitHintEnabled !== 'boolean') {
			sendError(res, 400, 'Ungültige Konfiguration: splitHintEnabled muss Boolean sein.');
			return;
		}
		await User.update({ splitHintEnabled }, { where: { id: user.id } });
		res.json({ splitHintEnabled });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
