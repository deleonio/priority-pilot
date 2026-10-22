import { Op } from 'sequelize';
import { Invoice, Subscription, User } from '../models/index.js';
import { GRACE_PERIOD_DAYS } from './billing/lifecycle.js';
import { istRuhezeit } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { PUSH_TARGETS } from './pushTargets.js';
import { nutzerZeitzone } from './streak.js';

/**
 * Fachlicher Service-Push-Sweep für Abo-/Rechnungs-Ereignisse (#2852, push-konzept.md §7.3):
 * KEINE Webhook-Änderung — PayPal/Play schreiben nur den Abo-Zustand (`applyPaymentEvent`,
 * `applyPlayState`), Rechnungen entstehen in `invoices.ts`. Dieser Sweep liest stündlich
 * Subscription + Invoice + User und leitet je Zustand genau einen Push ab:
 *
 * - neue Rechnung/Gutschrift (letzte 7 Tage) → Rechnungs-Push mit Rechnungen-Anker (AK1),
 * - `past_due`/`suspended` mit `firstFailureAt` → Zahlungsausfall-Push (AK2),
 * - Tag 12–15 der Kulanzfrist → genau eine Erinnerung, bevor die Frist endet (AK3),
 * - `grace_expired` bzw. abgelaufene Laufzeit → Abo-Ende-Push (AK5).
 *
 * Ereignisse in der Ruhezeit (21–7 Ortszeit) senden und loggen nichts — der erste Tick im
 * Tagesfenster holt nach, solange der Zustand zutrifft (AK4, Muster {@link istRuhezeit}).
 * Dedupe über NotificationLog ({@link sendDedupedPush}, Log erst bei `sent > 0`) mit je
 * Zustand getrennten Schlüsseln, damit ein Zustand keinen anderen blockiert. Rückstands-
 * Schutz: nur Ereignisse der letzten 7 Tage erhalten einen Push. Texte de/en nach
 * `spracheVon(user.sprache)`, ohne Werbesatz (§7.3-Vorlagen). Muster: `monthlyRecapPush.ts`.
 */

const KIND = 'abo-service';

const TAG_MS = 24 * 60 * 60 * 1000;
/** Rückstands-Schutz: nur Ereignisse der letzten 7 Tage (Rechnungsalter bzw. Abo-Ende). */
const FENSTER_TAGE = 7;

type AboPushEreignis = 'rechnung' | 'zahlung_fehlgeschlagen' | 'kulanz_erinnerung' | 'abo_ende';

export const ABO_PUSH_TEXTE: Record<AboPushEreignis, Record<CareSprache, { title: string; body: string }>> = {
	rechnung: {
		de: {
			title: 'Neue Rechnung für dein Abo',
			body: 'Deine Rechnung liegt in den Einstellungen unter Pakete bereit.',
		},
		en: {
			title: 'New invoice for your subscription',
			body: 'Your invoice is available in the settings under plans.',
		},
	},
	zahlung_fehlgeschlagen: {
		de: {
			title: 'Zahlung fehlgeschlagen',
			body: 'Wir konnten deine Zahlung nicht abbuchen. Bitte aktualisiere deine Zahlungsdaten.',
		},
		en: {
			title: 'Payment failed',
			body: 'We could not charge your payment. Please update your payment details.',
		},
	},
	kulanz_erinnerung: {
		de: {
			title: 'Abo läuft bald aus',
			body: 'Deine Kulanzfrist endet in wenigen Tagen. Hinterlege eine gültige Zahlungsmethode, um dein Abo fortzusetzen.',
		},
		en: {
			title: 'Your subscription ends soon',
			body: 'Your grace period ends in a few days. Add a valid payment method to continue your subscription.',
		},
	},
	abo_ende: {
		de: {
			title: 'Dein Abo ist beendet',
			body: 'Dein Abo ist ausgelaufen. Du kannst es in den Einstellungen unter Pakete wieder starten.',
		},
		en: {
			title: 'Your subscription has ended',
			body: 'Your subscription has expired. You can restart it in the settings under plans.',
		},
	},
};

/** Tage seit `seit` (erste Fehlerstellung bzw. Rechnungsdatum) zum Laufzeitpunkt. */
const tageSeit = (seit: Date, now: Date): number => (now.getTime() - seit.getTime()) / TAG_MS;

/**
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runAboServicePush = async (now: Date = new Date(), send?: PushSender): Promise<{ sends: number }> => {
	const users = await User.findAll();
	let sends = 0;
	for (const user of users) {
		// AK4: Ruhezeit-Skip schreibt bewusst keinen Log-Eintrag — sonst würde der blockierte
		// Lauf die Nachholung im Tagesfenster wegdeduppen (Muster carePush).
		if (istRuhezeit(now, nutzerZeitzone(user.zeitzone))) {
			continue;
		}
		const meldungen: { dedupeKey: string; ereignis: AboPushEreignis; url: string }[] = [];

		// AK1: Rechnungen/Gutschriften der letzten 7 Tage — je Rechnung genau ein Push.
		const rechnungen = await Invoice.findAll({
			where: { userId: user.id, createdAt: { [Op.gte]: new Date(now.getTime() - FENSTER_TAGE * TAG_MS) } },
		});
		for (const rechnung of rechnungen) {
			meldungen.push({
				dedupeKey: `invoice:${rechnung.id}`,
				ereignis: 'rechnung',
				url: PUSH_TARGETS.aboInvoice,
			});
		}

		// AK2/AK3/AK5: Abo-Zustände je Subscription auswerten.
		const abos = await Subscription.findAll({ where: { userId: user.id } });
		for (const abo of abos) {
			if (abo.status === 'past_due' || abo.status === 'suspended') {
				if (abo.firstFailureAt == null) {
					continue;
				}
				const tage = tageSeit(abo.firstFailureAt, now);
				if (tage > GRACE_PERIOD_DAYS) {
					// Frist abgelaufen: der Lifecycle-Sweep setzt grace_expired — hier nichts mehr.
					continue;
				}
				if (tage >= GRACE_PERIOD_DAYS - 3) {
					// AK3: Kulanz-Erinnerung im Fenster Tag 12–15 unter eigenem Dedupe-Key.
					meldungen.push({
						dedupeKey: `abo:${abo.id}:grace`,
						ereignis: 'kulanz_erinnerung',
						url: PUSH_TARGETS.aboStatus,
					});
				} else {
					// AK2: Ausfall-Push — beide Status teilen den Key-Raum (kein Doppel je Provider).
					meldungen.push({
						dedupeKey: `abo:${abo.id}:failed`,
						ereignis: 'zahlung_fehlgeschlagen',
						url: PUSH_TARGETS.aboStatus,
					});
				}
			} else if (abo.status === 'grace_expired') {
				// AK5: Kulanzfrist abgelaufen — Abo-Ende ohne Fenster (Dedupe verhindert Wiederholung).
				meldungen.push({ dedupeKey: `abo:${abo.id}:ended`, ereignis: 'abo_ende', url: PUSH_TARGETS.aboStatus });
			} else if (
				abo.status === 'cancelled' &&
				abo.currentPeriodEnd < now &&
				tageSeit(abo.currentPeriodEnd, now) <= FENSTER_TAGE
			) {
				// AK5: bezahlte Laufzeit abgelaufen (Play EXPIRED/zurückgebucht dito) — im 7-Tage-Fenster.
				meldungen.push({ dedupeKey: `abo:${abo.id}:ended`, ereignis: 'abo_ende', url: PUSH_TARGETS.aboStatus });
			}
		}

		for (const meldung of meldungen) {
			const { sent } = await sendDedupedPush(
				user.id,
				KIND,
				meldung.dedupeKey,
				{ ...ABO_PUSH_TEXTE[meldung.ereignis][spracheVon(user.sprache)], url: meldung.url },
				send,
			);
			if (sent > 0) {
				sends += 1;
			}
		}
	}
	return { sends };
};
