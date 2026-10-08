import { NotificationLog, ScoreEntry, Task, User } from '../models/index.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendPushToUser, type PushSender } from './push.js';
import { berechneStreak, istGueltigeZeitzone, istHeuteRuhetag, streakZeitpunkte, tagIn } from './streak.js';

/**
 * Fachlicher Push-Trigger „Streak-Erinnerung“ (#1836): höchstens **ein** Push je Nutzer und lokalem
 * Kalendertag, wenn eine Streak ab 1 besteht (letzter aktiver Tag = gestern) und heute noch nichts
 * erledigt wurde. Zugestellt wird nur abends 18:00–20:59 der Nutzer-Zeitzone (endet mit der
 * Ruhezeit ab 21:00 aus `carePush.ts`); ungültige/fehlende Zone fällt auf UTC zurück. Schalter ist
 * `users.carePushEnabled` (gleiche Fürsorge-Kategorie). Ton nach `docs/fuersorge-tonalitaet.md`.
 * Muster: `carePush.ts` (NotificationLog-Dedup erst nach `sent > 0`, injizierbarer PushSender).
 */

const KIND = 'streak-reminder';

/** Abendfenster (lokale Stunde, inklusive Anfang, exklusive Ende). */
const FENSTER_START = 18;
const FENSTER_ENDE = 21;

const TEXTE: Record<CareSprache, { titel: string; text: string }> = {
	de: {
		titel: 'Deine Streak wartet',
		text: 'Du bist seit {n} Tagen dran – eine kleine Aufgabe heute hält deine Serie am Leben.',
	},
	en: {
		titel: 'Your streak is waiting',
		text: 'You’ve been at it for {n} days – one small task today keeps your streak alive.',
	},
};

/** Push-Titel/-Text in der Sprache, Streak-Länge eingesetzt. */
export const streakReminderText = (sprache: CareSprache, streak: number): { titel: string; text: string } => {
	const { titel, text } = TEXTE[sprache];
	return { titel, text: text.replace('{n}', String(streak)) };
};

/**
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`).
 */
export const runStreakReminder = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.carePushEnabled === false) {
			continue;
		}
		const zeitzone = istGueltigeZeitzone(user.zeitzone ?? undefined) ? (user.zeitzone as string) : 'UTC';
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < FENSTER_START || stunde >= FENSTER_ENDE) {
			continue;
		}
		const heute = tagIn(now, zeitzone);
		const dedupeKey = `${user.id}:${heute}`;
		if (await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } })) {
			continue;
		}
		const entries = await ScoreEntry.findAll({ include: [{ model: Task, where: { userId: user.id } }] });
		const { aktuell, aktiveTage } = berechneStreak(
			streakZeitpunkte(
				entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
				zeitzone,
			),
			now,
			zeitzone,
		);
		// Am freien Ruhetag der Woche (#1971) hält die Kette ohnehin — keine Erinnerung.
		if (aktuell < 1 || aktiveTage[aktiveTage.length - 1] === heute || istHeuteRuhetag(aktiveTage, now, zeitzone)) {
			continue;
		}
		const text = streakReminderText(spracheVon(user.sprache), aktuell);
		const { sent } = await sendPushToUser(user.id, { title: text.titel, body: text.text, url: '/aufgaben' }, send);
		if (sent > 0) {
			await NotificationLog.create({ userId: user.id, kind: KIND, dedupeKey, sentAt: now });
			usersNotified++;
		}
	}
	return { usersNotified };
};
