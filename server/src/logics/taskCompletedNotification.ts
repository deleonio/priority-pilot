import { NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „fremd angelegte Aufgabe erledigt" (#1391): setzt B den Status einer von A
 * für B angelegten Aufgabe erstmals auf „Done", erhält A genau eine Push-Nachricht mit Aufgabentitel
 * und Bs Anzeigenamen. Wie `notifyTaskCreated` (#1224) verhindert der Auslöser über
 * {@link NotificationLog} (eigene `kind`, `dedupeKey` = Task-Id), dass dieselbe Aufgabe erneut meldet
 * — pro Aufgabe höchstens eine Nachricht, auch nach Wiedereröffnen und erneutem Erledigen.
 * Selbst-Anlagen lösen nichts aus (entscheidet der Aufrufer, indem er gar nicht erst aufruft).
 */

const KIND = 'task-completed';

/** Der erledigte Task (Ausschnitt), wie ihn der PATCH-Handler nach dem Commit vorliegen hat. */
interface CompletedTask {
	id: number;
	title: string;
	/** Ersteller = Empfänger der Nachricht; `null` würde gar nicht erst hier landen (Selbst-Anlage). */
	createdById: number;
}

/** Der Erlediger (Ausschnitt) für den Nachrichtentext. */
interface Completer {
	displayName: string;
}

/**
 * Benachrichtigt den Ersteller über die erledigte Aufgabe. Fehler beim Versand werden von
 * {@link sendPushToUser} je Subscription behandelt (Selbstheilung/Protokollierung); der Aufrufer im
 * Handler fängt Restfehler ab, damit der PATCH unberührt bleibt (#1391 AK5).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyTaskCompleted = async (
	task: CompletedTask,
	completer: Completer | null,
	send?: PushSender,
): Promise<void> => {
	const dedupeKey = String(task.id);
	const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
	if (alreadySent) {
		return;
	}
	const completerName = completer?.displayName ?? 'Jemand';
	const { sent } = await sendPushToUser(
		task.createdById,
		{
			title: 'Aufgabe erledigt',
			body: `${completerName} hat „${task.title}“ erledigt.`,
			url: '/',
		},
		send,
	);
	if (sent > 0) {
		await NotificationLog.create({
			userId: task.createdById,
			kind: KIND,
			dedupeKey,
			sentAt: new Date(),
		});
	}
};
