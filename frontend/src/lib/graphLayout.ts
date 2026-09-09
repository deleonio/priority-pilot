import type { TaskGraph, TaskGraphEdge, TaskGraphNode } from 'client';

/** Feste Knotengröße — dieselben Werte gelten im CSS (`.task-graph-node`). */
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 92;
/** Abstände aus der Spacing-Skala (16er-Raster). */
const GAP_X = 32;
const GAP_Y = 64;

/** Anzeigegrenze: darüber wird auf die wertvollsten Knoten gekappt (siehe `selectTopNodes`). */
export const MAX_GRAPH_NODES = 60;

export interface PositionedNode {
	node: TaskGraphNode;
	/** Ebene im gerichteten Layout: 0 = ganz oben (Aufgaben ohne Vorgänger im sichtbaren Graphen). */
	layer: number;
	x: number;
	y: number;
}

/**
 * Ordnet die Knoten eines DAG in Ebenen an: Vorgänger oben, die übergeordnete Aufgabe darunter.
 * Eine Kante `from → to` bedeutet „`from` ermöglicht `to`", der Pfeil zeigt also nach unten.
 *
 * Bewusst handgeschrieben statt dagre/elkjs: der Graph ist ein DAG und bleibt bei persönlichen
 * Aufgabenmengen klein, ein Longest-Path plus zwei Barycenter-Durchläufe reicht dafür. Das Ergebnis
 * ist **deterministisch** (Tie-Break über `value` und `id`) und damit in Unit- und e2e-Tests
 * prüfbar — kraftbasierte Layouts wären es nicht. Sollte die Kreuzungsminimierung irgendwann nicht
 * mehr genügen, ist diese Signatur die einzige Stelle, die ein Layout-Paket ersetzen müsste.
 */
export const layoutGraph = (nodes: TaskGraphNode[], edges: TaskGraphEdge[]): PositionedNode[] => {
	if (nodes.length === 0) {
		return [];
	}

	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	// Kanten auf unbekannte Knoten würden den Eingangsgrad verfälschen und Knoten aussperren.
	const known = edges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to));

	const successors = new Map<number, number[]>();
	const predecessors = new Map<number, number[]>();
	const indegree = new Map<number, number>(nodes.map((node) => [node.id, 0]));
	for (const edge of known) {
		successors.set(edge.from, [...(successors.get(edge.from) ?? []), edge.to]);
		predecessors.set(edge.to, [...(predecessors.get(edge.to) ?? []), edge.from]);
		indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
	}

	// Ebene per Longest-Path über eine Kahn-Topologie (iterativ, damit tiefe Ketten nicht den
	// Stack sprengen). Knoten in einem Zyklus bleiben in der Queue-Runde übrig und behalten Ebene 0 —
	// der Server garantiert zwar einen DAG (cycle.ts), aber die Darstellung darf daran nicht hängen.
	const layer = new Map<number, number>(nodes.map((node) => [node.id, 0]));
	const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor];
		for (const next of successors.get(current) ?? []) {
			layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(current) ?? 0) + 1));
			const remaining = (indegree.get(next) ?? 0) - 1;
			indegree.set(next, remaining);
			if (remaining === 0) {
				queue.push(next);
			}
		}
	}

	// Startordnung je Ebene: Wertbeitrag absteigend, `id` als stabiler Tie-Break.
	const byLayer = new Map<number, TaskGraphNode[]>();
	for (const node of [...nodes].sort((a, b) => b.value - a.value || a.id - b.id)) {
		const index = layer.get(node.id) ?? 0;
		byLayer.set(index, [...(byLayer.get(index) ?? []), node]);
	}
	const layerIndexes = [...byLayer.keys()].sort((a, b) => a - b);

	// Zwei Barycenter-Durchläufe: jeder Knoten rückt in Richtung des Mittelwerts seiner Vorgänger,
	// das entzerrt die Kanten. Knoten ohne Vorgänger behalten ihre Position.
	const positionInLayer = new Map<number, number>();
	const refreshPositions = (): void => {
		for (const index of layerIndexes) {
			(byLayer.get(index) ?? []).forEach((node, position) => positionInLayer.set(node.id, position));
		}
	};
	refreshPositions();
	for (let pass = 0; pass < 2; pass += 1) {
		for (const index of layerIndexes) {
			const current = byLayer.get(index) ?? [];
			const barycenter = new Map<number, number>();
			current.forEach((node, position) => {
				const parents = predecessors.get(node.id) ?? [];
				if (parents.length === 0) {
					barycenter.set(node.id, position);
					return;
				}
				const sum = parents.reduce((total, parent) => total + (positionInLayer.get(parent) ?? 0), 0);
				barycenter.set(node.id, sum / parents.length);
			});
			byLayer.set(
				index,
				[...current].sort(
					(a, b) => (barycenter.get(a.id) ?? 0) - (barycenter.get(b.id) ?? 0) || b.value - a.value || a.id - b.id,
				),
			);
		}
		refreshPositions();
	}

	const positioned: PositionedNode[] = [];
	for (const index of layerIndexes) {
		(byLayer.get(index) ?? []).forEach((node, position) => {
			positioned.push({
				node,
				layer: index,
				x: position * (NODE_WIDTH + GAP_X),
				y: index * (NODE_HEIGHT + GAP_Y),
			});
		});
	}
	return positioned;
};

/**
 * Kappt den Graphen auf die `limit` wertvollsten Knoten und wirft alle Kanten weg, die dadurch ins
 * Leere zeigen würden. Die Knoten kommen vom Server bereits absteigend nach `value` sortiert.
 *
 * Die Kappung ist bewusst Sache der Ansicht und nicht des Endpunkts: `GET /graph` bleibt eine
 * vollständige Repräsentation, nur die Darstellung hat eine Grenze.
 */
export const selectTopNodes = (graph: TaskGraph, limit: number): TaskGraph => {
	if (graph.nodes.length <= limit) {
		return graph;
	}
	const nodes = graph.nodes.slice(0, limit);
	const visible = new Set(nodes.map((node) => node.id));
	return { nodes, edges: graph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)) };
};
