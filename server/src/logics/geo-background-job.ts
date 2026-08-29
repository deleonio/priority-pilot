import { Op } from 'sequelize';
import { Task, User, NotificationLog } from '../models/index.js';
import { haversineKm } from './geo.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „Aufgaben in der Nähe" (Issue #1101). Der Client meldet im
 * Geo-Intervall (#1098, Default 5 Minuten) seine Position; der Job ermittelt dazu die offenen
 * Aufgaben im Alarmabstand (`User.alarmDistanceKm`, Default 1 km) und verschickt je Nutzer
 * **eine** gebundelte Push-Nachricht (der Service Worker ersetzt über `tag: 'priority-pilot'`
 * ohnehin aufeinanderfolgende Pushes — Einzel-Pushes je Aufgabe sind ausgeschlossen).
 * Wiederholungen werden über {@link NotificationLog} je Aufgabe und Zeitfenster unterdrückt
 * (Muster: `dueTaskReminders.ts`).
 */

const KIND = 'geo-nearby-task';

/** Lauf-/Dedup-Fenster in ms — Default aus den Geo-Settings (`intervalMinutes`, #1098). */
export const GEO_PUSH_INTERVAL_MS = 5 * 60 * 1000;

// F3: In-Memory-Queue pro User zur Serialisierung von parallelen Läufen.
// Mehrere Hook-Instanzen melden gleichzeitig Position → parallele runGeoPushNotifications
// würden ohne Queue doppelt pushen (read-before-write auf NotificationLog).
// Die Queue setzt sich bei jedem Process-Reset zurück (akzeptabel für das Race-Problem).
const runningUserPushes = new Map<number, Promise<void>>();

/** Alarmabstand in km — Default `alarmDistanceKm` aus den Geo-Settings (#1098). */
export const DEFAULT_ALARM_DISTANCE_KM = 1;

/** Eine gemeldete Nutzerposition (`{ userId, lat, lon }`) — Quelle bleibt außerhalb des Jobs. */
interface GeoPosition {
	userId: number;
	lat: number;
	lon: number;
}

/** Offene Aufgabe im Alarmabstand, inkl. gerundeter Distanz (wie `GET /tasks/nearby`). */
interface NearbyGeoTask {
	id: number;
	title: string;
	distanceKm: number;
}

/** Bundle je Nutzer: alle noch nicht gemeldeten nahen Aufgaben. */
interface GeoPushGroup {
	userId: number;
	tasks: NearbyGeoTask[];
}

/** Dedup-Schlüssel je Aufgabe und Intervallfenster (Unique-Index `kind+dedupeKey`). */
const dedupeKeyFor = (taskId: number, now: Date, intervalMs: number): string =>
	`${taskId}:${Math.floor(now.getTime() / intervalMs)}`;

/** Alarmabstand des Nutzers aus den Geo-Settings (#1098), sonst der Default. */
const alarmDistanceFor = async (userId: number): Promise<number> => {
	const user = await User.findByPk(userId);
	return user?.alarmDistanceKm ?? DEFAULT_ALARM_DISTANCE_KM;
};

/** Dedup-Fenster in ms für einen User (aus User.intervalMinutes oder Default). */
const intervalMsFor = async (userId: number): Promise<number> => {
	const user = await User.findByPk(userId);
	return (user?.intervalMinutes ?? 5) * 60 * 1000;
};

/**
 * Ermittelt je gemeldeter Position die offenen Aufgaben (`status != 'Done'`) **mit** Koordinaten
 * im Alarmabstand des Nutzers (Haversine), gruppiert je Nutzer und um bereits gemeldete Aufgaben
 * bereinigt (Dedup-Fenster = User-spezifisches Intervall #1098 F2).
 */
export const collectGeoPushGroups = async (positions: GeoPosition[], now: Date): Promise<GeoPushGroup[]> => {
	const groups = new Map<number, GeoPushGroup>();
	for (const position of positions) {
		const alarmDistanceKm = await alarmDistanceFor(position.userId);
		const intervalMs = await intervalMsFor(position.userId);
		const candidates = await Task.findAll({
			where: {
				userId: position.userId,
				status: { [Op.ne]: 'Done' },
				latitude: { [Op.ne]: null },
				longitude: { [Op.ne]: null },
			},
		});
		const nearby = candidates
			.map((task) => ({
				id: task.id,
				title: task.title,
				distanceKm:
					Math.round(haversineKm(position.lat, position.lon, task.latitude as number, task.longitude as number) * 10) /
					10,
			}))
			.filter((task) => task.distanceKm <= alarmDistanceKm);
		if (nearby.length === 0) {
			continue;
		}

		// Dedup (AK6): Aufgaben, die innerhalb des letzten Intervalls bereits gemeldet wurden,
		// aussortieren — `sentAt` ist die Wahrheit, nicht das Epochen-Fenster des Schlüssels.
		// F3: userId-Filter reduziert N+1 bei wachsender NotificationLog-Tabelle.
		const recent = await NotificationLog.findAll({
			where: {
				kind: KIND,
				userId: position.userId,
				sentAt: { [Op.gte]: new Date(now.getTime() - intervalMs) },
			},
		});
		const recentlySent = new Set(recent.map((row) => Number(row.dedupeKey.split(':')[0])));
		const pending = nearby.filter((task) => !recentlySent.has(task.id));
		if (pending.length === 0) {
			continue;
		}

		const group = groups.get(position.userId) ?? { userId: position.userId, tasks: [] };
		group.tasks.push(...pending);
		groups.set(position.userId, group);
	}
	return [...groups.values()];
};

/** Distanz im `formatKm`-Format der Nearby-Anzeige (`NearbyCard.tsx`): km, de-DE, eine Nachkommastelle. */
const formatKm = (km: number): string =>
	new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(km);

/** Baut die gebundelte Payload für den Service Worker (`push-sw.js` erwartet `title`/`body?`/`url?`). */
const buildPayload = (tasks: NearbyGeoTask[]): { title: string; body: string; url: string } => {
	if (tasks.length === 1) {
		const [task] = tasks;
		return { title: task.title, body: `${formatKm(task.distanceKm)} km`, url: `/tasks/${task.id}` };
	}
	// F4: Bei mehreren Tasks auf die nächstgelegene Aufgabe verlinken (Deep-Link nach AK5).
	const nearest = tasks.reduce((min, task) => (task.distanceKm < min.distanceKm ? task : min));
	const lines = tasks.map((task) => `${task.title} (${formatKm(task.distanceKm)} km)`);
	return { title: `${tasks.length} Aufgaben in der Nähe`, body: lines.join(', '), url: `/tasks/${nearest.id}` };
};

/**
 * Versendet die gebundelten „Aufgaben in der Nähe"-Nachrichten (eine je Nutzer, an alle
 * Subscriptions via {@link sendPushToUser}) und protokolliert je gemeldeter Aufgabe einen
 * {@link NotificationLog}-Eintrag. Idempotent innerhalb des Intervallfensters (AK6).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runGeoPushNotifications = async (
	positions: GeoPosition[],
	send?: PushSender,
	now: Date = new Date(),
): Promise<{ usersNotified: number }> => {
	const groups = await collectGeoPushGroups(positions, now);
	let usersNotified = 0;

	// F3: Serialisierung pro User via In-Memory-Queue.
	// Parallele Aufrufe für denselben User warten auf das bereits laufende Promise.
	const processUserGroup = async (group: GeoPushGroup): Promise<void> => {
		const intervalMs = await intervalMsFor(group.userId);
		const { sent } = await sendPushToUser(group.userId, buildPayload(group.tasks), send);
		if (sent > 0) {
			await NotificationLog.bulkCreate(
				group.tasks.map((task) => ({
					userId: group.userId,
					kind: KIND,
					dedupeKey: dedupeKeyFor(task.id, now, intervalMs),
					sentAt: now,
				})),
				{ ignoreDuplicates: true },
			);
			usersNotified++;
		}
	};

	await Promise.all(
		groups.map(async (group) => {
			const existing = runningUserPushes.get(group.userId);
			if (existing) {
				// Ein paralleler Lauf läuft bereits → warten, nicht doppelt pushen.
				await existing;
				return;
			}
			// Neuer Lauf pro User → Promise speichern, ausführen, danach aufräumen.
			const promise = processUserGroup(group).finally(() => {
				runningUserPushes.delete(group.userId);
			});
			runningUserPushes.set(group.userId, promise);
			await promise;
		}),
	);

	return { usersNotified };
};
