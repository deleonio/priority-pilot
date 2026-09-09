import type { TaskGraph, TaskGraphEdge, TaskGraphNode } from 'client';
import { describe, expect, it } from 'vitest';
import { layoutGraph, selectTopNodes } from './graphLayout';

const node = (id: number, value = 1): TaskGraphNode => ({
	id,
	title: `T${id}`,
	priority: 3,
	estimatedEffort: 0.5,
	totalEstimatedEffort: 0.5,
	value,
	status: 'Open',
	progress: null,
});

const edge = (from: number, to: number, weight = 1): TaskGraphEdge => ({ from, to, weight });

/** Ebene je Knoten-ID, damit die Assertions unabhängig von der Reihenfolge lesbar bleiben. */
const layersById = (positioned: ReturnType<typeof layoutGraph>): Map<number, number> =>
	new Map(positioned.map((entry) => [entry.node.id, entry.layer]));

describe('layoutGraph', () => {
	it('Leerer Graph liefert nichts', () => {
		expect(layoutGraph([], [])).toEqual([]);
	});

	it('Kette: jede Kante schiebt den Nachfolger eine Ebene tiefer', () => {
		// 1 → 2 → 3, Kante zeigt vom Vorgänger auf die übergeordnete Aufgabe.
		const positioned = layoutGraph([node(1), node(2), node(3)], [edge(1, 2), edge(2, 3)]);
		const layers = layersById(positioned);
		expect(layers.get(1)).toBe(0);
		expect(layers.get(2)).toBe(1);
		expect(layers.get(3)).toBe(2);
	});

	it('Diamant: der gemeinsame Nachfolger landet unter beiden Vorgängern (längster Pfad)', () => {
		// 1 → 2, 1 → 3, 2 → 4, 3 → 4 und zusätzlich 1 → 4 (Abkürzung).
		// Ebene 4 muss 2 sein, nicht 1 — sonst zeigte eine Kante nach oben.
		const positioned = layoutGraph(
			[node(1), node(2), node(3), node(4)],
			[edge(1, 2), edge(1, 3), edge(2, 4), edge(3, 4), edge(1, 4)],
		);
		const layers = layersById(positioned);
		expect(layers.get(1)).toBe(0);
		expect(layers.get(2)).toBe(1);
		expect(layers.get(3)).toBe(1);
		expect(layers.get(4)).toBe(2);
	});

	it('Mehrere Wurzeln und isolierte Knoten liegen gemeinsam auf Ebene 0', () => {
		const positioned = layoutGraph([node(1), node(2), node(3), node(4)], [edge(1, 2)]);
		const layers = layersById(positioned);
		expect(layers.get(1)).toBe(0);
		expect(layers.get(3)).toBe(0);
		expect(layers.get(4)).toBe(0);
		expect(layers.get(2)).toBe(1);
	});

	it('Knoten derselben Ebene bekommen unterschiedliche x, Ebenen unterschiedliche y', () => {
		const positioned = layoutGraph([node(1), node(2), node(3)], [edge(1, 3), edge(2, 3)]);
		const byId = new Map(positioned.map((entry) => [entry.node.id, entry]));
		expect(byId.get(1)?.x).not.toBe(byId.get(2)?.x);
		expect(byId.get(1)?.y).toBe(byId.get(2)?.y);
		expect(byId.get(3)?.y).toBeGreaterThan(byId.get(1)?.y ?? 0);
	});

	it('Ist deterministisch: gleicher Input ergibt exakt gleichen Output', () => {
		const nodes = [node(4, 2), node(1, 9), node(3, 2), node(2, 5)];
		const edges = [edge(1, 2), edge(3, 2), edge(4, 3)];
		expect(layoutGraph(nodes, edges)).toEqual(layoutGraph(nodes, edges));
	});

	it('Bricht bei einem Zyklus in den Daten nicht ab', () => {
		// Der Server garantiert einen DAG (cycle.ts); die Layoutfunktion darf trotzdem nicht hängen.
		const positioned = layoutGraph([node(1), node(2)], [edge(1, 2), edge(2, 1)]);
		expect(positioned).toHaveLength(2);
	});

	it('Ignoriert Kanten auf unbekannte Knoten', () => {
		const positioned = layoutGraph([node(1)], [edge(1, 99), edge(98, 1)]);
		expect(positioned).toHaveLength(1);
		expect(positioned[0].layer).toBe(0);
	});
});

describe('selectTopNodes', () => {
	const graph = (nodes: TaskGraphNode[], edges: TaskGraphEdge[]): TaskGraph => ({ nodes, edges });

	it('Gibt den Graphen unverändert zurück, wenn er unter dem Limit liegt', () => {
		const input = graph([node(1), node(2)], [edge(1, 2)]);
		expect(selectTopNodes(input, 60)).toEqual(input);
	});

	it('Kappt auf die wertvollsten Knoten (Server liefert absteigend sortiert)', () => {
		const input = graph([node(1, 9), node(2, 5), node(3, 1)], []);
		expect(selectTopNodes(input, 2).nodes.map((entry) => entry.id)).toEqual([1, 2]);
	});

	it('Wirft keine Kante ins Leere: Kanten zu gekappten Knoten fallen weg', () => {
		const input = graph([node(1, 9), node(2, 5), node(3, 1)], [edge(1, 2), edge(3, 2), edge(1, 3)]);
		const capped = selectTopNodes(input, 2);
		expect(capped.edges).toEqual([edge(1, 2)]);
	});
});
