/**
 * Verteilung von Säulen-Anteilen mit Mindestanteil (#1635) — Portierung von
 * `frontend/src/lib/pillar.ts` (`SHARE_MIN`, `roundSharesToTotal`, `distributeWithMinimum`, #1596).
 *
 * Invariante: Für dieselbe Eingabe liefern Server und Frontend dieselben Anteile. Beim Anlegen einer
 * Aufgabe verteilt das Frontend KI-Vorschläge mit dieser Regel; die serverseitige Neuberechnung
 * (`reassignTaskPillars.ts`) muss dieselbe Regel anwenden. Vorher gab sie nicht vorgeschlagenen
 * Säulen 0 % und drückte damit „Sinn“ in der Lebensbalance unter den Mindestanteil (#1601).
 * Wer hier etwas ändert, ändert es auch im Frontend.
 */

/** Soll-Summe der Anteile über alle Säulen. */
export const SHARE_TOTAL = 100;

/**
 * Mindestanteil einer Säule in Prozent. Jede Aufgabe zahlt auf jede Säule ein — nur unterschiedlich
 * stark. Deshalb lässt sich keine Säule auf 0 ziehen.
 */
export const SHARE_MIN = 5;

/**
 * Rundet eine exakte Verteilung auf Ganzzahlen mit Summe exakt `SHARE_TOTAL` (Largest-Remainder).
 * Bei gleichem Nachkomma-Rest entscheidet die Reihenfolge.
 */
const roundSharesToTotal = (exact: readonly number[]): number[] => {
	const shares = exact.map((value) => Math.floor(value));
	let remainder = SHARE_TOTAL - shares.reduce((acc, share) => acc + share, 0);
	const byRemainderDesc = exact
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction);
	for (const { index } of byRemainderDesc) {
		if (remainder <= 0) {
			break;
		}
		shares[index] += 1;
		remainder -= 1;
	}
	return shares;
};

/** Gleichverteilung über `count` Säulen: ganzzahlig, Summe exakt 100. */
const evenShares = (count: number): number[] =>
	count <= 0 ? [] : roundSharesToTotal(new Array<number>(count).fill(SHARE_TOTAL / count));

/**
 * Bringt eine Vorgabe (z. B. KI-Konfidenzen) auf eine gültige Verteilung: Summe exakt
 * `SHARE_TOTAL`, jeder Anteil ≥ `SHARE_MIN`, Verhältnisse der Vorgabe so weit wie möglich erhalten.
 * Einträge, die beim proportionalen Skalieren unter den Mindestanteil rutschen (auch 0-Einträge),
 * werden dort festgesetzt, der Rest wird unter den übrigen neu verteilt. Ohne verwertbare Vorgabe
 * ergibt sich die Gleichverteilung.
 */
export const distributeWithMinimum = (base: readonly number[]): number[] => {
	const count = base.length;
	if (count === 0) {
		return [];
	}
	if (count === 1) {
		return [SHARE_TOTAL];
	}
	const atMinimum = base.map(() => false);
	for (;;) {
		const freeIndices = base.map((_value, index) => index).filter((index) => !atMinimum[index]);
		if (freeIndices.length === 0) {
			return evenShares(count);
		}
		const pool = SHARE_TOTAL - (count - freeIndices.length) * SHARE_MIN;
		const freeSum = freeIndices.reduce((acc, index) => acc + Math.max(base[index], 0), 0);
		const exact = base.map((value, index) => {
			if (atMinimum[index]) {
				return SHARE_MIN;
			}
			return freeSum > 0 ? (Math.max(value, 0) / freeSum) * pool : pool / freeIndices.length;
		});
		const below = freeIndices.filter((index) => exact[index] < SHARE_MIN);
		if (below.length === 0) {
			return roundSharesToTotal(exact);
		}
		for (const index of below) {
			atMinimum[index] = true;
		}
	}
};
