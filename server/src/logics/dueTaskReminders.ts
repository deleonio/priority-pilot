import { Op } from 'sequelize';
import { Task, NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „fällige Aufgaben" (Issue #355). Bündelt je Nutzer **eine** Push-Nachricht
 * für alle fälligen/überfälligen Tasks (Anti-Spam statt einer Notification je Task) und verhindert
 * über {@link NotificationLog}, dass derselbe fällige Termin bei einem wiederholten Scheduler-Lauf
 * erneut gemeldet wird. Verschiebt sich die `deadline` eines Tasks, ändert sich der `dedupeKey` —
 * die Erinnerung wird dann bewusst erneut ausgelöst.
 */

const KIND = 'due-task';
/** Zeitfenster: ein Task gilt ab 24h vor der Deadline als "bald fällig" (zusätzlich zu überfälligen). */
const DUE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface DueTask {
	id: number;
	title: string;
	deadline: Date;
}

interface DueTaskGroup {
	userId: number;
	tasks: DueTask[];
}

const dedupeKeyFor = (taskId: number, deadline: Date): string => `${taskId}:${deadline.toISOString()}`;

/**
 * Ermittelt je Nutzer die noch nicht gemeldeten fälligen/überfälligen Tasks
 * (`deadline <= now + 24h`, `status != 'Done'`), gruppiert und um bereits gemeldete Termine bereinigt.
 */
export const collectDueTaskReminders = async (now: Date): Promise<DueTaskGroup[]> => {
	const threshold = new Date(now.getTime() + DUE_WINDOW_MS);
	const dueTasks = await Task.findAll({
		where: {
			status: { [Op.ne]: 'Done' },
			deadline: { [Op.ne]: null, [Op.lte]: threshold },
			userId: { [Op.ne]: null },
		},
	});
	if (dueTasks.length === 0) {
		return [];
	}

	const dedupeKeys = dueTasks.map((task) => dedupeKeyFor(task.id, task.deadline as Date));
	const alreadySent = await NotificationLog.findAll({
		where: { kind: KIND, dedupeKey: { [Op.in]: dedupeKeys } },
	});
	const sentKeys = new Set(alreadySent.map((row) => row.dedupeKey));

	const groups = new Map<number, DueTaskGroup>();
	for (const task of dueTasks) {
		const deadline = task.deadline as Date;
		if (sentKeys.has(dedupeKeyFor(task.id, deadline))) {
			continue;
		}
		const userId = task.userId as number;
		const group = groups.get(userId) ?? { userId, tasks: [] };
		group.tasks.push({ id: task.id, title: task.title, deadline });
		groups.set(userId, group);
	}
	return [...groups.values()];
};

/** Baut die gebündelte Payload für den Service Worker (`push-sw.js` erwartet `title`/`body?`/`url?`). */
const buildPayload = (tasks: DueTask[]): { title: string; body: string; url: string } => {
	if (tasks.length === 1) {
		return { title: 'Fällige Aufgabe', body: tasks[0].title, url: '/' };
	}
	return { title: 'Fällige Aufgaben', body: `Du hast ${tasks.length} fällige oder überfällige Aufgaben.`, url: '/' };
};

/**
 * Versendet die gebündelten Erinnerungen (eine Push-Nachricht je Nutzer) und protokolliert je
 * gemeldetem Task einen {@link NotificationLog}-Eintrag. Idempotent: ein zweiter Lauf ohne
 * zwischenzeitliche Änderungen sendet nichts erneut.
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runDueTaskReminders = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const groups = await collectDueTaskReminders(now);
	for (const group of groups) {
		await sendPushToUser(group.userId, buildPayload(group.tasks), send);
		await NotificationLog.bulkCreate(
			group.tasks.map((task) => ({
				userId: group.userId,
				kind: KIND,
				dedupeKey: dedupeKeyFor(task.id, task.deadline),
				sentAt: now,
			})),
		);
	}
	return { usersNotified: groups.length };
};
