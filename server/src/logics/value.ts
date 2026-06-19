import { Task } from '../models/index.js';

/** Gleichverteilung: fünf Säulen à 20 % ⇒ Faktor 1 (neutral). */
const NEUTRAL_PILLAR_WEIGHT = 20;

/** `share`/`confidence` sind Prozentwerte (0–100); hier auf Bruchteile (0–1) normiert. */
const PERCENT = 100;

/**
 * Säulen-Faktor eines Tasks aus seinen anteilig gewichteten Säulen-Beiträgen.
 *
 * Jeder Task verteilt 100 % seines „Investitions-Anteils" (`share`) auf 0..n Säulen; je Beitrag
 * gibt eine `confidence` (0–100 %) an, wie sicher er auf die Säule einzahlt. Der Faktor interpoliert
 * je Säule zwischen **neutral** (1) und dem vollen Säulen-Faktor (`weight / 20`), gewichtet mit der
 * Konfidenz, und mittelt anteilig über die Säulen:
 *
 *   factor = Σ (shareᵢ / 100) · [1 + (confᵢ / 100) · (weightᵢ / 20 − 1)]
 *
 * Eigenschaften: Ohne Säulen bleibt der Task neutral (Faktor 1). Geringe Konfidenz verschiebt den
 * Wert kaum (der Beitrag bleibt nahe neutral). Eine einzelne Säule mit 100 % Anteil und Konfidenz
 * 100 % reproduziert exakt `weight / 20` — das Verhalten vor der Mehrfach-Einzahlung.
 */
const getPillarFactor = async (task: Task): Promise<number> => {
	const pillars = await task.getPillars();
	if (pillars.length === 0) {
		return 1;
	}
	let factor = 0;
	for (const pillar of pillars) {
		const share = pillar.TaskPillar.share / PERCENT;
		const confidence = pillar.TaskPillar.confidence / PERCENT;
		factor += share * (1 + confidence * (pillar.weight / NEUTRAL_PILLAR_WEIGHT - 1));
	}
	return factor;
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
	// Säulen-Beiträge einbeziehen: höher gewichtete Säulen heben den Wert (multiplikativ).
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
