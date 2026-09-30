import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { istGueltigeZeitzone } from '../../logics/streak.js';
import { resolveGeoUser } from './geoConfig.js';
import { protokolliereCarePushWechsel } from '../../logics/careWirkung.js';
import { CARE_SPRACHEN } from '../../logics/careSuggestionData.js';

/**
 * Pro-User Care-Konfiguration (#1794 AK7/AK8): der Schalter „Fürsorge-Hinweise“ (Default: ein —
 * der Schalter schaltet den Fürsorge-Push ab) und die Nutzer-Zeitzone (IANA, Default: UTC) für
 * Ruhezeit und Kalendertag-Dedup des Triggers (`logics/carePush.ts`). Muster: `/geo-config`
 * (#1098) — derselbe Nutzer-Auflösungs-Weg inkl. Dev-Pass-Through, bewusst ohne Plan-Gate.
 */

type CareConfigDto = { carePushEnabled: boolean; zeitzone: string };

/** Defaults = Verhalten ohne gespeicherte Werte. */
const CARE_CONFIG_DEFAULTS: CareConfigDto = { carePushEnabled: true, zeitzone: 'UTC' };

/** Schalter muss Boolean sein, Zeitzone ein gültiger IANA-Name — Verstöße werden nicht persistiert. */
const validateCareConfig = (body: unknown): CareConfigDto | null => {
	if (typeof body !== 'object' || body === null) return null;
	const { carePushEnabled, zeitzone } = body as Record<string, unknown>;
	if (typeof carePushEnabled !== 'boolean') return null;
	if (typeof zeitzone !== 'string' || !istGueltigeZeitzone(zeitzone)) return null;
	return { carePushEnabled, zeitzone };
};

export const careConfigRouter = Router();

// GET /care-config — gespeicherte Care-Konfiguration des Users, sonst die Defaults.
careConfigRouter.get('/care-config', async (req: Request, res: Response<CareConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({
			carePushEnabled: user.carePushEnabled ?? CARE_CONFIG_DEFAULTS.carePushEnabled,
			zeitzone: user.zeitzone ?? CARE_CONFIG_DEFAULTS.zeitzone,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /care-config — validierte Konfiguration speichern; bei Verstoß 400 ohne Persistenz.
careConfigRouter.put('/care-config', async (req: Request, res: Response<CareConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const config = validateCareConfig(req.body);
		if (!config) {
			sendError(
				res,
				400,
				'Ungültige Care-Konfiguration: carePushEnabled muss Boolean sein, zeitzone ein gültiger IANA-Name.',
			);
			return;
		}
		await User.update(config, { where: { id: user.id } });
		// #1798 AK5: Schalterverlauf für die Wirkungs-Auswertung.
		await protokolliereCarePushWechsel(
			user.id,
			user.carePushEnabled ?? CARE_CONFIG_DEFAULTS.carePushEnabled,
			config.carePushEnabled,
		);
		res.json(config);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /care-config/sprache — App-Sprache für den Fürsorge-Push (#1879); Code außerhalb von
// `CARE_SPRACHEN` → 400 ohne Persistenz. Eigene Route, weil `PUT /care-config` den vollen Satz verlangt.
careConfigRouter.put('/care-config/sprache', async (req: Request, res: Response<{ sprache: string } | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const sprache = (req.body as { sprache?: unknown } | undefined)?.sprache;
		const code = CARE_SPRACHEN.find((value) => value === sprache);
		if (!code) {
			sendError(res, 400, `Ungültige Sprache: erlaubt sind ${CARE_SPRACHEN.join(', ')}.`);
			return;
		}
		await User.update({ sprache: code }, { where: { id: user.id } });
		res.json({ sprache: code });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
