import { Pillar, Task } from '../models/index.js';

/** Gleichverteilung: fünf Säulen à 20 % ⇒ Faktor 1 (neutral). */
const NEUTRAL_PILLAR_WEIGHT = 20;

/**
 * Normierter Säulen-Faktor eines Tasks: `pillar.weight / 20`. Bei Gleichverteilung (20 %)
 * ergibt sich der neutrale Faktor 1. Tasks ohne (oder mit fehlender) Säule bleiben neutral.
 *
 * `cache` vermeidet wiederholte DB-Abfragen für dieselbe Säule innerhalb **einer** Berechnung
 * (N+1). Der Cache wird pro Top-Level-Aufruf neu angelegt, damit nach einer Gewichtsänderung
 * (`PUT /pillars/weights`) keine veralteten Faktoren ausgeliefert werden.
 */
const getPillarFactor = async (task: Task, cache: Map<number, number>): Promise<number> => {
	if (task.pillarId == null) {
		return 1;
	}
	const cached = cache.get(task.pillarId);
	if (cached !== undefined) {
		return cached;
	}
	const pillar = await Pillar.findByPk(task.pillarId);
	const factor = pillar ? pillar.weight / NEUTRAL_PILLAR_WEIGHT : 1;
	cache.set(task.pillarId, factor);
	return factor;
};

export const calculateValueContribution = async (
	task: Task,
	pillarFactorCache: Map<number, number> = new Map(),
): Promise<number> => {
	const dependencies = await task.getDependents();
	let value = 0;
	for (const dependency of dependencies) {
		const dependencyValue = await calculateValueContribution(dependency, pillarFactorCache);
		const weight = dependency.Dependency?.dataValues?.weight || 1;
		value += dependencyValue * weight;
	}
	const baseValue = (value + task.priority) / (dependencies.length + 1);
	// Säulen-Gewicht einbeziehen: höher gewichtete Säulen heben den Wert (multiplikativ).
	return baseValue * (await getPillarFactor(task, pillarFactorCache));
};

export const calculateAllTaskValues = async (): Promise<void> => {
	// Alle Tasks abrufen, die offen oder in Bearbeitung sind
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
	});

	console.log('Wertschöpfung aller Tasks:');
	for (const task of tasks) {
		// Wertschöpfung für jeden Task berechnen
		const value = await calculateValueContribution(task);
		console.log(`Task: ${task.title}, Wertschöpfung: ${value.toFixed(1)}`);
	}
};
