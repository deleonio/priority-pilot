import { Pillar, Task } from '../models/index.js';

/** Gleichverteilung: fünf Säulen à 20 % ⇒ Faktor 1 (neutral). */
const NEUTRAL_PILLAR_WEIGHT = 20;

/**
 * Normierter Säulen-Faktor eines Tasks: `pillar.weight / 20`. Bei Gleichverteilung (20 %)
 * ergibt sich der neutrale Faktor 1. Tasks ohne (oder mit fehlender) Säule bleiben neutral.
 */
const getPillarFactor = async (task: Task): Promise<number> => {
	if (task.pillarId == null) {
		return 1;
	}
	const pillar = await Pillar.findByPk(task.pillarId);
	return pillar ? pillar.weight / NEUTRAL_PILLAR_WEIGHT : 1;
};

export const calculateValueContribution = async (task: Task): Promise<number> => {
	const dependencies = await task.getDependents();
	let value = 0;
	for (const dependency of dependencies) {
		const dependencyValue = await calculateValueContribution(dependency);
		const weight = dependency.Dependency?.dataValues?.weight || 1;
		value += dependencyValue * weight;
	}
	const baseValue = (value + task.priority) / (dependencies.length + 1);
	// Säulen-Gewicht einbeziehen: höher gewichtete Säulen heben den Wert (multiplikativ).
	return baseValue * (await getPillarFactor(task));
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
