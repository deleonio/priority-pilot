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
	/**
	 * Direkte Unteraufgaben dieses Knotens (Eltern → Kind). Eine Unteraufgabe wird als **Vorgänger**
	 * der Eltern-Aufgabe angelegt (`parent.getDependencies() ∋ child`, siehe `TaskForm.tsx`); der Wald
	 * bildet daher die `getDependencies()` als Kinder ab (#336). Der Feldname bleibt aus
	 * API-Kompatibilität `dependents`, meint hier aber die Unteraufgaben (Kinder), nicht die Dependents
	 * im Graph-Sinn.
	 */
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
	// Kinder = direkte Unteraufgaben = Vorgänger dieses Tasks (`getDependencies()`), analog zum
	// Aufwands-Rollup oben. Damit erscheint die Eltern-Aufgabe über ihren Unteraufgaben (#336, AK4).
	const subtasks = await task.getDependencies();

	const children: TaskTreeNode[] = [];
	const totalEstimatedEffort = await getEstimatedEffort(task);

	for (const subtask of subtasks) {
		children.push(await buildTaskTree(subtask));
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

	// Wurzeln = Tasks, die selbst keine Unteraufgabe (Vorgänger) einer anderen Aufgabe sind — also
	// Tasks ohne Dependents (#336, AK4). Ihre Unteraufgaben hängen als `getDependencies()` darunter.
	const rootTasks: Task[] = [];
	for (const task of tasks) {
		const dependents = await task.getDependents();
		if (dependents.length === 0) {
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
