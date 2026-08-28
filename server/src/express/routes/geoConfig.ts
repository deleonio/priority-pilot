import { Router } from 'express';
import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';

/**
 * Pro-User Geo-Konfiguration (#1098 AK7): Anzeige-Entfernung (Default 5 km),
 * Alarm-Entfernung (Default 1 km) und Positionsermittlungs-Intervall (Default 5 min) —
 * serverseitig persistiert statt localStorage. Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts).
 */

type GeoConfigDto = { displayDistanceKm: number; alarmDistanceKm: number; intervalMinutes: number };

const DEFAULTS: GeoConfigDto = { displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 5 };

/**
 * Kreuz-Schranken-Validierung (AK2): alarm ∈ [1, display], display ∈ [alarm, 50],
 * interval ∈ [1, 60] — alles ganze Zahlen. Verstöße werden mit 400 abgelehnt,
 * ohne dass etwas persistiert wird.
 */
const validateGeoConfig = (body: unknown): GeoConfigDto | null => {
	if (typeof body !== 'object' || body === null) return null;
	const { displayDistanceKm, alarmDistanceKm, intervalMinutes } = body as Record<string, unknown>;
	if (
		typeof displayDistanceKm !== 'number' ||
		typeof alarmDistanceKm !== 'number' ||
		typeof intervalMinutes !== 'number' ||
		!Number.isInteger(displayDistanceKm) ||
		!Number.isInteger(alarmDistanceKm) ||
		!Number.isInteger(intervalMinutes)
	) {
		return null;
	}
	const config: GeoConfigDto = { displayDistanceKm, alarmDistanceKm, intervalMinutes };
	if (config.alarmDistanceKm < 1 || config.alarmDistanceKm > config.displayDistanceKm) return null;
	if (config.displayDistanceKm < 1 || config.displayDistanceKm > 50) return null;
	if (config.intervalMinutes < 1 || config.intervalMinutes > 60) return null;
	return config;
};

const sendError = (res: Response<{ message: string }>, status: number, message: string): void => {
	res.status(status).json({ message });
};

export const geoConfigRouter = Router();

// GET /geo-config — gespeicherte Konfiguration des Users, sonst die Defaults.
geoConfigRouter.get('/geo-config', async (req: Request, res: Response<GeoConfigDto | { message: string }>) => {
	const userId = getUserId(req);
	if (userId === null) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const user = await User.findByPk(userId);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({
			displayDistanceKm: user.displayDistanceKm ?? DEFAULTS.displayDistanceKm,
			alarmDistanceKm: user.alarmDistanceKm ?? DEFAULTS.alarmDistanceKm,
			intervalMinutes: user.intervalMinutes ?? DEFAULTS.intervalMinutes,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /geo-config — validierte Konfiguration speichern; bei Verstoß 400 ohne Persistenz.
geoConfigRouter.put('/geo-config', async (req: Request, res: Response<GeoConfigDto | { message: string }>) => {
	const userId = getUserId(req);
	if (userId === null) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const config = validateGeoConfig(req.body);
	if (!config) {
		sendError(
			res,
			400,
			'Ungültige Geo-Konfiguration: alarmDistanceKm ∈ [1, displayDistanceKm], displayDistanceKm ∈ [alarmDistanceKm, 50], intervalMinutes ∈ [1, 60] (ganze Zahlen).',
		);
		return;
	}
	try {
		await User.update(config, { where: { id: userId } });
		res.json(config);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
