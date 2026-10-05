/**
 * Aggregationslogik der Journal-Statistik (#2213): zählt Journal-Einträge je Säule, ohne Säule
 * und gesamt über Tages- bzw. Wochenfenster. Reine Funktion ohne DB-Zugriff (Muster
 * `balanceHistory.ts`); die Route (`routes/journal.ts`) lädt Einträge und Säulen und reicht sie
 * herein. Wochenfenster beginnen montags, Randwochen sind auf den Zeitraum geschnitten — so
 * stimmen Wochen- mit Tagessummen überein.
 */

export type JournalStatsGranularitaet = 'tag' | 'woche';

/** Ein Zählfenster der Statistik: `von`…`bis` als `YYYY-MM-DD` (jeweils inklusive). */
export interface JournalStatsFensterEingabe {
	von: string;
	bis: string;
}

/** Zählergebnis eines Fensters: je Säule (alle, auch mit 0), ohne Säule und gesamt. */
export interface JournalStatsFenster extends JournalStatsFensterEingabe {
	proSaeule: { pillarId: number; anzahl: number }[];
	ohneSaeule: number;
	gesamt: number;
}

/** Millisekunden eines Kalendertages (UTC-Zivilrechnung, Muster `balanceHistory.ts`). */
const TAG_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` als UTC-Zeitstempel seiner Mitternacht — nur für Tagesabstände, keine Uhrzeit. */
const alsZeitstempel = (tag: string): number => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
	return Date.UTC(jahr, monat - 1, tagImMonat);
};

const alsTag = (zeitstempel: number): string => new Date(zeitstempel).toISOString().slice(0, 10);

/**
 * Liste der Zählfenster über `[von, bis]` (aufsteigend): bei `tag` je Kalendertag ein Fenster,
 * bei `woche` Kalenderwochen mit Montag-Beginn — die erste und letzte Woche sind auf den
 * angefragten Zeitraum geschnitten, damit Summen mit den Tageswerten übereinstimmen.
 */
export const fensterListe = (
	von: string,
	bis: string,
	granularitaet: JournalStatsGranularitaet,
): JournalStatsFensterEingabe[] => {
	const fenster: JournalStatsFensterEingabe[] = [];
	let aktuelle: JournalStatsFensterEingabe | null = null;
	for (let zeitstempel = alsZeitstempel(von); zeitstempel <= alsZeitstempel(bis); zeitstempel += TAG_MS) {
		const tag = alsTag(zeitstempel);
		if (granularitaet === 'tag') {
			fenster.push({ von: tag, bis: tag });
			continue;
		}
		// Neues Wochenfenster am ersten Tag und jedem Montag (`getUTCDay` 1 = Montag).
		if (aktuelle === null || new Date(zeitstempel).getUTCDay() === 1) {
			if (aktuelle !== null) fenster.push(aktuelle);
			aktuelle = { von: tag, bis: tag };
		} else {
			aktuelle.bis = tag;
		}
	}
	if (aktuelle !== null) fenster.push(aktuelle);
	return fenster;
};

/**
 * Zählt die Einträge je Fenster: `proSaeule` listet alle gegebenen Säulen (auch mit 0,
 * aufsteigend wie übergeben), Einträge außerhalb der Fenster zählen nicht.
 */
export const berechneJournalFenster = (
	eintraege: { date: string; pillarId: number | null }[],
	saeulenIds: number[],
	fenster: JournalStatsFensterEingabe[],
): JournalStatsFenster[] =>
	fenster.map(({ von, bis }) => {
		const imFenster = eintraege.filter((eintrag) => eintrag.date >= von && eintrag.date <= bis);
		return {
			von,
			bis,
			proSaeule: saeulenIds.map((pillarId) => ({
				pillarId,
				anzahl: imFenster.filter((eintrag) => eintrag.pillarId === pillarId).length,
			})),
			ohneSaeule: imFenster.filter((eintrag) => eintrag.pillarId === null).length,
			gesamt: imFenster.length,
		};
	});
