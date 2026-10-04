import { NotificationLog, User } from '../models/index.js';
import { sendPushToUser, type PushSender } from './push.js';
import { istGueltigeZeitzone, tagIn } from './streak.js';

/**
 * Fachlicher Push-Trigger „Monatsrückblick" (#1995): höchstens **ein** Push je Nutzer und
 * Kalendermonat — die Ankündigung des Rückblicks auf den Vormonat, den die Rückblick-Card
 * (`MonthlyBalanceCard`) im Monatsanfangs-Fenster (Tag 1–7) zeigt. Recap-Monat ist der Vormonat
 * der Nutzerzeitzone (ohne gültige Zone: UTC). Ton nach `docs/fuersorge-tonalitaet.md`: einladend,
 * ohne Schuld-Vokabular; ohne Aufgabeninhalte. Muster: `streakReminder.ts`
 * (NotificationLog-Dedup erst nach `sent > 0`, injizierbarer PushSender).
 */

const KIND = 'monthly-recap';

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
		const zeitzone = istGueltigeZeitzone(user.zeitzone ?? undefined) ? (user.zeitzone as string) : 'UTC';
		const dedupeKey = `${user.id}:${vormonatVonTag(tagIn(now, zeitzone))}`;
		if (await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } })) {
			continue;
		}
		const { sent } = await sendPushToUser(
			user.id,
			{
				title: 'Dein Monatsrückblick ist da',
				body: 'Ein Blick zurück: So hat sich deine Balance im letzten Monat entwickelt.',
				url: '/',
			},
			send,
		);
		if (sent > 0) {
			await NotificationLog.create({ userId: user.id, kind: KIND, dedupeKey, sentAt: now });
			usersNotified++;
		}
	}
	return { usersNotified };
};
