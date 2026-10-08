import { NotificationLog, User } from '../models/index.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „Aufgabe von jemand anderem angelegt" (#1224): legt ein Gruppenmitglied A
 * eine Aufgabe für B an, erhält B genau eine Push-Nachricht mit Aufgabentitel und Anzeigenamen von A.
 * Wie `dailyTopTasks` verhindert der Auslöser über {@link NotificationLog} (eigene `kind`,
 * `dedupeKey` = Task-Id), dass dieselbe Aufgabe erneut meldet — pro Aufgabe höchstens eine Nachricht.
 * Selbst-Anlagen lösen nichts aus (entscheidet der Aufrufer, indem er keinen Empfänger übergibt).
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
 * {@link sendPushToUser} je Subscription behandelt (Selbstheilung/Protokollierung); der Aufrufer im
 * Handler fängt Restfehler ab, damit das Anlegen unberührt bleibt (#1224 AK4).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyTaskCreated = async (
	task: CreatedTask,
	creator: Creator | null,
	send?: PushSender,
): Promise<void> => {
	const dedupeKey = String(task.id);
	const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
	if (alreadySent) {
		return;
	}
	const texte = TEXTE[spracheVon((await User.findByPk(task.userId, { attributes: ['sprache'] }))?.sprache)];
	const { sent } = await sendPushToUser(
		task.userId,
		{ title: texte.titel(creator?.displayName ?? texte.jemand), body: texte.text(task.title), url: '/' },
		send,
	);
	if (sent > 0) {
		await NotificationLog.create({ userId: task.userId, kind: KIND, dedupeKey, sentAt: new Date() });
	}
};
