import type { Pillar, PillarSuggestion, Task, TaskPillarContribution } from 'client';
import { formatNumber } from './task';

/**
 * Sentinel-Wert der „Säule hinzufügen"-Auswahl (Platzhalter-Option). Säulen-IDs sind serverseitig
 * `>= 1` (siehe `openapi.yml`), daher kollidiert `0` mit keiner echten Säule und steht eindeutig für
 * „noch keine Säule gewählt".
 */
export const ADD_PILLAR_PLACEHOLDER = 0;

/** Soll-Summe der Gewichte über alle Säulen (100 %-Verteilung; siehe Server-Vertrag). */
export const TOTAL_WEIGHT = 100;

/**
 * Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). Spiegelt die
 * serverseitige Toleranz in `server/src/express/routes/pillars.ts`.
 */
export const WEIGHT_SUM_EPSILON = 1e-6;

/**
 * Optionen für die „Säule hinzufügen"-Auswahl im Task-Formular: eine Platzhalter-Option (Sentinel
 * `ADD_PILLAR_PLACEHOLDER`) gefolgt von den noch **nicht** zugeordneten Säulen. Werte sind numerisch
 * (Säulen-`id`). `available` enthält bereits nur die wählbaren Säulen.
 */
export const addPillarOptions = (available: Pillar[]): { label: string; value: number }[] => [
	{ label: '— Säule hinzufügen —', value: ADD_PILLAR_PLACEHOLDER },
	...available.map((pillar) => ({ label: pillar.name, value: pillar.id })),
];

/** Summe der übergebenen Gewichte (`null`/fehlend zählt als 0). */
export const sumWeights = (weights: readonly (number | null)[]): number =>
	weights.reduce<number>((acc, weight) => acc + (weight ?? 0), 0);

/** Prüft, ob die Summe der Gewichte (innerhalb der Toleranz) genau `TOTAL_WEIGHT` ergibt. */
export const isWeightSumValid = (sum: number): boolean => Math.abs(sum - TOTAL_WEIGHT) <= WEIGHT_SUM_EPSILON;

/** Säulen-Name samt prozentualem Anteil, z. B. „Körper (20 %)". */
export const pillarLabelWithWeight = (pillar: Pillar): string => `${pillar.name} (${formatNumber(pillar.weight)} %)`;

/** Begrenzt einen Wert auf das Intervall `[min, max]`. */
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Wandelt KI-Vorschläge (`pillarId` + Konfidenz) in übernehmbare Säulen-Beiträge für das Formular um.
 *
 * - Nur Vorschläge zu **bekannten** Säulen (`validPillarIds`) mit **positiver** Konfidenz werden
 *   übernommen — der Server kann theoretisch unbekannte IDs oder 0 %-Säulen liefern.
 * - Die Anteile (`share`) werden **proportional zur Konfidenz** auf `TOTAL_WEIGHT` (100 %) verteilt
 *   und auf Ganzzahlen gerundet; die letzte Säule erhält den Rundungsrest, damit die Summe exakt
 *   `TOTAL_WEIGHT` ergibt (erfüllt `isWeightSumValid`).
 * - Die Konfidenz wird auf `[0, 100]` geklemmt und gerundet (passend zum Slider-`_step={1}`).
 *
 * Das Ergebnis ist ein Vorschlag, den der Nutzer vor dem Speichern weiter **korrigieren** kann.
 */
export const suggestionsToContributions = (
	suggestions: readonly PillarSuggestion[],
	validPillarIds: ReadonlySet<number>,
): TaskPillarContribution[] => {
	const relevant = suggestions.filter((entry) => validPillarIds.has(entry.pillarId) && entry.confidence > 0);
	if (relevant.length === 0) {
		return [];
	}
	const totalConfidence = relevant.reduce((acc, entry) => acc + entry.confidence, 0);
	let allocated = 0;
	return relevant.map((entry, index) => {
		const isLast = index === relevant.length - 1;
		const share = isLast ? TOTAL_WEIGHT - allocated : Math.round((entry.confidence / totalConfidence) * TOTAL_WEIGHT);
		allocated += share;
		return { pillarId: entry.pillarId, share, confidence: Math.round(clamp(entry.confidence, 0, 100)) };
	});
};

/** Kennzahlen einer Säule für das Dashboard-Widget „Meine Themen". */
export interface PillarSummary {
	pillar: Pillar;
	/** Anzahl der Tasks, die (mit einem Beitrag) auf diese Säule einzahlen. */
	taskCount: number;
	/** Anteilig (nach `share`) auf diese Säule entfallender geschätzter Eigenaufwand (Tage). */
	totalEstimatedEffort: number;
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
 * zählt sein Wert als 0. `taskCount` zählt jeden einzahlenden Task einfach. Die Reihenfolge der
 * Säulen bleibt erhalten.
 */
export const buildPillarSummaries = (
	pillars: Pillar[],
	tasks: Task[],
	valueByTaskId: ReadonlyMap<number, number>,
): PillarSummary[] =>
	pillars.map((pillar) => {
		let taskCount = 0;
		let totalEstimatedEffort = 0;
		let totalValue = 0;
		for (const task of tasks) {
			const contribution = task.pillars.find((entry) => entry.pillarId === pillar.id);
			if (contribution === undefined) {
				continue;
			}
			const shareFraction = contribution.share / TOTAL_WEIGHT;
			taskCount += 1;
			totalEstimatedEffort += task.estimatedEffort * shareFraction;
			totalValue += (valueByTaskId.get(task.id) ?? 0) * shareFraction;
		}
		return { pillar, taskCount, totalEstimatedEffort, totalValue };
	});
