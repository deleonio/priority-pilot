import { Op } from 'sequelize';
import { Task, NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „3 wichtigste Aufgaben um 6 Uhr" (Issue #518). Sendet **tagesunabhängig
 * von Deadlines** einmal täglich um 06:00 Uhr je Nutzer **eine** gebündelte Push-Nachricht mit den
 * 3 nach Priorität höchsten aktiven Aufgaben (Anti-Spam statt einer Notification je Task).
 *
 * Abgrenzung zu {@link ./dueTaskReminders.js} (#355): jener Trigger löst auf nahe Deadlines aus
 * (`deadline <= now + 24h`), dieser bewertet rein nach `Task.priority`. Beide Trigger koexistieren
 * (eigener `kind` / eigener `dedupeKey`) und deduzieren nicht gegeneinander.
 */

const KIND = 'daily-top-tasks';
/** Maximale Anzahl Aufgaben je täglicher Push-Nachricht (Issue #518 — „die 3 wichtigsten"). */
const TOP_N = 3;

interface TopTask {
	id: number;
	title: string;
	priority: number;
}

interface TopTaskGroup {
	userId: number;
	tasks: TopTask[];
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Pro Nutzer und Kalendertag eindeutig — ein wiederholter Tick am selben Tag ist ein No-op. */
const dedupeKeyFor = (userId: number, date: Date): string => `${userId}:${dayKey(date)}`;

/**
 * Ermittelt je Nutzer die {@link TOP_N} nach Priorität höchsten aktiven Tasks (`status != 'Done'`,
 * aufsteigend = wichtiger; P1 am höchsten). Tasks ohne Eigentümer (`userId = null`) werden nicht
 * gruppiert (kein Broadcast an alle Subscriptions).
 */
export const collectDailyTopTasks = async (_now: Date): Promise<TopTaskGroup[]> => {
	const tasks = await Task.findAll({
		where: {
			status: { [Op.ne]: 'Done' },
			userId: { [Op.ne]: null },
		},
		order: [
			['priority', 'ASC'],
			['id', 'ASC'],
		],
	});
	if (tasks.length === 0) {
		return [];
	}

	const groups = new Map<number, TopTaskGroup>();
	for (const task of tasks) {
		const userId = task.userId as number;
		const group = groups.get(userId);
		if (group) {
			if (group.tasks.length < TOP_N) {
				group.tasks.push({ id: task.id, title: task.title, priority: task.priority });
			}
		} else {
			groups.set(userId, {
				userId,
				tasks: [{ id: task.id, title: task.title, priority: task.priority }],
			});
		}
	}
	return [...groups.values()];
};

/** Baut die gebündelte Payload für den Service Worker (`push-sw.js` erwartet `title`/`body?`/`url?`). */
const buildPayload = (tasks: TopTask[]): { title: string; body: string; url: string } => {
	if (tasks.length === 1) {
		return { title: 'Deine wichtigste Aufgabe', body: tasks[0].title, url: '/' };
	}
	return { title: 'Deine wichtigsten Aufgaben', body: tasks.map((task) => task.title).join(', '), url: '/' };
};

/**
 * Versendet die gebündelten Top-Aufgaben (eine Push-Nachricht je Nutzer) und protokolliert je
 * zugestelltem Nutzer einen {@link NotificationLog}-Eintrag. Idempotent pro Kalendertag: ein
 * wiederholter Tick am selben Tag sendet nichts erneut; erst am Folgetag wird der tägliche Push
 * wieder ausgelöst. Nutzer ohne Subscription erhalten keinen Versand und kein Log. Bei 0 aktiven
 * Aufgaben greift der Leer-Fall (kein Push, kein Log).
 *
 * @param now  Zeitpunkt des Scheduler-Ticks (UTC); bestimmt den Kalendertag für die Idempotenz.
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runDailyTopTasksPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const groups = await collectDailyTopTasks(now);
	let usersNotified = 0;
	for (const group of groups) {
		const dedupeKey = dedupeKeyFor(group.userId, now);
		const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
		if (alreadySent) {
			continue;
		}
		const { sent } = await sendPushToUser(group.userId, buildPayload(group.tasks), send);
		if (sent > 0) {
			await NotificationLog.create({ userId: group.userId, kind: KIND, dedupeKey, sentAt: now });
			usersNotified++;
		}
	}
	return { usersNotified };
};
