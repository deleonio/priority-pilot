import type { components } from '../api';
import { Task } from '../models/index.js';
import { calculateValueContribution } from './value.js';

interface TaskTreeNode {
	id: number;
	title: string;
	priority: number;
	estimatedEffort: number;
	/** Gesamtzeit inkl. aller (transitiven) Abhängigkeiten. */
	totalEstimatedEffort: number;
	value: number;
	status: components['schemas']['TaskStatus'];
	dependents: TaskTreeNode[];
}

const getEstimatedEffort = async (task: Task): Promise<number> => {
	let estimatedEffort = task.estimatedEffort;
	const dependencies = await task.getDependencies();
	for (const dependency of dependencies) {
		estimatedEffort += await getEstimatedEffort(dependency);
	}
	return estimatedEffort;
};

// Rekursive Funktion, um den Baum eines Tasks zu erstellen
const buildTaskTree = async (task: Task): Promise<TaskTreeNode> => {
	const dependents = await task.getDependents();

	const children: TaskTreeNode[] = [];
	const totalEstimatedEffort = await getEstimatedEffort(task);

	for (const dependent of dependents) {
		children.push(await buildTaskTree(dependent));
	}

	return {
		id: task.id,
		title: task.title,
		priority: task.priority,
		estimatedEffort: task.estimatedEffort || 0,
		totalEstimatedEffort,
		value: await calculateValueContribution(task),
		status: task.status,
		dependents: children,
	};
};

// Funktion, um den gesamten Aufgabenwald (nach Wertschöpfung sortiert) zu erstellen
export const buildTaskForest = async (userId?: number): Promise<TaskTreeNode[]> => {
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
			// Datenisolation (#207, AK5): auf den eingeloggten Nutzer filtern, sofern vorhanden.
			...(userId !== undefined ? { userId } : {}),
		},
	});

	// Finde alle Wurzeltasks (Tasks ohne Abhängigkeiten)
	const rootTasks: Task[] = [];
	for (const task of tasks) {
		const dependencies = await task.getDependencies();
		if (dependencies.length === 0) {
			rootTasks.push(task);
		}
	}

	// Erstelle Bäume für alle Wurzeltasks
	const forest: TaskTreeNode[] = [];
	for (const rootTask of rootTasks) {
		forest.push(await buildTaskTree(rootTask));
	}

	// Sortiere die Bäume nach Wertschöpfung (absteigend)
	forest.sort((a, b) => b.value - a.value);

	return forest;
};
