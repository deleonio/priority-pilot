import type { Pillar, PillarSuggestion, Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';

/** Soll-Summe der Anteile/Gewichte über alle Säulen (100 %-Verteilung; siehe Server-Vertrag). */
export const SHARE_TOTAL = 100;

/**
 * Mindestanteil einer Säule in Prozent. Die fünf Säulen sind fest (#1573) und jede Aufgabe zahlt
 * auf jede von ihnen ein — nur unterschiedlich stark. Deshalb lässt sich keine Säule auf 0 ziehen;
 * sie bleibt mit einem kleinen Anteil dabei.
 */
export const SHARE_MIN = 5;

/** Schrittweite der Verteilungs-Regler in Prozent. */
export const SHARE_STEP = 1;

/**
 * Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). Spiegelt die
 * serverseitige Toleranz in `server/src/express/routes/pillars.ts`.
 */
const WEIGHT_SUM_EPSILON = 1e-6;

/** Begrenzt einen Wert auf das Intervall `[min, max]`. */
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Obergrenze eines einzelnen Reglers: Was übrig bleibt, wenn alle anderen Säulen auf dem
 * Mindestanteil stehen (bei fünf Säulen 80 %). Bei höchstens einer Säule sind es 100 %.
 */
export const shareMax = (count: number): number => (count <= 1 ? SHARE_TOTAL : SHARE_TOTAL - (count - 1) * SHARE_MIN);

/**
 * Rundet eine exakte (gebrochene) Verteilung auf Ganzzahlen, deren Summe **exakt** `SHARE_TOTAL`
 * ergibt — Largest-Remainder-Verfahren (Hamilton): erst abrunden, dann die fehlenden Ganzanteile
 * an die Einträge mit dem größten Nachkomma-Rest vergeben. Ein naives „abrunden + Rest auf den
 * letzten Eintrag" könnte dagegen einen negativen Rest erzeugen.
 *
 * Liegt jeder Eingabewert ≥ `SHARE_MIN`, gilt das auch für das Ergebnis (Abrunden eines Werts
 * ≥ 5,0 bleibt ≥ 5). Der Aufrufer stellt sicher, dass die Eingabe-Summe bereits `SHARE_TOTAL`
 * ergibt; nur die Rundungsreste werden hier verteilt.
 *
 * `tieBreak` entscheidet bei gleichem Nachkomma-Rest, wer den Ganzanteil bekommt: der Eintrag mit
 * dem **kleinsten** Wert dort. Beim Reglerzug sind das die aktuellen Anteile — so wandert das
 * freiwerdende Prozent reihum an die jeweils kleinste Säule, statt bei jedem Zug dieselbe zu
 * mästen. Ohne Angabe entscheidet die Reihenfolge.
 */
const roundSharesToTotal = (exact: readonly number[], tieBreak?: readonly number[]): number[] => {
	const shares = exact.map((value) => Math.floor(value));
	let remainder = SHARE_TOTAL - shares.reduce((acc, share) => acc + share, 0);
	const byRemainderDesc = exact
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction || (tieBreak?.[a.index] ?? 0) - (tieBreak?.[b.index] ?? 0));
	for (const { index } of byRemainderDesc) {
		if (remainder <= 0) {
			break;
		}
		shares[index] += 1;
		remainder -= 1;
	}
	return shares;
};

/** Gleichverteilung über `count` Säulen: ganzzahlig, Summe exakt 100 (5 → `[20, 20, 20, 20, 20]`). */
export const evenShares = (count: number): number[] =>
	count <= 0 ? [] : roundSharesToTotal(new Array<number>(count).fill(SHARE_TOTAL / count));

/**
 * Bringt eine beliebige Vorgabe (`base`, z. B. gespeicherte Anteile oder KI-Konfidenzen) auf eine
 * gültige Verteilung: Summe exakt `SHARE_TOTAL`, jeder Anteil ≥ `SHARE_MIN`, Verhältnisse der
 * Vorgabe so weit wie möglich erhalten.
 *
 * Verfahren („Auffüllen"): Die Vorgabe wird proportional auf 100 % skaliert; Einträge, die dabei
 * unter den Mindestanteil rutschen (auch 0-Einträge), werden dort **festgesetzt** und der Rest wird
 * unter den verbleibenden neu verteilt — bis keiner mehr unter den Mindestanteil fällt. Eine
 * Vorgabe, die bereits gültig ist, bleibt damit unverändert. Ohne verwertbare Vorgabe (alles 0)
 * ergibt sich die Gleichverteilung.
 */
const distributeWithMinimum = (base: readonly number[]): number[] => {
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

/**
 * Setzt den Regler `index` auf `next` und zieht die übrigen Säulen nach, sodass die Summe wieder
 * exakt `SHARE_TOTAL` ergibt (#1596). `next` wird auf `[SHARE_MIN, shareMax(n)]` geklemmt und exakt
 * übernommen; der Rest (`100 − next`) geht an die anderen Säulen, und zwar je nach Richtung:
 *
 * - **hochgezogen** (die anderen müssen abgeben): proportional zu ihrer freien Masse über dem
 *   Mindestanteil (`sᵢ − SHARE_MIN`). So bleiben ihre Verhältnisse erhalten und keine fällt unter
 *   den Mindestanteil. Ist dort nichts mehr frei (alle am Mindestanteil), wird gleichmäßig verteilt.
 * - **heruntergezogen** (es ist etwas zu verteilen): zu gleichen Teilen. Proportional wäre hier
 *   tückisch — stünden alle anderen am Mindestanteil, bekäme die erste, die durch die Rundung ein
 *   Prozent abbekommt, auch jedes weitere.
 *
 * Ergebnis: ganzzahlige Anteile, jeder ≥ `SHARE_MIN`, Summe exakt `SHARE_TOTAL`.
 */
export const redistributeShares = (shares: readonly number[], index: number, next: number): number[] => {
	if (shares.length === 0 || index < 0 || index >= shares.length) {
		return [...shares];
	}
	if (shares.length === 1) {
		return [SHARE_TOTAL];
	}
	const target = clamp(Math.round(next), SHARE_MIN, shareMax(shares.length));
	const others = shares.filter((_share, position) => position !== index);
	const gain = shares[index] - target;
	const pool = SHARE_TOTAL - target - others.length * SHARE_MIN;
	const totalFree = others.reduce((acc, share) => acc + Math.max(share - SHARE_MIN, 0), 0);
	const exact = shares.map((share, position) => {
		if (position === index) {
			return target;
		}
		if (gain > 0) {
			return share + gain / others.length;
		}
		const free = Math.max(share - SHARE_MIN, 0);
		const portion = totalFree > 0 ? (free / totalFree) * pool : pool / others.length;
		return SHARE_MIN + portion;
	});
	// Der gezogene Regler muss exakt auf seinem Wert bleiben; gerundet werden nur die anderen.
	const roundedOthers = roundSharesToTotal(
		exact.map((value, position) => (position === index ? target : value)),
		shares,
	);
	roundedOthers[index] = target;
	return roundedOthers;
};

/**
 * Macht aus den vorhandenen Beiträgen einer Aufgabe/Serie eine **vollständige** Verteilung über
 * alle Säulen (#1596, `distributeWithMinimum`): Ohne Beitrag ergibt sich die Gleichverteilung;
 * fehlende Säulen bekommen den Mindestanteil, die vorhandenen Anteile werden proportional auf den
 * verbleibenden Rest gestaucht. Eine bereits gültige Verteilung bleibt unverändert. Die
 * `confidence` bestehender Beiträge bleibt erhalten, neue bekommen 100.
 *
 * Die Reihenfolge folgt der übergebenen Säulenliste (`GET /pillars`, nach id). Gespeichert wird das
 * Ergebnis erst mit dem nächsten Speichern der Aufgabe.
 */
export const fillContributions = (
	pillars: readonly Pillar[],
	existing: readonly TaskPillarContribution[],
): TaskPillarContribution[] => {
	if (pillars.length === 0) {
		return [];
	}
	const byId = new Map(existing.map((entry) => [entry.pillarId, entry]));
	const shares = distributeWithMinimum(pillars.map((pillar) => byId.get(pillar.id)?.share ?? 0));
	return pillars.map((pillar, index) => ({
		pillarId: pillar.id,
		share: shares[index],
		confidence: byId.get(pillar.id)?.confidence ?? 100,
	}));
};

/**
 * Prüft, ob eine Verteilung **stark unausgewogen** ist (#1555): der Anteil einer Säule an der
 * Gesamtsumme liegt strikt über dem **Doppelten** oder strikt unter der **Hälfte** des
 * gleichmäßigen Anteils `1/n`. Exakt 2× bzw. exakt ½ gelten noch als ausgewogen (Float-Toleranz
 * wie beim Summenvergleich). Die Prüfung ist skaleninvariant, denn nur die Anteile zählen.
 *
 * Summe ≤ 0 → `false`. Rein informativ — der Aufrufer blockiert daraus nichts (Speichern bleibt
 * möglich).
 */
export const isDistributionUnbalanced = (shares: readonly number[]): boolean => {
	if (shares.length === 0) {
		return false;
	}
	const total = shares.reduce((acc, share) => acc + share, 0);
	if (total <= 0) {
		return false;
	}
	const evenShare = 1 / shares.length;
	return shares.some((value) => {
		const share = value / total;
		return share > 2 * evenShare + WEIGHT_SUM_EPSILON || share < 0.5 * evenShare - WEIGHT_SUM_EPSILON;
	});
};

/**
 * Wandelt KI-Vorschläge (`pillarId` + Konfidenz) in eine vollständige Verteilung über **alle**
 * Säulen um (#1596) — auch die nicht vorgeschlagenen sind dabei, sie bekommen den Mindestanteil.
 *
 * - Nur Vorschläge zu **bekannten** Säulen mit **positiver** Konfidenz wirken auf die Verteilung —
 *   der Server kann theoretisch unbekannte IDs oder 0 %-Säulen liefern.
 * - Die Anteile verteilen sich **proportional zur Konfidenz** (`distributeWithMinimum`): nicht
 *   vorgeschlagene Säulen landen beim Mindestanteil, ohne verwertbaren Vorschlag ergibt sich die
 *   Gleichverteilung. Die Anteile sind ganzzahlig und summieren sich exakt auf `SHARE_TOTAL`.
 * - Die Konfidenz wird auf `[0, 100]` geklemmt und gerundet; Säulen ohne Vorschlag bekommen 100
 *   (Default des Servers, siehe `server/src/logics/pillarContributions.ts`).
 *
 * Das Ergebnis ist ein Vorschlag, den der Nutzer vor dem Speichern weiter **korrigieren** kann.
 */
export const suggestionsToContributions = (
	suggestions: readonly PillarSuggestion[],
	pillars: readonly Pillar[],
): TaskPillarContribution[] => {
	if (pillars.length === 0) {
		return [];
	}
	const byId = new Map(
		suggestions.filter((entry) => entry.confidence > 0).map((entry) => [entry.pillarId, entry.confidence]),
	);
	const shares = distributeWithMinimum(pillars.map((pillar) => byId.get(pillar.id) ?? 0));
	return pillars.map((pillar, index) => ({
		pillarId: pillar.id,
		share: shares[index],
		confidence: byId.has(pillar.id) ? Math.round(clamp(byId.get(pillar.id) ?? 0, 0, 100)) : 100,
	}));
};

/** Kennzahlen einer Säule für das Dashboard-Widget „Meine Themen". */
interface PillarSummary {
	pillar: Pillar;
	/** Anzahl der Tasks, die (mit einem Beitrag) auf diese Säule einzahlen. */
	taskCount: number;
	/** Anzahl der **offenen** Tasks (`Open`/`In process`), die auf diese Säule einzahlen (#124). */
	openCount: number;
	/** Anzahl der **erledigten** Tasks (`Done`), die auf diese Säule einzahlen (#124). */
	doneCount: number;
	/** Anteilig (nach `share`) auf diese Säule entfallender geschätzter Eigenaufwand (Tage). */
	totalEstimatedEffort: number;
	/** Anteiliger geschätzter Eigenaufwand der **offenen** Tasks (`Open`/`In process`) je Säule (#124). */
	openEstimatedEffort: number;
	/** Anteiliger geschätzter Eigenaufwand der **erledigten** Tasks (`Done`) je Säule (#124). */
	doneEstimatedEffort: number;
	/** Ist-Anteil dieser Säule am gesamten erledigten Aufwand (0–1; 0 wenn keine Done-Tasks). */
	actualShare: number;
	/**
	 * Anteilig (nach `share`) auf diese Säule entfallende Summe der Wertbeiträge. Die Werte stammen aus
	 * dem Aufgabenwald (`valueByTaskId`), der nur offene/in Arbeit befindliche Tasks enthält —
	 * `Done`-Tasks tragen daher 0 bei.
	 */
	totalValue: number;
}

/**
 * Aggregiert je Säule die einzahlenden Tasks zu Anzahl, Gesamtaufwand und Gesamtwert — Datenbasis
 * für das Dashboard-Widget „Meine Themen". Da ein Task seinen Anteil (`share`) auf mehrere Säulen
 * verteilt, werden Aufwand und Wert **anteilig** (nach `share / 100`) auf die Säulen aufgeteilt; die
 * Anteile eines Tasks summieren sich so wieder zu seinem Gesamtaufwand bzw. -wert. `valueByTaskId`
 * liefert den Wertbeitrag je Task (siehe `collectTaskValues`); fehlt ein Task dort (z. B. `Done`),
 * zählt sein Wert als 0. `taskCount` zählt jeden einzahlenden Task einfach. Zusätzlich wird je Säule
 * nach Status aufgeschlüsselt (#124): offen (`Open`/`In process`) vs. erledigt (`Done`) — sowohl für
 * die Anzahl (`openCount`/`doneCount`) als auch für den anteiligen Aufwand
 * (`openEstimatedEffort`/`doneEstimatedEffort`). Da die Aufteilung nur die einzahlenden Tasks
 * partitioniert, gilt je Säule `openCount + doneCount = taskCount` und
 * `openEstimatedEffort + doneEstimatedEffort = totalEstimatedEffort`. Die Reihenfolge der Säulen
 * bleibt erhalten.
 *
 * Zusätzlich wird je Säule der **Ist-Anteil** (`actualShare`) am gesamten erledigten Aufwand über
 * alle Säulen berechnet (#219): `doneEstimatedEffort / Σ doneEstimatedEffort`. Gibt es keinen
 * erledigten Aufwand (`Σ = 0`), ist der Anteil für jede Säule `0` (kein `NaN`). Bei mindestens
 * einem Done-Task summieren sich die Anteile über alle Säulen zu 1; jeder Anteil liegt in `[0, 1]`.
 */
export const buildPillarSummaries = (
	pillars: Pillar[],
	tasks: Task[],
	valueByTaskId: ReadonlyMap<number, number>,
): PillarSummary[] => {
	const summaries: PillarSummary[] = pillars.map((pillar) => {
		let taskCount = 0;
		let openCount = 0;
		let doneCount = 0;
		let totalEstimatedEffort = 0;
		let openEstimatedEffort = 0;
		let doneEstimatedEffort = 0;
		let totalValue = 0;
		for (const task of tasks) {
			const contribution = task.pillars.find((entry) => entry.pillarId === pillar.id);
			if (contribution === undefined) {
				continue;
			}
			const shareFraction = contribution.share / SHARE_TOTAL;
			const effort = task.estimatedEffort * shareFraction;
			const isDone = task.status === TaskStatus.Done;
			taskCount += 1;
			totalEstimatedEffort += effort;
			totalValue += (valueByTaskId.get(task.id) ?? 0) * shareFraction;
			if (isDone) {
				doneCount += 1;
				doneEstimatedEffort += effort;
			} else {
				openCount += 1;
				openEstimatedEffort += effort;
			}
		}
		return {
			pillar,
			taskCount,
			openCount,
			doneCount,
			totalEstimatedEffort,
			openEstimatedEffort,
			doneEstimatedEffort,
			actualShare: 0,
			totalValue,
		};
	});
	const totalDoneEffort = summaries.reduce((acc, summary) => acc + summary.doneEstimatedEffort, 0);
	for (const summary of summaries) {
		summary.actualShare = totalDoneEffort === 0 ? 0 : summary.doneEstimatedEffort / totalDoneEffort;
	}
	return summaries;
};

/**
 * Punkte je Säule für einen **einzelnen** Task (#228, AK-2): der geschätzte Eigenaufwand wird nach
 * dem `share` anteilig (`estimatedEffort × share / 100`) auf die Säulen verteilt. Fehlt zu einer
 * Säule ein Beitrag oder ist ihr `share = 0`, ergibt sich `0` (nie `NaN`). Gibt eine Map von
 * `pillarId` → Punkte zurück (ein Eintrag je übergebener Säule, Reihenfolge der `pillars` egal).
 */
export const getTaskPillarPoints = (task: Task, pillars: Pillar[]): Map<number, number> => {
	const points = new Map<number, number>();
	for (const pillar of pillars) {
		const contribution = task.pillars.find((entry) => entry.pillarId === pillar.id);
		const share = contribution?.share ?? 0;
		points.set(pillar.id, task.estimatedEffort * (share / SHARE_TOTAL));
	}
	return points;
};

/**
 * Berechnet den niedrigen Schwellwert für das Säulen-Meter (Issue #410).
 *
 * - Werte < 75% des Zielwerts gelten als "suboptimal"
 * - Werte >= 75% und < 100% gelten als "neutral"
 * - Werte >= 100% gelten als "optimal"
 *
 * @param target - Der Zielwert als Prozent (0-100), z.B. 20 für 20%
 * @returns Der niedrige Schwellwert (75% des Zielwerts) als Dezimalbruch (0-1), z.B. 0.15 für 15%
 */
export const calculateMeterThreshold = (target: number): number => (target * 0.75) / SHARE_TOTAL;

/**
 * Berechnet den hohen Schwellwert (100% des Zielwerts) für das Säulen-Meter (Issue #410).
 *
 * @param target - Der Zielwert als Prozent (0-100), z.B. 20 für 20%
 * @returns Der mittlere Schwellwert (100% des Zielwerts) als Dezimalbruch (0-1), z.B. 0.20 für 20%
 */
export const calculateMeterHighThreshold = (target: number): number => target / SHARE_TOTAL;
