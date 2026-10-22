import { Op } from 'sequelize';
import { Task, User } from '../models/index.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { selectSeriesRepresentatives, filterVorlauf } from './series.js';
import { uhrzeitIn } from './carePush.js';
import { nutzerZeitzone, tagIn } from './streak.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachlicher Push-Trigger „3 wichtigste Aufgaben am Morgen" (Issue #518). Sendet **tagesunabhängig
 * von Deadlines** einmal täglich im Morgenfenster (lokale Stunde 7–8, #2849) je Nutzer **eine**
 * gebündelte Push-Nachricht mit den 3 nach Priorität höchsten aktiven Aufgaben (Anti-Spam statt
 * einer Notification je Task).
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

/** Zustellfenster: lokale Stunde 7–8 des Empfängers (#2849 AK2 — Anfang inklusive, 9 exklusiv). */
const FENSTER_START = 7;
const FENSTER_ENDE = 9;

/** Pro Nutzer und lokalem Kalendertag eindeutig (#2849 AK2) — ein wiederholter Tick am selben Tag ist ein No-op. */
const dedupeKeyFor = (userId: number, date: Date, zeitzone: string): string => `${userId}:${tagIn(date, zeitzone)}`;

/**
 * Ermittelt je Nutzer die {@link TOP_N} nach Priorität höchsten aktiven Tasks (`status != 'Done'`,
 * aufsteigend = wichtiger; P1 am höchsten). Tasks ohne Eigentümer (`userId = null`) werden nicht
 * gruppiert (kein Broadcast an alle Subscriptions).
 */
export const collectDailyTopTasks = async (now: Date): Promise<TopTaskGroup[]> => {
	// #1518: je Serie nur die aktuelle Instanz — sonst belegte eine Serie alle drei Plätze.
	const representatives = selectSeriesRepresentatives(
		await Task.findAll({
			where: {
				status: { [Op.ne]: 'Done' },
				userId: { [Op.ne]: null },
			},
			order: [
				['priority', 'ASC'],
				['id', 'ASC'],
			],
		}),
		now,
	);
	// #1641: Aufgaben mit Datum mehr als VORLAUF_TAGE Kalendertage in der Zukunft zurückhalten.
	const tasks = filterVorlauf(representatives, now);
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
const TITEL: Record<CareSprache, { eine: string; mehrere: string }> = {
	de: { eine: 'Deine wichtigste Aufgabe', mehrere: 'Deine wichtigsten Aufgaben' },
	en: { eine: 'Your most important task', mehrere: 'Your most important tasks' },
};

const buildPayload = (tasks: TopTask[], sprache: CareSprache): { title: string; body: string; url: string } => {
	if (tasks.length === 1) {
		return { title: TITEL[sprache].eine, body: tasks[0].title, url: PUSH_TARGETS.dailyTopTasks.eine(tasks[0].id) };
	}
	return {
		title: TITEL[sprache].mehrere,
		body: tasks.map((task) => task.title).join(', '),
		url: PUSH_TARGETS.dailyTopTasks.mehrere,
	};
};

/**
 * Versendet die gebündelten Top-Aufgaben (eine Push-Nachricht je Nutzer) und protokolliert je
 * zugestelltem Nutzer einen {@link NotificationLog}-Log-Eintrag. Idempotent pro Kalendertag: ein
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
		const recipient = await User.findByPk(group.userId, { attributes: ['sprache', 'zeitzone', 'taskPushEnabled'] });
		// #2850 AK3: Gruppenschalter „Aufgaben und Erinnerungen" aus → kein Versand (Muster carePush).
		if (recipient?.taskPushEnabled === false) {
			continue;
		}
		// #2849 AK2/AK5: Morgenfenster 7–8 in der Nutzer-Zeitzone (ohne gültige Zone: UTC).
		const zeitzone = nutzerZeitzone(recipient?.zeitzone);
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < FENSTER_START || stunde >= FENSTER_ENDE) {
			continue;
		}
		const sprache = spracheVon(recipient?.sprache);
		const { sent } = await sendDedupedPush(
			group.userId,
			KIND,
			dedupeKeyFor(group.userId, now, zeitzone),
			buildPayload(group.tasks, sprache),
			send,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
