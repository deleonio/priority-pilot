/**
 * Reine (DB-freie) Aggregation eines Aufmerksamkeits-Scores je Säule (#328). Der Score fasst drei
 * Signale zusammen, die zusammen anzeigen, wie sehr eine Säule gerade „übersehen" wird:
 *
 *  (a) Unterversorgung: Abweichung `weight` (Soll-Anteil, 0–100) gegen `actualShare` (Ist-Anteil,
 *      0–1). Je stärker eine Säule unter ihrem Soll bedient wird, desto höher der Score.
 *  (b) Anteil offener Aufgaben: viele offene Tasks (relativ zu erledigten) ziehen Aufmerksamkeit
 *      auf sich.
 *  (c) Staleness: Abstand `now − updatedAt`. Je länger eine Säule nicht mehr bewegt wurde, desto
 *      höher der Score.
 *
 * Die Funktion ist bewusst injizierbar gehalten (nimmt einfache Werte, kein DB-Zugriff), damit der
 * Advisor-Endpoint sie mit aggregierten Kennzahlen füttern und ohne echte DB testen kann.
 */

/** Aggregierte Eingabe-Kennzahlen je Säule für die Score-Berechnung. */
export interface PillarAttentionInput {
	pillarId: number;
	/** Soll-Anteil der Säule in Prozent (0–100). */
	weight: number;
	/** Ist-Anteil der Säule an der Gesamt-Investition (0–1). */
	actualShare: number;
	/** Anzahl offener Aufgaben (Status „Open" / „In process"). */
	openCount: number;
	/** Anzahl erledigter Aufgaben (Status „Done"). */
	doneCount: number;
	/** Zeitpunkt der letzten Bewegung der Säule (jüngstes Task-`updatedAt` bzw. Pillar-Fallback). */
	updatedAt: Date;
}

const MILLIS_PER_DAY = 86_400_000;
/** Staleness wird über ein Jahr auf [0,1] normalisiert (älter als ein Jahr ⇒ maximal veraltet). */
const STALENESS_HORIZON_DAYS = 365;

/**
 * Berechnet je Eingabe-Säule einen Aufmerksamkeits-Score in [0,1]. Rückgabe ist je Eingabe-Säule
 * genau ein Eintrag `{ pillarId, score }` (Reihenfolge wie in der Eingabe).
 */
export function calculatePillarAttention(
	pillars: PillarAttentionInput[],
	now: Date,
): { pillarId: number; score: number }[] {
	return pillars.map((pillar) => {
		const undersupply = Math.max(0, pillar.weight / 100 - pillar.actualShare);
		const openRatio = pillar.openCount / (pillar.openCount + pillar.doneCount + 1);
		const stalenessDays = (now.getTime() - pillar.updatedAt.getTime()) / MILLIS_PER_DAY;
		const staleness = Math.min(1, Math.max(0, stalenessDays) / STALENESS_HORIZON_DAYS);
		const score = undersupply * 0.4 + openRatio * 0.3 + staleness * 0.3;
		return { pillarId: pillar.pillarId, score };
	});
}
