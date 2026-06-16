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
 * Der Server liefert keine pro-Task-Abhängigkeitsliste; der Wald bildet den Graphen jedoch über
 * `dependents` (die Tasks, die vom jeweiligen Knoten abhängen) ab. Durch Umkehren dieser Kanten
 * ergibt sich je Task die Menge seiner Vorgänger. Hinweis: Der Wald enthält nur Tasks mit Status
 * `Open`/`In process` — Kanten zu/von `Done`-Tasks erscheinen daher nicht.
 */
export const buildDependencyMap = (forest: TaskTreeNode[]): Map<number, DependencyRef[]> => {
	const map = new Map<number, DependencyRef[]>();

	const visit = (node: TaskTreeNode): void => {
		for (const child of node.dependents) {
			const list = map.get(child.id) ?? [];
			if (!list.some((dependency) => dependency.id === node.id)) {
				list.push({ id: node.id, title: node.title });
			}
			map.set(child.id, list);
			visit(child);
		}
	};

	forest.forEach(visit);
	return map;
};
