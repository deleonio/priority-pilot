import { NotificationLog, User } from '../models/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { istRuhezeit } from './carePush.js';
import { nutzerZeitzone } from './streak.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachlicher Push-Trigger „Serie von jemand anderem angelegt hat Instanzen erzeugt" (#1253):
 * Erzeugt ein Generierungslauf Instanzen einer Serie, die Konto A für Konto B angelegt hat,
 * erhält B genau **eine** gebündelte Nachricht je Serie und Lauf — mit Serientitel,
 * Anzeigenamen von A und Zahl der neuen Aufgaben. Wie `taskCreatedNotification` (#1224)
 * verhindert der Auslöser über {@link NotificationLog} (eigene `kind`, dedupeKey bindet an die
 * erzeugte Aufgabe), dass derselbe Lauf erneut meldet. Ruhezeit 21–7 Ortszeit des Empfängers:
 * kein Versand, kein Log (#2849 AK4).
 *
 * Selbst-Anlagen (`createdById === userId`) und Alt-Bestand ohne `createdById` lösen nichts aus —
 * die Stille-Entscheidung trifft diese Logik selbst anhand der Serien-Felder, nicht der Aufrufer.
 */

const KIND = 'series-generated';

const TEXTE: Record<
	CareSprache,
	{ jemand: string; titel: (name: string) => string; text: (serie: string, anzahl: number) => string }
> = {
	de: {
		jemand: 'Jemand',
		titel: (name) => `Neue Aufgaben von ${name}`,
		text: (serie, anzahl) => `„${serie}“: ${anzahl} neue Aufgaben.`,
	},
	en: {
		jemand: 'Someone',
		titel: (name) => `New tasks from ${name}`,
		text: (serie, anzahl) => `"${serie}": ${anzahl} new tasks.`,
	},
};

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
 * @param mailSend injizierbarer Mail-Versand (#1426, siehe `logics/mail.ts`); ohne SMTP-Konfiguration
 *   und ohne injizierten Sender wird kein Mail-Versuch unternommen (AK6).
 */
export const notifySeriesGenerated = async (
	series: GeneratingSeries,
	createdTasks: GeneratedTask[],
	creator: Creator | null,
	send?: PushSender,
	mailSend?: MailSender,
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
	// Mail teilt denselben Dedupe-Schlüssel (#1426): Die Prüfung bleibt hier, weil der Helfer
	// „bereits gesendet" nicht von „keine Subscription" unterscheiden kann und die Mail sonst
	// bei jedem Lauf erneut ginge.
	if (await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } })) {
		return;
	}
	const recipient = await User.findByPk(series.userId);
	// #2850 AK3: Gruppenschalter „Aufgaben und Erinnerungen" aus → kein Push, kein Log (Muster carePush).
	if (recipient?.taskPushEnabled === false) {
		return;
	}
	// #2849 AK4: Ruhezeit 21–7 Ortszeit — komplett stumm (Push wie Mail), kein Log, kein Nachholen.
	if (istRuhezeit(new Date(), nutzerZeitzone(recipient?.zeitzone))) {
		return;
	}
	const texte = TEXTE[spracheVon(recipient?.sprache)];
	const title = texte.titel(creator?.displayName || creator?.email || texte.jemand);
	const body = texte.text(series.title, createdTasks.length);
	const { sent } = await sendDedupedPush(
		series.userId,
		KIND,
		dedupeKey,
		{ title, body, url: PUSH_TARGETS.seriesGenerated },
		send,
	);
	let mailSent = false;
	if (mailSend || isMailConfigured()) {
		mailSent = await sendMailToUser({ email: recipient?.email ?? null }, { subject: title, text: body }, mailSend);
	}
	if (sent === 0 && mailSent) {
		// Protokolliert der Helfer nicht (Push ohne Zustellung), sichert erst die Mail den Log-Eintrag.
		await NotificationLog.create({ userId: series.userId, kind: KIND, dedupeKey, sentAt: new Date() });
	}
};
