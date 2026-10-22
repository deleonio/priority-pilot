import { User } from '../models/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { isoWocheIn, nutzerZeitzone, tagIn } from './streak.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachliche Push-Trigger „Wochenrückblick" (#2855 AK2) und „Jahresrückblick" (#2855 AK3): die
 * Ankündigungen der Rückblick-Karten (`WeeklyBalanceCard` am Sonntagabend, `YearlyRecapCard` am
 * 2. Januar) — je enges lokales Fenster, häuﬁgkeitsbegrenzt über den Dedup-Schlüssel. Schalter:
 * `users.successPushEnabled` (Gruppe Erfolge und Rückblicke, Muster `monthlyRecapPush.ts`).
 * Ton nach `docs/fuersorge-tonalitaet.md`: einladend, ohne Aufgabeninhalte.
 */

const KIND_WOCHE = 'weekly-recap';
const KIND_JAHR = 'yearly-recap';

const WOCHEN_TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Deine Woche im Rückblick',
		body: 'Ein Blick zurück zeigt, was deine Balance getragen hat. Was darf nächste Woche etwas leichter sein?',
	},
	en: {
		title: 'Your week in review',
		body: 'A look back shows what carried your balance. What could be a little lighter next week?',
	},
};

const JAHRES_TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Dein Jahresrückblick ist fertig',
		body: 'Ein ganzes Jahr Balance liegt hinter dir. Sieh nach, was gewachsen ist – und was dich getragen hat.',
	},
	en: {
		title: 'Your year in review is ready',
		body: 'A whole year of balance lies behind you. See what has grown – and what carried you.',
	},
};

/** Lokaler Wochentag kurz (`'Sun'`, `'Mon'`, …) — Sonntag-Kriterium des Wochenrückblicks. */
const wochentagKurz = (datum: Date, zeitzone: string): string =>
	new Intl.DateTimeFormat('en-US', { timeZone: zeitzone, weekday: 'short' }).format(datum);

/**
 * Versendet höchstens einen Wochenrückblick je Nutzer und ISO-Woche — nur am lokalen Sonntag im
 * Fenster 17:00–19:59 Ortszeit (Anfang inklusive, Ende exklusiv).
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runWeeklyRecapPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.successPushEnabled === false) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		if (wochentagKurz(now, zeitzone) !== 'Sun') {
			continue;
		}
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < 17 || stunde >= 20) {
			continue;
		}
		const dedupeKey = `${user.id}:${isoWocheIn(now, zeitzone)}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND_WOCHE,
			dedupeKey,
			{ ...WOCHEN_TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.weeklyRecap },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};

/**
 * Versendet höchstens einen Jahresrückblick je Nutzer und Jahr — nur am lokalen 2. Januar im
 * Fenster 9:00–16:59 Ortszeit; der Dedup-Schlüssel nennt das Jahr des Rückblicks (Vorjahr), das
 * Folgejahr ist damit wieder frei.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runYearlyRecapPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.successPushEnabled === false) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		const lokalTag = tagIn(now, zeitzone);
		if (lokalTag.slice(5) !== '01-02') {
			continue;
		}
		const { stunde } = uhrzeitIn(now, zeitzone);
		if (stunde < 9 || stunde >= 17) {
			continue;
		}
		const dedupeKey = `${user.id}:${Number(lokalTag.slice(0, 4)) - 1}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND_JAHR,
			dedupeKey,
			{ ...JAHRES_TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.yearlyRecap },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
