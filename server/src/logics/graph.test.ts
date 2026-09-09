import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Task } from '../models/index.js';
import { buildTaskGraph } from './graph.js';
import { buildTaskForest } from './tree.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

/** Float-Vergleich für die Wert-/Aufwandsformeln (identische Formel, evtl. andere Summationsreihenfolge). */
const assertClose = (actual: number, expected: number, message: string): void => {
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`${message}: erwartet ${expected}, war ${actual} (Differenz ${Math.abs(actual - expected)})`,
	);
};

describe('buildTaskGraph', () => {
	it('Leerer Graph wenn keine Tasks vorhanden', async () => {
		const graph = await buildTaskGraph();
		assert.deepEqual(graph, { nodes: [], edges: [] });
	});

	it('Einzelner Task ohne Kanten', async () => {
		const task = await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });
		const graph = await buildTaskGraph();
		assert.equal(graph.nodes.length, 1);
		assert.equal(graph.nodes[0].id, task.id);
		assert.equal(graph.nodes[0].title, 'Solo');
		assert.equal(graph.nodes[0].progress, null);
		assert.deepEqual(graph.edges, []);
	});

	it('Kantenrichtung: from = Unteraufgabe (Vorgänger), to = übergeordnete Aufgabe', async () => {
		// b.addDependency(a): b hängt von a ab → a ist Unteraufgabe/Vorgänger von b.
		// Die Kante zeigt vom Vorgänger auf die übergeordnete Aufgabe: „a ermöglicht b".
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 2, estimatedEffort: 1 });
		await b.addDependency(a);
		const graph = await buildTaskGraph();
		assert.equal(graph.edges.length, 1);
		assert.equal(graph.edges[0].from, a.id);
		assert.equal(graph.edges[0].to, b.id);
	});

	it('Kantengewicht wird durchgereicht, Default ist 1', async () => {
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 3, estimatedEffort: 1 });
		const c = await Task.create({ title: 'C', priority: 3, estimatedEffort: 1 });
		await b.addDependency(a, { through: { weight: 0.4 } });
		await c.addDependency(a);
		const graph = await buildTaskGraph();
		const weighted = graph.edges.find((edge) => edge.to === b.id);
		const defaulted = graph.edges.find((edge) => edge.to === c.id);
		assert.ok(weighted, 'Kante a→b muss existieren');
		assert.ok(defaulted, 'Kante a→c muss existieren');
		assertClose(weighted.weight, 0.4, 'Gesetztes Gewicht');
		assert.equal(defaulted.weight, 1);
	});

	it('Diamant: eine Aufgabe mit zwei übergeordneten Aufgaben erscheint genau einmal', async () => {
		// a → b, a → c, b → d, c → d. Im Wald (`/forest`) erscheint `a` zweimal (je Teilbaum einmal),
		// weil `buildTaskTree` je Wurzel eigene Knoten materialisiert. Der Graph dedupliziert.
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 0.125 });
		const b = await Task.create({ title: 'B', priority: 3, estimatedEffort: 0.125 });
		const c = await Task.create({ title: 'C', priority: 3, estimatedEffort: 0.125 });
		const d = await Task.create({ title: 'D', priority: 3, estimatedEffort: 0.125 });
		await b.addDependency(a);
		await c.addDependency(a);
		await d.addDependency(b);
		await d.addDependency(c);

		const graph = await buildTaskGraph();
		assert.equal(graph.nodes.length, 4);
		assert.equal(graph.nodes.filter((node) => node.id === a.id).length, 1, 'A darf nur einmal vorkommen');
		assert.equal(graph.edges.length, 4);

		const edgeKeys = graph.edges.map((edge) => `${edge.from}->${edge.to}`).sort();
		assert.deepEqual(edgeKeys, [`${a.id}->${b.id}`, `${a.id}->${c.id}`, `${b.id}->${d.id}`, `${c.id}->${d.id}`].sort());
	});

	it('Done-Tasks fehlen in nodes und edges, zählen aber weiter in progress', async () => {
		const child = await Task.create({ title: 'Kind', priority: 3, estimatedEffort: 1 });
		const parent = await Task.create({ title: 'Eltern', priority: 3, estimatedEffort: 1 });
		await parent.addDependency(child);
		await child.update({ status: 'Done' });

		const graph = await buildTaskGraph();
		assert.equal(graph.nodes.length, 1);
		assert.equal(graph.nodes[0].id, parent.id);
		assert.deepEqual(graph.edges, [], 'Kante ins Erledigte darf nicht ins Leere zeigen');
		// … der Fortschritt zählt das erledigte Kind weiter (Vertrag aus tree.ts, #392 ∩ #241).
		assert.deepEqual(graph.nodes[0].progress, { done: 1, total: 2 });
	});

	it('"In process"-Tasks erscheinen im Graphen', async () => {
		const wip = await Task.create({ title: 'WIP', priority: 5, estimatedEffort: 1, status: 'In process' });
		const graph = await buildTaskGraph();
		assert.equal(graph.nodes.length, 1);
		assert.equal(graph.nodes[0].id, wip.id);
	});

	it('Datenisolation: fremde userId liefert weder Knoten noch Kanten', async () => {
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1, userId: 1 });
		const b = await Task.create({ title: 'B', priority: 3, estimatedEffort: 1, userId: 1 });
		await b.addDependency(a);

		const own = await buildTaskGraph(1);
		assert.equal(own.nodes.length, 2);
		assert.equal(own.edges.length, 1);

		const foreign = await buildTaskGraph(2);
		assert.deepEqual(foreign, { nodes: [], edges: [] });
	});

	it('Knoten sind absteigend nach value sortiert', async () => {
		const lo = await Task.create({ title: 'Low', priority: 2, estimatedEffort: 1 });
		const hi = await Task.create({ title: 'High', priority: 5, estimatedEffort: 1 });
		const graph = await buildTaskGraph();
		assert.equal(graph.nodes[0].id, hi.id);
		assert.equal(graph.nodes[1].id, lo.id);
		assert.ok(graph.nodes[0].value >= graph.nodes[1].value);
	});

	it('Parität zu buildTaskForest: value, totalEstimatedEffort und progress stimmen überein', async () => {
		// Baumförmiger Fall mit gemischten Gewichten und einem erledigten Blatt — genau die Konstellation,
		// in der die beiden Implementierungen auseinanderlaufen könnten.
		const a = await Task.create({ title: 'A', priority: 4, estimatedEffort: 0.125 });
		const b = await Task.create({ title: 'B', priority: 2, estimatedEffort: 0.25 });
		const c = await Task.create({ title: 'C', priority: 5, estimatedEffort: 0.5 });
		const doneLeaf = await Task.create({ title: 'Erledigt', priority: 3, estimatedEffort: 0.25 });
		await b.addDependency(a, { through: { weight: 0.5 } });
		await c.addDependency(b, { through: { weight: 0.8 } });
		await b.addDependency(doneLeaf);
		await doneLeaf.update({ status: 'Done' });

		const graph = await buildTaskGraph();
		const forest = await buildTaskForest();

		// Wald-Knoten flach einsammeln (jede ID kommt im Baum-Fall genau einmal vor).
		const forestNodes = new Map<number, (typeof forest)[number]>();
		const collect = (nodes: typeof forest): void => {
			for (const node of nodes) {
				forestNodes.set(node.id, node);
				collect(node.dependents);
			}
		};
		collect(forest);

		assert.equal(graph.nodes.length, forestNodes.size, 'Gleiche Knotenmenge wie der Wald');
		for (const node of graph.nodes) {
			const expected = forestNodes.get(node.id);
			assert.ok(expected, `Knoten #${node.id} fehlt im Wald`);
			assertClose(node.value, expected.value, `value von #${node.id}`);
			assertClose(node.totalEstimatedEffort, expected.totalEstimatedEffort, `totalEstimatedEffort von #${node.id}`);
			assert.deepEqual(node.progress, expected.progress, `progress von #${node.id}`);
		}
	});

	it('Setzt unabhängig von der Graphgröße nur eine konstante Zahl an Queries ab', async () => {
		// Regressionsschutz gegen das N+1-Verhalten von buildTaskForest (ein getDependencies()-Fetch
		// je Knoten und Teilbaum-Walk). Der Graph lädt Tasks, Kanten, Task-Säulen und Säulen je einmal.
		const tasks: Task[] = [];
		for (let index = 0; index < 30; index += 1) {
			tasks.push(await Task.create({ title: `T${index}`, priority: 3, estimatedEffort: 0.25 }));
		}
		for (let index = 1; index < 30; index += 1) {
			await tasks[index].addDependency(tasks[index - 1]);
		}

		let queries = 0;
		sequelize.addHook('beforeQuery', 'graphQueryCounter', () => {
			queries += 1;
		});
		try {
			await buildTaskGraph();
		} finally {
			sequelize.removeHook('beforeQuery', 'graphQueryCounter');
		}
		assert.ok(queries <= 8, `buildTaskGraph sollte höchstens 8 Queries absetzen, waren ${queries}`);
	});
});
