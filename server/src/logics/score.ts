/**
 * Gamification-Scoring (Konzept §4.4) — bewusst getrennt vom Wertbeitrag (`value.ts`).
 *
 * Beim Erledigen eines Tasks werden Punkte vergeben: pünktlich (vor/zur Deadline oder ganz ohne
 * Deadline) ⇒ volle Punktzahl; verspätet (nach der Deadline) ⇒ reduzierte Punktzahl (echt < voll,
 * aber >= 0). Die genaue Abschlagskurve ist in §11 bewusst offen gehalten; hier ein fester Faktor —
 * eine spätere Iteration darf ihn verfeinern (invers-exponentiell nach Reihenfolge-Abweichung o. Ä.).
 */

/** Reduktionsfaktor für verspätete Erledigung (echt < 1, > 0 ⇒ Punkte bleiben positiv). */
const VERSPAETET_FAKTOR = 0.5;

/** Voller Basiswert, wenn kein aufgabenspezifischer Basiswert übergeben wird (reine Kurven-Tests). */
const VOLLER_BASISWERT = 1;

/** `share` ist ein Prozentwert (0–100); hier auf einen Bruchteil (0–1) normiert. */
const PERCENT = 100;

export interface ScoreErgebnis {
	punkte: number;
	pünktlich: boolean;
}

/**
 * Punkte für die Erledigung eines Tasks. `basisPunkte` ist der volle Wert bei pünktlicher
 * Erledigung — die API reicht hier den Basis-Value `estimatedEffort × priority` hinein
 * (Owner-Vorgabe), Default `1` für die reinen Kurven-Tests. Pünktlich = keine Deadline ODER
 * `erledigtAm <= deadline` (inkl. Grenze); sonst verspätet mit `basisPunkte × VERSPAETET_FAKTOR`.
 */
export const berechneScore = (
	deadline: Date | null,
	erledigtAm: Date,
	basisPunkte: number = VOLLER_BASISWERT,
): ScoreErgebnis => {
	const pünktlich = deadline === null || erledigtAm.getTime() <= deadline.getTime();
	return { punkte: pünktlich ? basisPunkte : basisPunkte * VERSPAETET_FAKTOR, pünktlich };
};

/** Anteiliger Säulen-Beitrag eines Tasks (`share` in Prozent, 0–100). */
export interface SaeulenBeitrag {
	pillarId: number;
	share: number;
}

/** Vergebene Punkte eines erledigten Tasks samt seiner Säulen-Anteile. */
export interface PunkteBeitrag {
	punkte: number;
	beitraege: SaeulenBeitrag[];
}

/**
 * Aggregiert die vergebenen Punkte anteilig (nach `share`) je Säule. Ein Task ohne Säulen-Beiträge
 * fließt in keine Säulen-Summe ein. Rückgabe: Map `pillarId → Summe der anteiligen Punkte`.
 */
export const aggregierePunkteProSaeule = (eintraege: PunkteBeitrag[]): Map<number, number> => {
	const summen = new Map<number, number>();
	for (const eintrag of eintraege) {
		for (const beitrag of eintrag.beitraege) {
			const anteil = eintrag.punkte * (beitrag.share / PERCENT);
			summen.set(beitrag.pillarId, (summen.get(beitrag.pillarId) ?? 0) + anteil);
		}
	}
	return summen;
};
