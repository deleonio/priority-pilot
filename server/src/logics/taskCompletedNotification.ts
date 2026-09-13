import { NotificationLog, User } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';

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
 * @param mailSend injizierbarer Mail-Versand (#1426, siehe `logics/mail.ts`); ohne SMTP-Konfiguration
 *   und ohne injizierten Sender wird kein Mail-Versuch unternommen (AK6).
 */
export const notifyTaskCompleted = async (
	task: CompletedTask,
	completer: Completer | null,
	send?: PushSender,
	mailSend?: MailSender,
): Promise<void> => {
	const dedupeKey = String(task.id);
	const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
	if (alreadySent) {
		return;
	}
	const completerName = completer?.displayName ?? 'Jemand';
	const title = 'Aufgabe erledigt';
	const body = `${completerName} hat „${task.title}“ erledigt.`;
	const { sent } = await sendPushToUser(task.createdById, { title, body, url: '/' }, send);
	let mailSent = false;
	if (mailSend || isMailConfigured()) {
		const recipient = await User.findByPk(task.createdById);
		mailSent = await sendMailToUser({ email: recipient?.email ?? null }, { subject: title, text: body }, mailSend);
	}
	if (sent > 0 || mailSent) {
		await NotificationLog.create({
			userId: task.createdById,
			kind: KIND,
			dedupeKey,
			sentAt: new Date(),
		});
	}
};
