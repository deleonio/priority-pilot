import type { Pillar, Task } from 'client';
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
