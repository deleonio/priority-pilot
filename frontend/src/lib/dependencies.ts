import type { TaskTreeNode } from 'client';

/** Eine Abhängigkeit (Vorgänger), wie sie in der UI aufgelistet wird. */
export interface DependencyRef {
	id: number;
	title: string;
}

/**
 * Leitet aus dem Aufgabenwald (`GET /forest`) für jeden Task die Liste seiner direkten
 * Abhängigkeiten (Vorgänger/Prerequisites) ab.
 *
 * Seit #336 bildet der Wald Eltern → Kind ab: die direkten Kinder eines Knotens (`node.dependents`)
 * sind seine über „Unteraufgabe anlegen" verknüpften Vorgänger (`parent.getDependencies()`). Die
 * direkten Vorgänger eines Tasks sind damit genau seine Kinder im Wald — kein Umkehren der Kanten
 * mehr nötig. Hinweis: Der Wald enthält nur Tasks mit Status `Open`/`In process` — Kanten zu/von
 * `Done`-Tasks erscheinen daher nicht.
 */
export const buildDependencyMap = (forest: TaskTreeNode[]): Map<number, DependencyRef[]> => {
	const map = new Map<number, DependencyRef[]>();

	// Pfad-basierter Zyklusschutz: Der Server lehnt zyklische Abhängigkeiten ab (409), doch sollte
	// `/forest` wider Erwarten einen Zyklus enthalten, verhindert dieser Guard einen Stack-Overflow.
	const path = new Set<number>();
	const visit = (node: TaskTreeNode): void => {
		if (path.has(node.id)) {
			return;
		}
		path.add(node.id);
		if (node.dependents.length > 0) {
			const list = map.get(node.id) ?? [];
			for (const child of node.dependents) {
				if (!list.some((dependency) => dependency.id === child.id)) {
					list.push({ id: child.id, title: child.title });
				}
			}
			map.set(node.id, list);
		}
		for (const child of node.dependents) {
			visit(child);
		}
		path.delete(node.id);
	};

	forest.forEach(visit);
	return map;
};
