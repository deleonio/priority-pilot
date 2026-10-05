import { berechneStreak, tagIn, type StreakErgebnis } from './streak.js';

/**
 * Gemeinsamer Streak eines Duos (#1974): `berechneStreak` über die Schnittmenge der aktiven
 * Kalendertage beider Mitglieder — erledigt nur eine Person, zählt der Tag nicht.
 */
export const berechneDuoStreak = (
	zeitpunkteA: Date[],
	zeitpunkteB: Date[],
	heute: Date,
	zeitZone: string,
): StreakErgebnis => {
	const tageB = new Set(zeitpunkteB.map((zeitpunkt) => tagIn(zeitpunkt, zeitZone)));
	return berechneStreak(
		zeitpunkteA.filter((zeitpunkt) => tageB.has(tagIn(zeitpunkt, zeitZone))),
		heute,
		zeitZone,
	);
};
