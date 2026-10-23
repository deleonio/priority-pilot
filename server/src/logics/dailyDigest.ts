import { NotificationLog, User } from '../models/index.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { collectDailyTopTasks } from './dailyTopTasks.js';
import { sendDedupedPush } from './dedupedPush.js';
import { collectDueTaskReminders } from './dueTaskReminders.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';
import { renderMailHtml } from './mailTemplate.js';
import type { PushSender } from './push.js';
import { nutzerZeitzone, tagIn } from './streak.js';

/**
 * Morgen-Push „Dein Tag“ (#2853, Konzept §6): bündelt fällige Aufgaben (#355) und Top-Aufgaben
 * (#518) zu **genau einer** Nachricht je Nutzer und lokalem Tag — die zwei getrennten
 * Morgen-Pushes entfallen. URL-Regeln: genau eine Aufgabe öffnet die Aufgabe, mehrere mit fälliger
 * dabei die Karte „Fällig“, sonst „Top-Aufgaben“. Ein Wiederholungstick am selben lokalen Tag
 * sendet nichts (Dedupe über {@link sendDedupedPush}). Fenster: lokale Stunde 7–9 (#2849).
 * Zusätzlich geht die Morgen-Mail (#1426, F2.2) an die SMTP-Empfänger — als zweiter Kanal neben
 * dem Push, ohne Budget-Verbrauch (Konzept §4 zählt Pushes).
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
 * Versendet die Morgen-Bündelung (eine Push-Nachricht je Nutzer im Morgenfenster) und die
 * Morgen-Mail (#1426). Idempotent pro Kalendertag über beide Kanäle; der Push zählt als
 * fachlicher Push ins Budget ({@link ./pushBudget.js}).
 *
 * @param now Zeitpunkt des Scheduler-Ticks (UTC); bestimmt Fenster und lokalen Tag.
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 * @param mailSend injizierbarer Mail-Versand (#1426, siehe `logics/mail.ts`); ohne SMTP-Konfiguration
 *   und ohne injizierten Sender wird kein Mail-Versuch unternommen.
 */
export const runDailyDigest = async (
	now: Date = new Date(),
	send?: PushSender,
	mailSend?: MailSender,
): Promise<{ usersNotified: number }> => {
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
		const recipient = await User.findByPk(userId, { attributes: ['sprache', 'zeitzone', 'email', 'taskPushEnabled'] });
		// #2850 AK3: Gruppenschalter „Aufgaben und Erinnerungen“ aus → weder Push noch Mail.
		if (recipient?.taskPushEnabled === false) {
			continue;
		}
		// #2849 AK2/AK5: Morgenfenster 7–9 in der Nutzer-Zeitzone (ohne gültige Zone: UTC).
		const zeitzone = nutzerZeitzone(recipient?.zeitzone);
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < FENSTER_START || stunde >= FENSTER_ENDE) {
			continue;
		}
		const aufgaben = [...gruppe.aufgaben].map(([id, title]) => ({ id, title }));
		const sprache = spracheVon(recipient?.sprache);
		const payload = buildPayload(aufgaben, gruppe.hatFaellige, sprache);
		const dedupeKey = `${userId}:${tagIn(now, zeitzone)}`;
		// Tag-Deckel (#2849 AK2) vor beiden Kanälen prüfen — der Wiederholungstick darf weder Push
		// noch Mail erneut auslösen.
		if (await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } })) {
			continue;
		}
		const { sent } = await sendDedupedPush(userId, KIND, dedupeKey, payload, send, now);
		// Morgen-Mail als zweiter Kanal (#1426, F2.2): zusätzlich zum Push, ohne Budget-Verbrauch
		// (Konzept §4 zählt Pushes).
		let mailSent = false;
		if (mailSend || isMailConfigured()) {
			const mailHtml = renderMailHtml({ heading: payload.title, paragraphs: [payload.body], lang: sprache });
			mailSent = await sendMailToUser(
				{ email: recipient?.email ?? null },
				{ subject: payload.title, text: payload.body, html: mailHtml.html, attachments: mailHtml.attachments },
				mailSend,
			);
		}
		if (sent === 0 && mailSent) {
			// Nur-Mail-Fall (Push verdrängt oder ohne Subscription): den Digest-Schlüssel selbst
			// nachziehen — sendDedupedPush protokolliert nur `sent > 0`; ohne Zeile würde die Mail je
			// Wiederholungstick erneut versendet.
			await NotificationLog.create({ userId, kind: KIND, dedupeKey, sentAt: now });
		}
		if (sent > 0 || mailSent) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
