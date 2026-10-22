import { User } from '../models/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { nutzerZeitzone, tagIn } from './streak.js';
import { uhrzeitIn } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';

/**
 * Fachlicher Push-Trigger „Monatsrückblick" (#1995): höchstens **ein** Push je Nutzer und
 * Kalendermonat — die Ankündigung des Rückblicks auf den Vormonat, den die Rückblick-Card
 * (`MonthlyBalanceCard`) im Monatsanfangs-Fenster (Tag 1–7) zeigt. Recap-Monat ist der Vormonat
 * der Nutzerzeitzone (ohne gültige Zone: UTC). Ton nach `docs/fuersorge-tonalitaet.md`: einladend,
 * ohne Schuld-Vokabular; ohne Aufgabeninhalte. Muster: {@link sendDedupedPush} (`dedupedPush.ts` —
 * NotificationLog-Dedup erst nach `sent > 0`, injizierbarer PushSender).
 */

const KIND = 'monthly-recap';

const TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Dein Monatsrückblick ist da',
		body: 'Ein Blick zurück: So hat sich deine Balance im letzten Monat entwickelt.',
	},
	en: {
		title: 'Your monthly recap is here',
		body: 'A look back: this is how your balance developed last month.',
	},
};

/** Vormonat eines Kalendertags `YYYY-MM-DD` als `JJJJ-MM` (Jahreswechsel-sicher). */
const vormonatVonTag = (tag: string): string => {
	const [jahr, monat] = tag.split('-').map(Number) as [number, number];
	return `${jahr + Math.floor((monat - 2) / 12)}-${String(((monat + 10) % 12) + 1).padStart(2, '0')}`;
};

/**
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`).
 */
export const runMonthlyRecapPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		const zeitzone = nutzerZeitzone(user.zeitzone);
		// #2849 AK6: Fenster 9–17 Ortszeit an lokalem Monatstag 1–7 (ohne gültige Zone: UTC).
		const { stunde } = uhrzeitIn(now, zeitzone);
		const lokalTag = tagIn(now, zeitzone);
		if (stunde < 9 || stunde >= 18 || Number(lokalTag.slice(8, 10)) > 7) {
			continue;
		}
		const dedupeKey = `${user.id}:${vormonatVonTag(lokalTag)}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND,
			dedupeKey,
			{ ...TEXTE[spracheVon(user.sprache)], url: '/' },
			send,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
