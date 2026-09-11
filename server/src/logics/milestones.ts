/**
 * Meilenstein-Berechnung (#1362) — feste Streak- und Punkte-Stufen, rückwirkend aus Bestandsdaten.
 *
 * Reine Logik ohne DB-Zugriff; die Route reicht `bestStreak` (aus `berechneStreak(...).best`, #1360)
 * und `punkteSumme` (Summe der `ScoreEntry.punkte` des Nutzers, Gamification-Punkte statt
 * Dashboard-Gesamtguthaben) herein. Es gibt keinen gespeicherten Erreicht-Zustand — ein Punkte-Badge
 * kann nach dem Wiedereröffnen einer erledigten Aufgabe wieder erlöschen (docs/user-guide.md,
 * Gamification-Abschnitt).
 */

const STREAK_SCHWELLEN = [3, 7, 14, 30, 100] as const;
const PUNKTE_SCHWELLEN = [50, 250, 1000, 5000] as const;

interface Meilenstein {
	schluessel: string;
	typ: 'streak' | 'punkte';
	schwelle: number;
	erreicht: boolean;
}

/**
 * Streak-Stufen zuerst, dann Punkte-Stufen, jeweils aufsteigend. Streak-Stufen werden gegen
 * `bestStreak` geprüft, nicht gegen den aktuellen (laufenden) Streak — ein gerissener Streak lässt
 * einmal erreichte Streak-Badges nicht wieder verschwinden.
 */
export const berechneMeilensteine = ({
	bestStreak,
	punkteSumme,
}: {
	bestStreak: number;
	punkteSumme: number;
}): Meilenstein[] => [
	...STREAK_SCHWELLEN.map((schwelle) => ({
		schluessel: `streak-${schwelle}`,
		typ: 'streak' as const,
		schwelle,
		erreicht: bestStreak >= schwelle,
	})),
	...PUNKTE_SCHWELLEN.map((schwelle) => ({
		schluessel: `punkte-${schwelle}`,
		typ: 'punkte' as const,
		schwelle,
		erreicht: punkteSumme >= schwelle,
	})),
];
