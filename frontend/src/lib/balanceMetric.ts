import type { BalanceModel } from './heartBalance';

/**
 * Die **eine** Kennzahl, die alle Balance-Bilder zeichnen.
 *
 * Je Säule ist das schlicht das Verhältnis **Ist zu Soll**: Wer bei 20 % Zielanteil 10 % seines
 * Aufwands dorthin gegeben hat, steht auf 0,5; wer 30 % gegeben hat, auf 1,5. Bewusst **nicht**
 * gedeckelt — dass eine Säule über ihr Ziel hinausschießt, ist genauso eine Aussage wie dass sie
 * zurückbleibt, und im Bild ist es der Unterschied zwischen „passt" und „frisst alles auf".
 *
 * **Warum das nicht `level` ist:** `level` in `heartBalance.ts` ist dasselbe Verhältnis, aber bei 1
 * gedeckelt — der Deckel gehört zur Balance-Rechnung (mehr als sein Soll zu erfüllen macht die
 * Verteilung nicht besser) und steht zahlengleich auch auf dem Server. Diese Datei rührt daran
 * nicht; sie liefert die ungedeckelte Schwester allein fürs Bild.
 *
 * **Warum eine gemeinsame Skala:** Alle Bilder sind Darstellungen derselben Zahlenreihe — sie
 * unterscheiden sich in der Form, nie im Inhalt. Die Normierung passiert deshalb hier, einmal, und
 * nicht in jeder Figur neu.
 */

/** Eine Säule, wie die Bilder sie sehen. */
export interface PillarMetric {
	pillarId: number;
	/** Nullbasierter Rang in der Säulen-Rampe, stabil gegen Umsortierung. */
	colorIndex: number;
	/** Ist ÷ Soll, ungedeckelt. 1 heißt „genau auf Ziel", 0 heißt „Säule ohne Ziel oder ohne Aufwand". */
	ratio: number;
	/** `ratio` auf die gemeinsame Skala normiert (0–1) — das Maß, das jede Figur direkt zeichnet. */
	scaled: number;
	/**
	 * Ist-Anteil an der Gesamtinvestition (0–1; Summe 1, sobald Punkte vergeben sind). Kein
	 * Konkurrenz-Maß zur Kennzahl, sondern eine Größe daneben: Die Figur „Segmente“ legt ihn
	 * als Winkelanteil aus — so breit wie der Anteil —, während ihre Füllung `scaled` zeigt.
	 */
	actualShare: number;
}

/** Was die Figuren brauchen: die Säulen und die Marke, an der „auf Ziel" liegt. */
export interface BalanceMetrics {
	/** Säulen in Anzeigereihenfolge. */
	pillars: PillarMetric[];
	/**
	 * Wo auf der Skala (0–1) das Soll liegt. Größer heißt „zieht davon", kleiner „kommt zu kurz" —
	 * jede Figur markiert diese Stelle, damit die Abweichung ohne Zahl ablesbar bleibt.
	 */
	targetMark: number;
	/** Oberes Ende der Skala als Verhältnis (≥ 1). */
	scale: number;
}

/**
 * Rechnet das Gesamtbild in die Kennzahlen um.
 *
 * Die Skala endet beim **größten vorkommenden Verhältnis** — so nutzt das Bild seinen Platz immer
 * aus, statt bei lauter kleinen Abweichungen im unteren Drittel zu kleben. Ihr Boden ist die 1: Wenn
 * alle Säulen unter ihrem Soll liegen, endet die Skala trotzdem beim Soll, sonst wanderte die
 * Soll-Marke an den Rand und „alle zu kurz" sähe aus wie „alle auf Ziel".
 *
 * Randfälle, bewusst festgelegt:
 * - **Säule ohne Ziel** (`weight: 0`, der Normalfall bei frisch angelegten Säulen) → Verhältnis 0.
 *   Ohne Ziel gibt es nichts zu erfüllen; die Figur zeigt sie auf ihrem Minimum, aber sie
 *   verschwindet nicht.
 * - **Keine Punkte vergeben** → alle Verhältnisse 0, Skala 1, Soll-Marke ganz außen: das leere Bild
 *   zeigt schon, wohin es gehen soll.
 */
export const balanceMetrics = (balance: BalanceModel): BalanceMetrics => {
	const pillars = balance.segments.map((segment) => ({
		pillarId: segment.pillar.id,
		colorIndex: segment.colorIndex,
		ratio: segment.targetShare > 0 ? segment.actualShare / segment.targetShare : 0,
		scaled: 0,
		actualShare: segment.actualShare,
	}));

	const scale = Math.max(1, ...pillars.map((pillar) => pillar.ratio));
	for (const pillar of pillars) pillar.scaled = pillar.ratio / scale;

	return { pillars, targetMark: 1 / scale, scale };
};
