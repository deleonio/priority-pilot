import { Op } from 'sequelize';
import { Task } from '../models/index.js';
import { selectSeriesRepresentatives, filterVorlauf } from './series.js';

/**
 * Sammler „3 wichtigste Aufgaben am Morgen" (Issue #518) für den Morgen-Digest „Dein Tag" (#2853):
 * bewertet **tagesunabhängig von Deadlines** rein nach `Task.priority` und liefert je Nutzer die
 * {@link TOP_N} höchsten aktiven Aufgaben. Der Versand läuft über {@link ./dailyDigest.js} — der
 * frühere Eigentrigger `runDailyTopTasksPush` ist mit der Bündelung entfallen.
 *
 * Abgrenzung zu {@link ./dueTaskReminders.js} (#355): jener Sammler löst auf nahe Deadlines aus
 * (`deadline <= now + 24h`), dieser bewertet rein nach `Task.priority`.
 */

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
