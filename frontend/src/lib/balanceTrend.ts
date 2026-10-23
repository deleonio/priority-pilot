import type { BalanceHistoryEntry } from 'client';

export type BalanceTrend = 'aufwaerts' | 'abwaerts' | 'stabil';

/** Schwelle in Prozentpunkten, ab der eine Veränderung als Trend gilt (#2082). */
const TREND_SCHWELLE = 5;

/** Trend des Füllstand-Verlaufs: letzter minus erster Tageswert, nur jenseits von ±5 Punkten. */
export const balanceTrend = (eintraege: Pick<BalanceHistoryEntry, 'fuellstandProzent'>[]): BalanceTrend => {
	if (eintraege.length === 0) {
		return 'stabil';
	}
	const differenz = eintraege[eintraege.length - 1].fuellstandProzent - eintraege[0].fuellstandProzent;
	if (differenz > TREND_SCHWELLE) {
		return 'aufwaerts';
	}
	return differenz < -TREND_SCHWELLE ? 'abwaerts' : 'stabil';
};
