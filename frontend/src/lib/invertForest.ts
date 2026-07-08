import type { TaskTreeNode } from 'client';

/**
 * Invertiert den semantischen Aufgabenwald (`GET /forest`) in einen Anzeige-Wald für die
 * umgekehrte Leserichtung (#363):
 *
 * - Neue Wurzeln = Blatt-Tasks des semantischen Waldes (`dependents.length === 0`), also die
 *   Unter-/Einzelaufgaben.
 * - Anzeige-Kinder eines Knotens = seine semantischen Eltern (Oberaufgaben) — die Kanten werden
 *   per `id` umgekehrt.
 * - Ein von N Unteraufgaben geteilter Elternknoten erscheint N-fach (je einmal unter jeder
 *   seiner Unteraufgaben).
 * - Die neuen Wurzeln sind nach `value` absteigend sortiert (konsistent zu `buildTaskForest`).
 *
 * Rein: Der übergebene semantische Wald wird nicht mutiert (neue Knoten via Spread), damit Guard
 * (`isDoneBlockedBySubtasks`) und Fortschritt (serverseitig `node.progress`) weiter auf den
 * unveränderten semantischen Unteraufgaben aufsetzen.
 */
export function invertForest(forest: TaskTreeNode[]): TaskTreeNode[] {
	const parentMap = new Map<number, TaskTreeNode>();

	function collectParents(nodes: TaskTreeNode[]): void {
		for (const node of nodes) {
			for (const child of node.dependents) {
				parentMap.set(child.id, node);
			}
			collectParents(node.dependents);
		}
	}
	collectParents(forest);

	const leaves: TaskTreeNode[] = [];
	function collectLeaves(nodes: TaskTreeNode[]): void {
		for (const node of nodes) {
			if (node.dependents.length === 0) {
				leaves.push(node);
			} else {
				collectLeaves(node.dependents);
			}
		}
	}
	collectLeaves(forest);

	function makeInvertedNode(semanticNode: TaskTreeNode): TaskTreeNode {
		const parent = parentMap.get(semanticNode.id);
		return {
			...semanticNode,
			dependents: parent !== undefined ? [makeInvertedNode(parent)] : [],
		};
	}

	return leaves.map((leaf) => makeInvertedNode(leaf)).sort((a, b) => b.value - a.value);
}
