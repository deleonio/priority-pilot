import { Router } from 'express';
import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { getUserId, isAuthActive } from '../requireAuth.js';
import { runGeoPushNotifications } from '../../logics/geo-background-job.js';

/**
 * Pro-User Geo-Konfiguration (#1098 AK7): Anzeige-Entfernung (Default 5 km),
 * Alarm-Entfernung (Default 1 km) und Positionsermittlungs-Intervall (Default 5 min) —
 * serverseitig persistiert statt localStorage. Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts).
 */

/**
 * Nutzer der Geo-Konfiguration: der Session-Nutzer, sonst im lokalen Pass-Through-Modus ohne
 * Auth-Kontext (Issue #207: „kein Gate, keine Nutzer-Bindung") ein gemeinsamer Entwicklungs-
 * Nutzer — GET/PUT funktionieren dann auch ohne Login (Dev/E2E), analog zum leeren
 * `ownerScope`-Filter der Task-Routen. Mit aktivem Auth-Kontext bleibt es beim 401-Weg.
 * Bewusst ohne `findOrCreate` (verwaltete Transaktion): Der verwirft auf der einzigen
 * SQLite-`:memory:`-Verbindung Transaction-Protokolle („cannot commit — no transaction is
 * active") — `findOne` + `create` reicht, die Unique-E-Mail fängt Nebenläufigkeit ab.
 *
 * Exportiert, weil auch `/tasks/nearby` dieselbe Auflösung braucht (#1103 F5: eine Wahrheit
 * darüber, welcher User die Anzeige-Entfernung liefert — inkl. Dev-Pass-Through).
 */
const DEV_USER_EMAIL = 'dev@local';

export const resolveGeoUser = async (req: Request): Promise<User | null> => {
	const userId = getUserId(req);
	if (userId !== undefined) {
		return User.findByPk(userId);
	}
	if (!isAuthActive()) {
		const existing = await User.findOne({ where: { email: DEV_USER_EMAIL } });
		if (existing) {
			return existing;
		}
		try {
			return await User.create({
				email: DEV_USER_EMAIL,
				passwordHash: 'dev-no-login',
				displayName: 'Entwicklung',
			});
		} catch {
			// Nebenläufig angelegt (Unique-Verstoß) → den inzwischen existierenden Satz lesen.
			return User.findOne({ where: { email: DEV_USER_EMAIL } });
		}
	}
	return null;
};

type GeoConfigDto = { displayDistanceKm: number; alarmDistanceKm: number; intervalMinutes: number };

/**
 * Defaults = heutiges Verhalten vor #1098. Exportiert, damit `/tasks/nearby` denselben Default
 * nutzt statt einer zweiten hartkodierten 5 (#1103 F5).
 */
export const GEO_CONFIG_DEFAULTS: GeoConfigDto = { displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 5 };

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
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({
			displayDistanceKm: user.displayDistanceKm ?? GEO_CONFIG_DEFAULTS.displayDistanceKm,
			alarmDistanceKm: user.alarmDistanceKm ?? GEO_CONFIG_DEFAULTS.alarmDistanceKm,
			intervalMinutes: user.intervalMinutes ?? GEO_CONFIG_DEFAULTS.intervalMinutes,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /geo-config — validierte Konfiguration speichern; bei Verstoß 400 ohne Persistenz.
geoConfigRouter.put('/geo-config', async (req: Request, res: Response<GeoConfigDto | { message: string }>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
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
		await User.update(config, { where: { id: user.id } });
		res.json(config);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/**
 * POST /geo/position — Positionsmeldung des Clients (Issue #1101 AK1): der Client ermittelt im
 * konfigurierten Intervall (`intervalMinutes`, #1098) seine Position und meldet sie hier; der
 * Server prüft daraufhin die Aufgaben im Alarmabstand und stößt ggf. die gebündelte Push-Nachricht
 * an (`logics/geo-background-job.ts`). Fire-and-forget: die Antwort wartet nicht auf den Versand —
 * ein Push-Fehler darf die Positionsbehandlung nicht blockieren.
 */
geoConfigRouter.post('/geo/position', async (req: Request, res: Response<{ message: string }>) => {
	// `Number('')` wäre 0 und damit fälschlich gültig — leere/fehlende/Array-Parameter ablehnen.
	const parseCoord = (value: unknown): number =>
		typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
	const body = (req.body ?? {}) as { lat?: unknown; lon?: unknown };
	const lat = parseCoord(body.lat);
	const lon = parseCoord(body.lon);
	// F1 (#1102-Review): NaN-Vergleche sind immer false — NaN muss explizit abgelehnt werden,
	// sonst läuft `{"lat":"abc"}` ohne 400 in den Push-Job.
	if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
		sendError(res, 400, 'lat und lon müssen Zahlen in gültigem Bereich sein.');
		return;
	}
	const user = await resolveGeoUser(req);
	if (!user) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	runGeoPushNotifications([{ userId: user.id, lat, lon }]).catch((error: unknown) => {
		console.error('Geo-Push nach Positionsmeldung fehlgeschlagen:', error);
	});
	res.status(204).send();
});
