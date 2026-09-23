/**
 * Verlauf der Lebensbalance (#1424) — `berechneBalanceVerlauf` rekonstruiert den Tagesverlauf des
 * Dashboard-Herzens aus den Erledigungszeitpunkten (`ScoreEntry.zeitpunkt`), indem `berechneLebensbalanceNachKadenz`
 * (heartBalance.ts, Kadenz-Modell #1638) je Kalendertag über die bis dahin kumulierte Teilmenge der erledigten
 * Tasks läuft — mit dem Tagesende als „jetzt" (für heute: der echte Zeitpunkt, Parität mit `/scores/balance`).
 *
 * Reine Funktion ohne DB-Zugriff — die Route (`routes/scores.ts`) lädt Säulen/Tasks/ScoreEntries und
 * reicht sie herein. Die Tagesgrenze folgt exakt `tagIn` aus `streak.ts` (Fallstrick #1424: eine
 * abweichende Zeitzonen-Logik würde den Paritäts-AK4-Vergleich mit `/scores/balance` sprengen).
 */
import { berechneLebensbalanceNachKadenz, type BalanceSaeule } from './heartBalance.js';
import { tagIn } from './streak.js';

/** Ein Task für die Verlaufsrechnung: `zeitpunkt: null` = Done-Task ohne ScoreEntry, zählt ab Zeitraumbeginn. */
export interface BalanceHistoryTask {
	status: string;
	estimatedEffort: number;
	pillars: { pillarId: number; share: number }[];
	zeitpunkt: Date | null;
}

/** Punktestand einer Säule zum Ende eines Tages, wie ihn die Antwort ausweist. */
interface BalanceHistorySaeulenStand {
	id: number;
	name: string;
	punkte: number;
	gewichtung: number;
}

/** Ein Tages-Eintrag des Verlaufs. */
export interface BalanceHistoryEintrag {
	tag: string;
	fuellstandProzent: number;
	hatPunkte: boolean;
	saeulen: BalanceHistorySaeulenStand[];
}

/** Millisekunden eines Kalendertages (UTC-Zivilrechnung, für die Tagesliste `von`…`bis`). */
const TAG_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` als UTC-Zeitstempel seiner Mitternacht — nur für Tagesabstände, keine Uhrzeit. */
const alsZeitstempel = (tag: string): number => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
	return Date.UTC(jahr, monat - 1, tagImMonat);
};

const DATUM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Ob `wert` ein `YYYY-MM-DD`-String ist, der ein tatsächlich existierendes Kalenderdatum benennt. */
export const istGueltigesDatum = (wert: string): boolean => {
	if (!DATUM_REGEX.test(wert)) return false;
	const [jahr, monat, tagImMonat] = wert.split('-').map(Number);
	const datum = new Date(Date.UTC(jahr, monat - 1, tagImMonat));
	return datum.getUTCFullYear() === jahr && datum.getUTCMonth() === monat - 1 && datum.getUTCDate() === tagImMonat;
};

/** Länge des geschlossenen Intervalls `[von, bis]` in Tagen (0, wenn `von === bis`). */
export const zeitraumInTagen = (von: string, bis: string): number =>
	(alsZeitstempel(bis) - alsZeitstempel(von)) / TAG_MS;

/**
 * Verlauf der Lebensbalance über `[von, bis]` (je ein Eintrag pro Kalendertag, aufsteigend).
 *
 * Je Tag `t` wird die Teilmenge der `Done`-Tasks gebildet, deren Erledigung bis Ende `t` liegt
 * (`zeitpunkt === null`, oder ihr Kalendertag in `zeitZone` ≤ `t`), und `berechneLebensbalanceNachKadenz`
 * darüber gerechnet — `punkte` kumulierend, der Füllstand über das 28-Tage-Fenster bis Tagesende `t`
 * (UTC; der heutige Tag in `zeitZone` endet bei `jetzt`).
 */
export const berechneBalanceVerlauf = (
	saeulen: BalanceSaeule[],
	tasks: BalanceHistoryTask[],
	von: string,
	bis: string,
	zeitZone: string,
	jetzt: Date = new Date(),
): BalanceHistoryEintrag[] => {
	const heute = tagIn(jetzt, zeitZone);
	const erledigt = tasks.filter((task) => task.status === 'Done');
	const tage: string[] = [];
	for (let zeitstempel = alsZeitstempel(von); zeitstempel <= alsZeitstempel(bis); zeitstempel += TAG_MS) {
		tage.push(new Date(zeitstempel).toISOString().slice(0, 10));
	}

	return tage.map((tag) => {
		const teilmenge = erledigt.filter((task) => task.zeitpunkt === null || tagIn(task.zeitpunkt, zeitZone) <= tag);
		const tagesende = tag === heute ? jetzt : new Date(alsZeitstempel(tag) + TAG_MS - 1);
		const balance = berechneLebensbalanceNachKadenz(
			saeulen,
			teilmenge.map((task) => ({ ...task, erledigtAm: task.zeitpunkt })),
			tagesende,
		);
		return {
			tag,
			// Eine Dezimalstelle wie `/scores/balance` — sonst weicht der AK4-Paritätsvergleich an
			// Fließkomma-Rauschen ab.
			fuellstandProzent: Math.round(balance.fill * 1000) / 10,
			hatPunkte: balance.hasPoints,
			saeulen: balance.saeulen,
		};
	});
};
