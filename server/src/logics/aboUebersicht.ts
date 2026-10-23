import { Subscription } from '../models/index.js';
import { OVERDUE_SUBSCRIPTION_STATUSES, isSubscriptionRunning } from '../models/subscription.js';

/**
 * Abo-Übersicht für Admins (#1338): Zählungen über alle Abo-Zeilen, keine Personendaten.
 * „Laufend" folgt {@link isSubscriptionRunning}.
 */

const TAG_MS = 86_400_000;
/** Fenster für bald endende laufende Abos. */
const ENDE_FENSTER_TAGE = 30;

export interface AboUebersicht {
	/** Anzahl je Paket und Status, z. B. `{ plus: { active: 2, cancelled: 1 } }`. */
	byPlanAndStatus: Record<string, Record<string, number>>;
	/** Effektiv laufende Abos je Paket und Laufzeit. */
	running: Record<string, Record<string, number>>;
	/** `past_due` oder `suspended`. */
	overdue: number;
	/** Gekündigt, Laufzeit aber noch nicht abgelaufen. */
	cancelledWithRemainingTerm: number;
	/** Laufende Abos, deren `currentPeriodEnd` in den nächsten 30 Tagen liegt. */
	endingWithin30Days: number;
}

const zaehle = (ziel: Record<string, Record<string, number>>, aussen: string, innen: string): void => {
	const zeile = (ziel[aussen] ??= {});
	zeile[innen] = (zeile[innen] ?? 0) + 1;
};

/** Abo-Zeile mit den Feldern, die die Übersicht braucht. */
export interface AboZeile {
	plan: string;
	period: string;
	status: string;
	currentPeriodEnd: Date | null;
}

export const berechneAboUebersicht = (abos: AboZeile[], now: Date): AboUebersicht => {
	const fensterEnde = new Date(now.getTime() + ENDE_FENSTER_TAGE * TAG_MS);
	const uebersicht: AboUebersicht = {
		byPlanAndStatus: {},
		running: {},
		overdue: 0,
		cancelledWithRemainingTerm: 0,
		endingWithin30Days: 0,
	};
	for (const abo of abos) {
		zaehle(uebersicht.byPlanAndStatus, abo.plan, abo.status);
		if (OVERDUE_SUBSCRIPTION_STATUSES.includes(abo.status)) uebersicht.overdue++;
		if (!isSubscriptionRunning(abo, now)) continue;
		zaehle(uebersicht.running, abo.plan, abo.period);
		if (abo.status === 'cancelled') uebersicht.cancelledWithRemainingTerm++;
		if (abo.currentPeriodEnd !== null && abo.currentPeriodEnd > now && abo.currentPeriodEnd <= fensterEnde)
			uebersicht.endingWithin30Days++;
	}
	return uebersicht;
};

export const ladeAboUebersicht = async (now = new Date()): Promise<AboUebersicht> => {
	const abos = await Subscription.findAll({ attributes: ['plan', 'period', 'status', 'currentPeriodEnd'] });
	return berechneAboUebersicht(
		abos.map((abo) => ({
			plan: abo.get('plan') as string,
			period: abo.get('period') as string,
			status: abo.get('status') as string,
			currentPeriodEnd: (abo.get('currentPeriodEnd') as Date | null) ?? null,
		})),
		now,
	);
};
