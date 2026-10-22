import { User } from '../models/index.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { istRuhezeit } from './carePush.js';
import { nutzerZeitzone } from './streak.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachlicher Push-Trigger „Aufgabe von jemand anderem angelegt" (#1224): legt ein Gruppenmitglied A
 * eine Aufgabe für B an, erhält B genau eine Push-Nachricht mit Aufgabentitel und Anzeigenamen von A.
 * Wie `dailyTopTasks` verhindert der Auslöser über {@link sendDedupedPush} (eigene `kind`,
 * `dedupeKey` = Task-Id), dass dieselbe Aufgabe erneut meldet — pro Aufgabe höchstens eine Nachricht.
 * Selbst-Anlagen lösen nichts aus (entscheidet der Aufrufer, indem er keinen Empfänger übergibt).
 * Ruhezeit 21–7 Ortszeit des Empfängers: kein Versand, kein Log (#2849 AK4).
 */

const KIND = 'task-created';

const TEXTE: Record<
	CareSprache,
	{ jemand: string; titel: (name: string) => string; text: (aufgabe: string) => string }
> = {
	de: {
		jemand: 'Jemand',
		titel: (name) => `Neue Aufgabe von ${name}`,
		text: (aufgabe) => `„${aufgabe}“ wurde für dich angelegt.`,
	},
	en: {
		jemand: 'Someone',
		titel: (name) => `New task from ${name}`,
		text: (aufgabe) => `"${aufgabe}" was created for you.`,
	},
};

/** Der angelegte Task (Ausschnitt), wie ihn der POST-Handler nach dem Commit vorliegen hat. */
interface CreatedTask {
	id: number;
	title: string;
	/** Empfänger (Aufgaben-Eigentümer); `null` würde gar nicht erst hier landen (Selbst-Anlage). */
	userId: number;
}

/** Der Ersteller (Ausschnitt) für den Nachrichtentext. */
interface Creator {
	displayName: string;
}

/**
 * Benachrichtigt den Empfänger über die fremd angelegte Aufgabe. Fehler beim Versand werden von
 * {@link sendDedupedPush} je Subscription behandelt (Selbstheilung/Protokollierung); der Aufrufer im
 * Handler fängt Restfehler ab, damit das Anlegen unberührt bleibt (#1224 AK4).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyTaskCreated = async (
	task: CreatedTask,
	creator: Creator | null,
	send?: PushSender,
): Promise<void> => {
	const recipient = await User.findByPk(task.userId, { attributes: ['sprache', 'zeitzone', 'taskPushEnabled'] });
	// #2850 AK3: Gruppenschalter „Aufgaben und Erinnerungen" aus → kein Push, kein Log (Muster carePush).
	if (recipient?.taskPushEnabled === false) {
		return;
	}
	// #2849 AK4: Ruhezeit 21–7 Ortszeit — kein Push, kein Log, kein Nachholen.
	if (istRuhezeit(new Date(), nutzerZeitzone(recipient?.zeitzone))) {
		return;
	}
	const texte = TEXTE[spracheVon(recipient?.sprache)];
	await sendDedupedPush(
		task.userId,
		KIND,
		String(task.id),
		{
			title: texte.titel(creator?.displayName ?? texte.jemand),
			body: texte.text(task.title),
			url: PUSH_TARGETS.taskCreated(task.id),
		},
		send,
	);
};
