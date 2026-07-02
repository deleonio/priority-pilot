import type { TaskStatus } from 'client';

/**
 * Minimaler Baumknoten für die Fortschrittsberechnung: Status des Tasks und seine (Unter-)Tasks.
 * Bewusst schlank gehalten (nur `status` + `dependents`), damit `TaskTreeNode` per Cast passt.
 */
export interface ProgressNode {
	status: TaskStatus;
	dependents: ProgressNode[];
}

/**
 * Zählt den Fortschritt eines Tasks inkl. aller (transitiven) Unter-Tasks.
 *
 * - Liefert `null`, wenn es keine Unter-Tasks gibt (AK3: keine redundante 1/1-Anzeige).
 * - `done` zählt nur Knoten mit Status `'Done'`, `total` alle erreichbaren Knoten.
 * - Dedupliziert über Objekt-Identität: derselbe Knoten (geteilte Referenz im DAG) wird nur
 *   einmal gezählt. Das schützt zugleich vor Zyklen (kein erneutes Absteigen in besuchte Knoten).
 */
export const calculateProgress = (node: ProgressNode): { done: number; total: number } | null => {
	if (node.dependents.length === 0) return null;

	const visited = new Set<ProgressNode>();
	let done = 0;
	let total = 0;

	const count = (n: ProgressNode): void => {
		if (visited.has(n)) return;
		visited.add(n);
		total++;
		if (n.status === 'Done') done++;
		for (const dep of n.dependents) count(dep);
	};

	count(node);
	return { done, total };
};
