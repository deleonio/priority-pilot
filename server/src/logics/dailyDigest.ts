import { User } from '../models/index.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { collectDailyTopTasks } from './dailyTopTasks.js';
import { sendDedupedPush } from './dedupedPush.js';
import { collectDueTaskReminders } from './dueTaskReminders.js';
import type { PushSender } from './push.js';
import { nutzerZeitzone, tagIn } from './streak.js';

/**
 * Morgen-Push „Dein Tag“ (#2853, Konzept §6): bündelt fällige Aufgaben (#355) und Top-Aufgaben
 * (#518) zu **genau einer** Nachricht je Nutzer und lokalem Tag — die zwei getrennten
 * Morgen-Pushes entfallen. URL-Regeln: genau eine Aufgabe öffnet die Aufgabe, mehrere mit fälliger
 * dabei die Karte „Fällig“, sonst „Top-Aufgaben“. Ein Wiederholungstick am selben lokalen Tag
 * sendet nichts (Dedupe über {@link sendDedupedPush}). Fenster: lokale Stunde 7–9 (#2849).
 */

const KIND = 'daily-digest';
const FENSTER_START = 7;
const FENSTER_ENDE = 9;

interface DigestAufgabe {
	id: number;
	title: string;
}

const TITEL: Record<CareSprache, string> = { de: 'Dein Tag', en: 'Your Day' };

/** URL-Regeln (Konzept §6): eine Aufgabe → Task, mehrere mit fälliger → „Fällig“, sonst „Top-Aufgaben“. */
const buildPayload = (aufgaben: DigestAufgabe[], hatFaellige: boolean, sprache: CareSprache) => ({
	title: TITEL[sprache],
	body: aufgaben.map((aufgabe) => aufgabe.title).join(', '),
	url: aufgaben.length === 1 ? `/tasks/${aufgaben[0].id}` : hatFaellige ? '/#karte-deadlines' : '/#karte-top-aufgaben',
});

/**
 * Versendet die Morgen-Bündelung (eine Push-Nachricht je Nutzer im Morgenfenster). Idempotent pro
 * Kalendertag; zählt als fachlicher Push ins Budget ({@link ./pushBudget.js}).
 *
 * @param now  Zeitpunkt des Scheduler-Ticks (UTC); bestimmt Fenster und lokalen Tag.
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runDailyDigest = async (now: Date = new Date(), send?: PushSender): Promise<{ usersNotified: number }> => {
	const [faellige, top] = await Promise.all([collectDueTaskReminders(now), collectDailyTopTasks(now)]);
	// Je Nutzer vereinen — dieselbe Aufgabe kann fällig UND Top-Aufgabe sein (Union je Task-Id).
	const gruppen = new Map<number, { aufgaben: Map<number, string>; hatFaellige: boolean }>();
	const fuegeHinzu = (userId: number, tasks: DigestAufgabe[], faellig: boolean): void => {
		const gruppe = gruppen.get(userId) ?? { aufgaben: new Map<number, string>(), hatFaellige: false };
		for (const task of tasks) {
			if (!gruppe.aufgaben.has(task.id)) {
				gruppe.aufgaben.set(task.id, task.title);
			}
		}
		gruppe.hatFaellige ||= faellig;
		gruppen.set(userId, gruppe);
	};
	for (const gruppe of faellige) {
		fuegeHinzu(gruppe.userId, gruppe.tasks, true);
	}
	for (const gruppe of top) {
		fuegeHinzu(gruppe.userId, gruppe.tasks, false);
	}

	let usersNotified = 0;
	for (const [userId, gruppe] of gruppen) {
		const recipient = await User.findByPk(userId, { attributes: ['sprache', 'zeitzone'] });
		// #2849 AK2/AK5: Morgenfenster 7–9 in der Nutzer-Zeitzone (ohne gültige Zone: UTC).
		const zeitzone = nutzerZeitzone(recipient?.zeitzone);
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < FENSTER_START || stunde >= FENSTER_ENDE) {
			continue;
		}
		const aufgaben = [...gruppe.aufgaben].map(([id, title]) => ({ id, title }));
		const { sent } = await sendDedupedPush(
			userId,
			KIND,
			`${userId}:${tagIn(now, zeitzone)}`,
			buildPayload(aufgaben, gruppe.hatFaellige, spracheVon(recipient?.sprache)),
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
