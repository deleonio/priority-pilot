import type { TaskTreeNode } from 'client';

/**
 * Extrahiert die **Blatt-Aufgaben** (`dependents.length === 0`) aus dem originalen Aufgabenwald
 * (`GET /forest`) und ersetzt damit die frühere Wald-Inversion (`invertForest`, #363). Statt den
 * semantischen Wald umzudrehen (Blätter zu Wurzeln, Oberaufgaben als aufklappbare Kinder), liefert
 * `extractLeaves` eine **flache Liste ausschließlich der Blatt-Knoten** — ohne Baumstruktur, ohne
 * Aufklappfunktionalität (#537).
 *
 * Die Blätter werden nach Wertbeitrag (`value`) absteigend sortiert — das ist der Status quo der
 * bisherigen Wurzel-Sortierung (`invertForest`). Die Sortierung ist stabil: bei Wertgleichheit
 * bleibt die Einfügereihenfolge (Tiefen-Traversierung des Original-Waldes) erhalten.
 *
 * Rein: Der übergebene Wald wird nicht mutiert; die zurückgegebenen Knoten sind die
 * ursprünglichen Referenzen aus dem Eingabe-Wald (kein Spread nötig, da nur gelesen wird).
 *
 * Dedup (#1449): `buildTaskForest` materialisiert eine Unteraufgabe, die Vorgänger mehrerer
 * Oberaufgaben ist, als mehrere frische Knoten-Objekte mit derselben `id` (einmal pro Pfad).
 * Dedupliziert wird daher über `node.id`, nicht über Objekt-Identität; bei mehreren Vorkommen
 * gewinnt das erste Antreffen der Tiefen-Traversierung.
 */
export function extractLeaves(forest: TaskTreeNode[], options?: { includeParents?: boolean }): TaskTreeNode[] {
	const includeParents = options?.includeParents ?? false;
	const result: TaskTreeNode[] = [];
	const seen = new Set<number>();

	const collect = (nodes: TaskTreeNode[]): void => {
		for (const node of nodes) {
			if (node.dependents.length === 0) {
				if (!seen.has(node.id)) {
					seen.add(node.id);
					result.push(node);
				}
			} else {
				if (includeParents && !seen.has(node.id)) {
					seen.add(node.id);
					result.push(node);
				}
				collect(node.dependents);
			}
		}
	};
	collect(forest);

	return result.sort((a, b) => b.value - a.value);
}
