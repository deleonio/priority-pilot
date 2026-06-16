import type { TaskTreeNode } from 'client';

/**
 * Sammelt aus dem Aufgabenwald (`GET /forest`) je Task seinen Wertbeitrag (`value`).
 *
 * Der Wald ist ein Baum aus Wurzeln und ihren `dependents`; derselbe Task kann über mehrere Pfade
 * erreichbar sein, trägt aber einen einzigen Wert — daher wird je `id` nur der erste gefundene Wert
 * übernommen. Ein pfad-basierter Zyklusschutz verhindert (analog zu `buildDependencyMap`) einen
 * Stack-Overflow, falls `/forest` wider Erwarten einen Zyklus enthält. Hinweis: Der Wald enthält nur
 * Tasks mit Status `Open`/`In process` — `Done`-Tasks erscheinen daher nicht.
 */
export const collectTaskValues = (forest: TaskTreeNode[]): Map<number, number> => {
	const values = new Map<number, number>();

	const path = new Set<number>();
	const visit = (node: TaskTreeNode): void => {
		if (path.has(node.id)) {
			return;
		}
		if (!values.has(node.id)) {
			values.set(node.id, node.value);
		}
		path.add(node.id);
		for (const child of node.dependents) {
			visit(child);
		}
		path.delete(node.id);
	};

	forest.forEach(visit);
	return values;
};
