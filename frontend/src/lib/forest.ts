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
