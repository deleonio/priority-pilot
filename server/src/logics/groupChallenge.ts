import { berechneLebensbalance, type BalanceSaeule, type BalanceTask } from './heartBalance.js';

/** Laufzeit einer Gruppen-Challenge (#1992): fest sieben Tage. */
export const CHALLENGE_DAUER_MS = 7 * 24 * 60 * 60 * 1000;

export type ChallengeStatus = 'laufend' | 'beendet';

/** Status beim Lesen aus `endsAt` abgeleitet (AK2) — ab `endsAt` ist die Challenge beendet. */
export const challengeStatus = (endsAt: Date, jetzt: Date): ChallengeStatus =>
	jetzt.getTime() < endsAt.getTime() ? 'laufend' : 'beendet';

export interface ChallengeMitglied {
	name: string;
	saeulen: BalanceSaeule[];
	/** Im Challenge-Zeitraum erledigte eigene Tasks — gehen nur in die Rechnung, nie in die Antwort. */
	tasks: BalanceTask[];
}

export interface RangEintrag {
	name: string;
	rang: number;
	/** Lebensbalance-Füllstand 0–1 (zwei Nachkommastellen); `null` ohne Punkte im Zeitraum. */
	balance: number | null;
}

/**
 * Rangfolge nach Balance statt Menge (AK3): absteigend nach `fill`, Gleichstand teilt den Rang.
 * Mitglieder ohne Punkte stehen ohne Wert am Ende statt mit 0 (Fürsorge-Tonalität). Je Eintrag
 * nur Name, Rang und Wert — keine Taskanzahl (AK4).
 */
export const berechneRangfolge = (mitglieder: ChallengeMitglied[]): RangEintrag[] => {
	const werte = mitglieder.map(({ name, saeulen, tasks }) => {
		const { fill, hasPoints } = berechneLebensbalance(saeulen, tasks);
		return { name, balance: hasPoints ? Math.round(fill * 100) / 100 : null };
	});
	const sortiert = [...werte].sort((a, b) => (b.balance ?? -1) - (a.balance ?? -1));
	return sortiert.map(({ name, balance }) => ({
		name,
		rang: 1 + sortiert.filter((andere) => (andere.balance ?? -1) > (balance ?? -1)).length,
		balance,
	}));
};
