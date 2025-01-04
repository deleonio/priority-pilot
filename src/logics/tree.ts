import { Task } from '../models/index.js';
import { calculateValueContribution } from './value.js';

const getEstimatedEffort = async (task: Task): Promise<number> => {
	let estimatedEffort = task.estimatedEffort;
	const dependencies = await task.getDependencies();
	for (const dependency of dependencies) {
		estimatedEffort += await getEstimatedEffort(dependency);
	}
	return estimatedEffort;
};

// Rekursive Funktion, um den Baum eines Tasks zu erstellen
const buildTaskTree = async (task: Task): Promise<any> => {
	const dependents = await task.getDependents();

	const children = [];
	let totalEstimatedEffort = await getEstimatedEffort(task);

	for (const dependent of dependents) {
		children.push(await buildTaskTree(dependent));
	}

	return {
		title: task.title,
		priority: task.priority,
		estimatedEffort: task.estimatedEffort || 0,
		totalEstimatedEffort, // Gesamtzeit (inkl. Abhängigkeiten)
		value: await calculateValueContribution(task),
		dependents: children,
	};
};

// Funktion, um den gesamten Aufgabenbaum zu erstellen
export const buildTaskForest = async (): Promise<void> => {
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
	});

	// Finde alle Wurzeltasks (Tasks ohne Abhängigkeiten)
	const rootTasks = [];
	for (const task of tasks) {
		const dependencies = await task.getDependencies();
		if (dependencies.length === 0) {
			rootTasks.push(task);
		}
	}

	// Erstelle Bäume für alle Wurzeltasks
	const forest = [];
	for (const rootTask of rootTasks) {
		const tree = await buildTaskTree(rootTask);
		forest.push(tree);
	}

	// Sortiere die Bäume nach Wertschöpfung (absteigend)
	forest.sort((a, b) => b.value - a.value);

	// Ausgabe des Baums
	console.log(JSON.stringify(forest, null, 2));
};
