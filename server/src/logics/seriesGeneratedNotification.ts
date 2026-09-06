import { NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „Serie von jemand anderem angelegt hat Instanzen erzeugt" (#1253):
 * Erzeugt ein Generierungslauf Instanzen einer Serie, die Konto A für Konto B angelegt hat,
 * erhält B genau **eine** gebündelte Nachricht je Serie und Lauf — mit Serientitel,
 * Anzeigenamen von A und Zahl der neuen Aufgaben. Wie `taskCreatedNotification` (#1224)
 * verhindert der Auslöser über {@link NotificationLog} (eigene `kind`, dedupeKey bindet an die
 * erzeugte Aufgabe), dass derselbe Lauf erneut meldet.
 *
 * Selbst-Anlagen (`createdById === userId`) und Alt-Bestand ohne `createdById` lösen nichts aus —
 * die Stille-Entscheidung trifft diese Logik selbst anhand der Serien-Felder, nicht der Aufrufer.
 */

const KIND = 'series-generated';

/** Die Serie (Ausschnitt), deren Lauf Instanzen erzeugt hat. */
interface GeneratingSeries {
	id: number;
	title: string;
	/** Empfänger (Serien-Eigentümer) — an ihn geht die Nachricht. `null`/`undefined` → still. */
	userId?: number | null;
	/** Ersteller (A) — `null` oder gleich `userId` bedeutet Selbst-Anlage/Alt-Bestand: still. */
	createdById?: number | null;
}

/** Die vom Lauf neu erzeugten Instanzen (nicht leer, sonst passiert nichts). */
interface GeneratedTask {
	id: number;
}

/** Der Ersteller (Ausschnitt) für den Nachrichtentext. */
interface Creator {
	displayName: string | null;
	email?: string;
}

/**
 * Benachrichtigt den Serien-Eigentümer über die erzeugten Instanzen — alle Instanzen eines Laufs
 * gebündelt in EINER Nachricht. Fehler beim Versand werden je Subscription von
 * {@link sendPushToUser} behandelt; der Aufrufer fängt Restfehler ab, damit die Generierung
 * unberührt bleibt (#1253 AK5).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifySeriesGenerated = async (
	series: GeneratingSeries,
	createdTasks: GeneratedTask[],
	creator: Creator | null,
	send?: PushSender,
): Promise<void> => {
	if (createdTasks.length === 0) {
		return;
	}
	if (series.userId == null) {
		return;
	}
	if (series.createdById == null || series.createdById === series.userId) {
		return;
	}
	const dedupeKey = `${series.id}:${createdTasks[0].id}`;
	const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
	if (alreadySent) {
		return;
	}
	const creatorName = creator?.displayName || creator?.email || 'Jemand';
	const { sent } = await sendPushToUser(
		series.userId,
		{
			title: `Neue Aufgaben von ${creatorName}`,
			body: `„${series.title}“: ${createdTasks.length} neue Aufgaben.`,
			url: '/',
		},
		send,
	);
	if (sent > 0) {
		await NotificationLog.create({ userId: series.userId, kind: KIND, dedupeKey, sentAt: new Date() });
	}
};
