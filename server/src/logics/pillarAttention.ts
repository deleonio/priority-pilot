/**
 * Reine (DB-freie) Aggregation eines Aufmerksamkeits-Scores je Säule (#328/#337). Der Score fasst drei
 * Signale zusammen, die zusammen anzeigen, wie sehr eine Säule gerade „übersehen" wird:
 *
 *  (a) Relative Unterversorgung (#337): Anteil des Soll-Anteils, der fehlt:
 *        relativeUndersupply = clamp((weight/100 − actualShare) / (weight/100), 0, 1)
 *      Guard: weight=0 → relativeUndersupply=0 (keine Soll-Vorgabe → kein Unterversorgungs-Signal).
 *      Beispiele bei Standard-Gewichtung (5×20 %):
 *        actualShare=0     → relUndersupply=1,0 → Beitrag 0,4  (früher absolut: max. 0,08)
 *        actualShare=0,10  → relUndersupply=0,5 → Beitrag 0,2
 *        actualShare≥0,20  → relUndersupply=0   → Beitrag 0,0 (kein Rauschen)
 *      Skalierungsunabhängig: weight=20/actualShare=0,10 und weight=40/actualShare=0,20 ergeben
 *      beide relUndersupply=0,5, d. h. gleiche relative Unterversorgung → gleicher Score.
 *  (b) Anteil offener Aufgaben: viele offene Tasks (relativ zu erledigten) ziehen Aufmerksamkeit
 *      auf sich.
 *  (c) Staleness: Abstand `now − updatedAt`. Je länger eine Säule nicht mehr bewegt wurde, desto
 *      höher der Score.
 *
 * Gewichtung/Schwelle unverändert: 0,4/0,3/0,3, NEGLECTED_SCORE_THRESHOLD=0,5.
 * Kontrollrechnung (AK1): weight=20, actualShare=0, ~5 Monate alt →
 *   score = 1,0·0,4 + 0·0,3 + 0,663·0,3 ≈ 0,599 > 0,5  (früher 0,279 < 0,5).
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
		const soll = pillar.weight / 100;
		const relativeUndersupply = soll === 0 ? 0 : Math.min(1, Math.max(0, (soll - pillar.actualShare) / soll));
		const openRatio = pillar.openCount / (pillar.openCount + pillar.doneCount + 1);
		const stalenessDays = (now.getTime() - pillar.updatedAt.getTime()) / MILLIS_PER_DAY;
		const staleness = Math.min(1, Math.max(0, stalenessDays) / STALENESS_HORIZON_DAYS);
		const score = relativeUndersupply * 0.4 + openRatio * 0.3 + staleness * 0.3;
		return { pillarId: pillar.pillarId, score };
	});
}
