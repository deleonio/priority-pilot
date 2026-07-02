import type { TaskTreeNode } from 'client';

/**
 * Sammelt aus dem Aufgabenwald (`GET /forest`) je Task seinen Wertbeitrag (`value`).
 *
 * Der Wald ist ein Baum aus Wurzeln und ihren `dependents`; derselbe Task kann über mehrere Pfade
 * erreichbar sein, trägt aber einen einzigen Wert. Die `values`-Map dient zugleich als
 * Besuchsmarkierung: Ein bereits erfasster Knoten (und damit sein Teilbaum) wird nicht erneut
 * betreten. Das übernimmt je `id` den ersten gefundenen Wert (Dedupe), schützt vor Zyklen (kein
 * Stack-Overflow, falls `/forest` wider Erwarten einen Zyklus enthält) und vermeidet exponentielle
 * Laufzeit in tiefen DAGs mit mehrfach erreichbaren Knoten. Hinweis: Der Wald enthält nur Tasks mit
 * Status `Open`/`In process` — `Done`-Tasks erscheinen daher nicht.
 */
export const collectTaskValues = (forest: TaskTreeNode[]): Map<number, number> => {
	const values = new Map<number, number>();

	const visit = (node: TaskTreeNode): void => {
		if (values.has(node.id)) {
			return;
		}
		values.set(node.id, node.value);
		for (const child of node.dependents) {
			visit(child);
		}
	};

	forest.forEach(visit);
	return values;
};

/** Eine abgeflachte Baumzeile: der Knoten, seine Einrücktiefe und ob er Unteraufgaben besitzt. */
interface ForestRow {
	node: TaskTreeNode;
	depth: number;
	hasChildren: boolean;
}

/**
 * Flacht den Aufgabenwald für die expandierbare Listendarstellung (#238) in eine lineare Reihenfolge
 * ab. Wurzeln erscheinen mit `depth === 0`; die `dependents` eines Knotens werden nur dann direkt
 * nach ihm mit erhöhter Tiefe eingefügt, wenn seine `id` in `expandedIds` liegt (und damit — rekursiv
 * — alle seine Vorfahren aufgeklappt sind).
 *
 * `visited` markiert den aktuellen Pfad und bricht bei einem (unerwarteten) Zyklus in den Baumdaten
 * ab, damit kein endloser Abstieg entsteht.
 */
export const flattenForest = (forest: TaskTreeNode[], expandedIds: Set<number>): ForestRow[] => {
	const rows: ForestRow[] = [];

	const visit = (node: TaskTreeNode, depth: number, visited: Set<number>): void => {
		if (visited.has(node.id)) {
			return;
		}
		rows.push({ node, depth, hasChildren: node.dependents.length > 0 });
		if (!expandedIds.has(node.id)) {
			return;
		}
		const nextVisited = new Set(visited).add(node.id);
		for (const child of node.dependents) {
			visit(child, depth + 1, nextVisited);
		}
	};

	for (const root of forest) {
		visit(root, 0, new Set<number>());
	}
	return rows;
};
