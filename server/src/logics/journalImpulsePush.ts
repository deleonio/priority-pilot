import { Op } from 'sequelize';
import { JournalEntry, NotificationLog, User } from '../models/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { isoWocheIn, nutzerZeitzone } from './streak.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachlicher Push-Trigger „Journal-Impuls" (#2855 AK4): erinnert Nutzern mit einem
 * Journal-Eintrag der letzten 30 Tage im Abendfenster (18:00–19:59 Ortszeit, Anfang inklusive,
 * Ende exklusiv) ans Schreiben — höchstens zweimal je ISO-Woche, gezählt über die
 * `NotificationLog`-Einträge des Kinds der Woche. Schalter: `users.carePushEnabled` (Gruppe
 * Fürsorge). Ton nach `docs/fuersorge-tonalitaet.md`: ein Angebot, kein Auftrag.
 * Muster: {@link sendDedupedPush} mit injizierbarem PushSender.
 */

const KIND = 'journal-impulse';

/** Häufigkeitsgrenze je ISO-Woche (Konzept §7.1: zweimal wöchentlich). */
const MAX_PRO_WOCHE = 2;

const DREISSIG_TAGE_MS = 30 * 24 * 60 * 60 * 1000;

const TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Zeit für eine Zeile Journal',
		body: 'Ein kurzer Eintrag kann den Tag sortieren – dein Journal nimmt alles auf, was dich bewegt.',
	},
	en: {
		title: 'Time for a line in your journal',
		body: 'A short entry can sort out your day – your journal takes in whatever moves you.',
	},
};

/**
 * Versendet höchstens zwei Journal-Impulse je Nutzer und ISO-Woche. Der Dedup-Schlüssel trägt
 * einen fortlaufenden Slot (Anzahl bereits gesendeter Impulse der Woche), damit beide Sends der
 * Woche unterscheidbar bleiben.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runJournalImpulsePush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.carePushEnabled === false) {
			continue;
		}
		const frischerEintrag = await JournalEntry.findOne({
			where: { userId: user.id, createdAt: { [Op.gte]: new Date(now.getTime() - DREISSIG_TAGE_MS) } },
			attributes: ['id'],
		});
		if (!frischerEintrag) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < 18 || stunde >= 20) {
			continue;
		}
		const woche = isoWocheIn(now, zeitzone);
		const gesendet = await NotificationLog.count({
			where: { kind: KIND, userId: user.id, dedupeKey: { [Op.like]: `${user.id}:${woche}:%` } },
		});
		if (gesendet >= MAX_PRO_WOCHE) {
			continue;
		}
		const dedupeKey = `${user.id}:${woche}:${gesendet}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND,
			dedupeKey,
			{ ...TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.journalImpulse },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
