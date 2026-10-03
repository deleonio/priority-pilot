/**
 * Meilenstein-Berechnung (#1362) — feste Streak- und Punkte-Stufen, rückwirkend aus Bestandsdaten.
 *
 * `berechneMeilensteine` ist reine Logik ohne DB-Zugriff; die Lesestellen reichen `bestStreak`
 * (aus `berechneStreak(...).best`, #1360) und `punkteSumme` (Summe der `ScoreEntry.punkte` des
 * Nutzers, Gamification-Punkte statt Dashboard-Gesamtguthaben) herein. Seit #1965 liest
 * `meilensteinStandVon` den Stand an allen Lesestellen und hält ihn sticky: einmal erreicht
 * bleibt erreicht — das Wiedereröffnen einer erledigten Aufgabe senkt die Punktesumme, nimmt
 * aber keine Auszeichnung mehr weg (Belohnung nie als Bestrafung).
 */

import { MilestoneReached, ScoreEntry, Task } from '../models/index.js';
import { ownerScope } from './ownerScope.js';
import { berechneStreak, streakZeitpunkte } from './streak.js';

const STREAK_SCHWELLEN = [3, 7, 14, 30, 100] as const;
const PUNKTE_SCHWELLEN = [50, 250, 1000, 5000] as const;

export interface Meilenstein {
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

/**
 * Meilenstein-Stand eines Nutzers (#1363/#1965) — berechnet den Stand wie bisher aus den
 * Bestandsdaten (`ScoreEntry`, Streak gegen `bestStreak`, Punkte-Summe) und merged die einmal
 * erreichten Stufen als `erreicht: true` dazu. Neu erreichte Stufen werden beim Lesen idempotent
 * persistiert (`findOrCreate`, eindeutig je Nutzer + Schlüssel) — Bestand wird damit rückwirkend
 * befüllt (#1362-Muster), keine Migration. Die Server-Zeitzone dient als Fallback (kein
 * Zeitzonen-Feld am `User`); im Pass-Through-Modus (`userId` `undefined`) bleibt es bei der
 * reinen Berechnung — ohne Besitzer gibt es keinen Stand zum Persistieren (Muster `ownerScope`).
 */
export const meilensteinStandVon = async (userId: number | undefined, zeitZone?: string): Promise<Meilenstein[]> => {
	const entries = await ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] });
	const zone = zeitZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	const { best } = berechneStreak(
		streakZeitpunkte(
			entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
			zone,
		),
		new Date(),
		zone,
	);
	const punkteSumme = entries.reduce((summe, entry) => summe + entry.punkte, 0);
	const stand = berechneMeilensteine({ bestStreak: best, punkteSumme });
	if (userId === undefined) {
		return stand;
	}

	// Sequentiell statt `Promise.all`: `findOrCreate` eröffnet je Aufruf eine Transaktion, die sich
	// auf einer gemeinsamen SQLite-Verbindung (Testbetrieb, `pool.max = 1`) überlagern kann.
	for (const meilenstein of stand) {
		if (!meilenstein.erreicht) continue;
		await MilestoneReached.findOrCreate({
			where: { userId, schluessel: meilenstein.schluessel },
			defaults: { userId, schluessel: meilenstein.schluessel, zeitpunkt: new Date() },
		});
	}

	const gespeichert = new Set((await MilestoneReached.findAll({ where: { userId } })).map((zeile) => zeile.schluessel));
	return stand.map((meilenstein) =>
		gespeichert.has(meilenstein.schluessel) ? { ...meilenstein, erreicht: true } : meilenstein,
	);
};
