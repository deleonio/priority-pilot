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

/**
 * Sammelt alle Oberaufgaben (Knoten mit `dependents.length > 0`, also mindestens einer offenen
 * Unteraufgabe, #392) aus dem ungefilterten Aufgabenwald — Grundlage für den „Oberaufgaben
 * anzeigen"-Schalter (#1345). Dedupe wie `collectTaskValues`: derselbe Knoten kann über mehrere
 * Pfade erreichbar sein, wird aber nur einmal aufgenommen.
 */
export const collectOpenParents = (forest: TaskTreeNode[]): TaskTreeNode[] => {
	const result: TaskTreeNode[] = [];
	const visited = new Set<number>();

	const visit = (node: TaskTreeNode): void => {
		if (visited.has(node.id)) {
			return;
		}
		visited.add(node.id);
		if (node.dependents.length > 0) {
			result.push(node);
		}
		node.dependents.forEach(visit);
	};

	forest.forEach(visit);
	return result;
};
