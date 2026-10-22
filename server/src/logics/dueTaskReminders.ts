import { Op } from 'sequelize';
import { Task, NotificationLog } from '../models/index.js';
import { selectSeriesRepresentatives } from './series.js';

/**
 * Sammler „fällige Aufgaben" (Issue #355) für den Morgen-Digest „Dein Tag" (#2853): ermittelt je
 * Nutzer die noch nicht gemeldeten fälligen/überfälligen Tasks (`deadline <= now + 24h`,
 * `status != 'Done'`, Anti-Spam statt einer Meldung je Task). Der Versand läuft über
 * {@link ./dailyDigest.js} (Push und Morgen-Mail #1426) — der frühere Eigentrigger
 * `runDueTaskReminders` ist mit der Bündelung entfallen. Verschiebt sich die `deadline` eines
 * Tasks, ändert sich der `dedupeKey` — die Erinnerung wird dann bewusst erneut ausgelöst
 * (frühestens am Folgetag, #2849 AK2).
 */

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
	// #1518 AK7: je Serie nur die aktuelle Instanz — vor dem Dedup, damit das NotificationLog
	// weiterhin genau die gemeldete Instanz kennt.
	const dueTasks = selectSeriesRepresentatives(
		await Task.findAll({
			where: {
				status: { [Op.ne]: 'Done' },
				deadline: { [Op.ne]: null, [Op.lte]: threshold },
				userId: { [Op.ne]: null },
			},
		}),
		now,
	);
	if (dueTasks.length === 0) {
		return [];
	}

	const dedupeKeys = dueTasks.map((task) => dedupeKeyFor(task.id, task.deadline as Date));
	const alreadySent = await NotificationLog.findAll({
		where: { kind: 'due-task', dedupeKey: { [Op.in]: dedupeKeys } },
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
