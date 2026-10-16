import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { getUserId, isAuthActive } from '../requireAuth.js';
import { runGeoPushNotifications } from '../../logics/geo-background-job.js';
import { parseCoordinate } from '../../logics/geo.js';
import { requirePlanFeature } from '../planGuard.js';
import { spracheAusHeader, spracheVon, type CareSprache } from '../../logics/careSuggestionData.js';

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

/**
 * App-Sprachauflösung als reiner Helper (#2624): gespeicherte Nutzer-Sprache (`User.sprache`,
 * #2523) gewinnt gegen den `Accept-Language`-Header, ohne Nutzer zählt der Header. Ohne
 * DB-Zugriff — `GET /next` und `loeseSprache` (scores.ts, inkl. `?sprache=`-Override) teilen
 * sich diese eine Kette statt sie zu duplizieren.
 */
export const appSprache = (user: Pick<User, 'sprache'> | null, req: Request): CareSprache =>
	user ? spracheVon(user.sprache) : spracheAusHeader(req.get('accept-language'));

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

export const geoConfigRouter = Router();

// GET /geo-config — gespeicherte Konfiguration des Users, sonst die Defaults.
geoConfigRouter.get('/geo-config', async (req: Request, res: Response<GeoConfigDto | ErrorDto>) => {
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
geoConfigRouter.put(
	'/geo-config',
	requirePlanFeature('location_reminders'),
	async (req: Request, res: Response<GeoConfigDto | ErrorDto>) => {
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
	},
);

/**
 * POST /geo/position — Positionsmeldung des Clients (Issue #1101 AK1): der Client ermittelt im
 * konfigurierten Intervall (`intervalMinutes`, #1098) seine Position und meldet sie hier; der
 * Server prüft daraufhin die Aufgaben im Alarmabstand und stößt ggf. die gebündelte Push-Nachricht
 * an (`logics/geo-background-job.ts`). Fire-and-forget: die Antwort wartet nicht auf den Versand —
 * ein Push-Fehler darf die Positionsbehandlung nicht blockieren.
 */
geoConfigRouter.post(
	'/geo/position',
	requirePlanFeature('location_reminders'),
	async (req: Request, res: Response<ErrorDto>) => {
		const body = (req.body ?? {}) as { lat?: unknown; lon?: unknown };
		// Zentraler Helfer (#2553 AK1) — deckt NaN-/Bereichs-Checks (F1 #1102-Review) und die
		// `Number("") === 0`-Falle ab; numerische Strings sind jetzt ebenfalls gültig.
		const lat = parseCoordinate(body.lat, 90);
		const lon = parseCoordinate(body.lon, 180);
		if (lat === null || lon === null) {
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
	},
);
