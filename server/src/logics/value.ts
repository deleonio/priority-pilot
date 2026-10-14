import { Pillar, Task } from '../models/index.js';

/** Legacy-Verhalten: 5 Säulen à 20 % ⇒ Faktor 1 (neutral). Fallback, wenn task.userId === null. */
const LEGACY_PILLAR_COUNT = 5;

/** `share`/`confidence` sind Prozentwerte (0–100); hier auf Bruchteile (0–1) normiert. */
const PERCENT = 100;

/**
 * Säulen-Faktor eines Tasks aus seinen anteilig gewichteten Säulen-Beiträgen.
 *
 * Jeder Task verteilt 100 % seines „Investitions-Anteils" (`share`) auf 0..n Säulen; je Beitrag
 * gibt eine `confidence` (0–100 %) an, wie sicher er auf die Säule einzahlt. Der Faktor interpoliert
 * je Säule zwischen **neutral** (1) und dem vollen Säulen-Faktor (`weight · N / 100`), gewichtet mit
 * der Konfidenz, und mittelt anteilig über die Säulen:
 *
 *   factor = Σ (shareᵢ / 100) · [1 + (confᵢ / 100) · (weightᵢ · N / 100 − 1)]
 *
 * N ist die Anzahl der Säulen des Task-Eigentümers (#423): bei Tasks mit userId die Anzahl der
 * pillars dieser userId, bei NULL-owned Tasks (Legacy) der Default 5 (fünf Säulen à 20 %).
 *
 * Eigenschaften: Ohne Säulen bleibt der Task neutral (Faktor 1). Geringe Konfidenz verschiebt den
 * Wert kaum (der Beitrag bleibt nahe neutral). Gleichverteilung (jede Säule weight = 100/N) ergibt
 * exakt Faktor 1 für beliebige N ≥ 1.
 */
const getPillarFactor = async (task: Task, pillarCounts: PillarCounts): Promise<number> => {
	const pillars = await task.getPillars();
	if (pillars.length === 0) {
		return 1;
	}

	// N = Anzahl der Säulen des Task-Eigentümers; Legacy-Fallback für NULL-owned Tasks
	let N = LEGACY_PILLAR_COUNT;
	if (task.userId != null) {
		let count = pillarCounts.get(task.userId);
		if (count === undefined) {
			count = await Pillar.count({ where: { userId: task.userId } });
			pillarCounts.set(task.userId, count);
		}
		N = count;
	}

	if (N <= 0) {
		return 1; // Keine Säulen im System ⇒ kein Einfluss
	}

	let factor = 0;
	for (const pillar of pillars) {
		const share = pillar.TaskPillar.share / PERCENT;
		const confidence = pillar.TaskPillar.confidence / PERCENT;
		// Dynamisches Neutralgewicht: neutral = 100/N
		//   factor = 1 + conf · (weight · N / 100 − 1)
		factor += share * (1 + confidence * ((pillar.weight * N) / PERCENT - 1));
	}
	return factor;
};

/** Säulenzahl je userId, von einer Anfrage geteilt, damit `Pillar.count` nicht je Knoten läuft (#2544). */
export type PillarCounts = Map<number, number>;

export const calculateValueContribution = async (
	task: Task,
	pillarCounts: PillarCounts = new Map(),
): Promise<number> => {
	const dependencies = await task.getDependents();
	let value = 0;
	for (const dependency of dependencies) {
		const dependencyValue = await calculateValueContribution(dependency, pillarCounts);
		const weight = dependency.Dependency?.dataValues?.weight || 1;
		value += dependencyValue * weight;
	}
	const baseValue = (value + task.priority) / (dependencies.length + 1);
	// Säulen-Beiträge einbeziehen: höher gewichtete Säulen heben den Wert (multiplikativ).
	return baseValue * (await getPillarFactor(task, pillarCounts));
};
