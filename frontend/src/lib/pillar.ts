import type { Pillar, Task } from 'client';
import { formatNumber } from './task';

/**
 * Sentinel-Wert der Säulen-Auswahl für „keine Säule". Säulen-IDs sind serverseitig `>= 1`
 * (siehe `openapi.yml`), daher kollidiert `0` mit keiner echten Säule und steht eindeutig für
 * „nicht zugeordnet".
 */
export const NO_PILLAR_VALUE = 0;

/** Soll-Summe der Gewichte über alle Säulen (100 %-Verteilung; siehe Server-Vertrag). */
export const TOTAL_WEIGHT = 100;

/**
 * Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). Spiegelt die
 * serverseitige Toleranz in `server/src/express/routes/pillars.ts`.
 */
export const WEIGHT_SUM_EPSILON = 1e-6;

/**
 * Auswahl-Optionen für die Säulen-Zuordnung im Task-Formular: eine „keine Säule"-Option (Sentinel
 * `NO_PILLAR_VALUE`) gefolgt von allen Säulen. Werte sind numerisch, passend zu `Task.pillarId`.
 */
export const pillarSelectOptions = (pillars: Pillar[]): { label: string; value: number }[] => [
	{ label: '— Keine Säule —', value: NO_PILLAR_VALUE },
	...pillars.map((pillar) => ({ label: pillar.name, value: pillar.id })),
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
	/** Anzahl der dieser Säule zugeordneten Tasks. */
	taskCount: number;
	/** Summe des geschätzten Eigenaufwands (Tage) dieser Tasks. */
	totalEstimatedEffort: number;
	/**
	 * Summe der Wertbeiträge dieser Tasks. Die Werte stammen aus dem Aufgabenwald (`valueByTaskId`),
	 * der nur offene/in Arbeit befindliche Tasks enthält — `Done`-Tasks tragen daher 0 bei.
	 */
	totalValue: number;
}

/**
 * Aggregiert je Säule die zugeordneten Tasks zu Anzahl, Gesamtaufwand und Gesamtwert — Datenbasis
 * für das Dashboard-Widget „Meine Themen". `valueByTaskId` liefert den Wertbeitrag je Task (siehe
 * `collectTaskValues`); fehlt ein Task dort (z. B. `Done`), zählt sein Wert als 0. Die Reihenfolge
 * der Säulen bleibt erhalten.
 */
export const buildPillarSummaries = (
	pillars: Pillar[],
	tasks: Task[],
	valueByTaskId: ReadonlyMap<number, number>,
): PillarSummary[] =>
	pillars.map((pillar) => {
		const pillarTasks = tasks.filter((task) => task.pillarId === pillar.id);
		return {
			pillar,
			taskCount: pillarTasks.length,
			totalEstimatedEffort: pillarTasks.reduce((sum, task) => sum + task.estimatedEffort, 0),
			totalValue: pillarTasks.reduce((sum, task) => sum + (valueByTaskId.get(task.id) ?? 0), 0),
		};
	});
