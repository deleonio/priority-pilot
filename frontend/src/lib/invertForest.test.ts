import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
// Dieser Import wird rot — die Implementierung fehlt noch
import { invertForest } from './invertForest';

/**
 * Roter TDD-Vertrag für #363 „Aufgabenliste invertieren".
 *
 * Der semantische Aufgabenwald (`GET /forest`) liefert heute die **Oberaufgaben als Wurzeln**; ihre
 * Unteraufgaben hängen als `dependents` (Kinder) darunter (siehe `server/src/logics/tree.ts`). Für die
 * gewünschte umgekehrte Leserichtung erzeugt der reine Frontend-Helper `invertForest` aus diesem
 * semantischen Wald einen **Anzeige-Wald**:
 *
 * - Neue Wurzeln = Blatt-Tasks des semantischen Waldes (`dependents.length === 0`), also die
 *   **Unter-/Einzelaufgaben**.
 * - Anzeige-Kinder eines Knotens = seine **Eltern** (Oberaufgaben) — die Kanten werden per `id`
 *   umgekehrt.
 * - Ein von N Unteraufgaben geteilter Elternknoten erscheint dadurch **N-fach** (je einmal unter jeder
 *   seiner Unteraufgaben) — ausdrücklich gewünscht (Issue #363, geklärte Entscheidung).
 * - Die neuen Wurzeln sind nach `value` **absteigend** sortiert (konsistent zu `buildTaskForest`).
 *
 * Wichtig für AK4: `invertForest` ist **rein** — der übergebene semantische Wald wird **nicht**
 * mutiert, damit Guard (`isDoneBlockedBySubtasks`) und Fortschritt (serverseitig `node.progress`)
 * weiterhin auf den unveränderten semantischen Unteraufgaben aufsetzen.
 *
 * Die Tests sind rot, bis `frontend/src/lib/invertForest.ts` existiert.
 */
const node = (id: number, value: number, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title: `T${id}`,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value,
	status: 'Open',
	dependents,
});

/** Die IDs der Anzeige-Kinder (Reihenfolge egal) eines Knotens. */
const childIds = (n: TaskTreeNode): number[] => n.dependents.map((c) => c.id);

describe('invertForest (#363 — Aufgabenwald-Inversion)', () => {
	it('AK2: eine Einzelaufgabe ohne Über-/Unteraufgabe liegt als Wurzel ohne Anzeige-Kinder', () => {
		const inverted = invertForest([node(1, 5)]);

		expect(inverted).toHaveLength(1);
		expect(inverted[0]?.id).toBe(1);
		expect(inverted[0]?.dependents).toHaveLength(0);
	});

	it('AK1: eine Unteraufgabe wird zur Wurzel, die Oberaufgabe zum Anzeige-Kind darunter', () => {
		// Semantisch: Oberaufgabe 1 mit einer Unteraufgabe 2.
		const semantic = [node(1, 10, [node(2, 4)])];

		const inverted = invertForest(semantic);

		// Die Unteraufgabe (2) liegt jetzt auf oberster Ebene.
		expect(inverted).toHaveLength(1);
		expect(inverted[0]?.id).toBe(2);

		// Die Oberaufgabe (1) erscheint als (Anzeige-)Kind der Unteraufgabe.
		expect(childIds(inverted[0]!)).toEqual([1]);
		// … und hat selbst keine weitere Oberaufgabe.
		expect(inverted[0]?.dependents[0]?.dependents).toHaveLength(0);
	});

	it('AK1 (mehrfach): eine Oberaufgabe mit zwei Unteraufgaben erscheint unter jeder von beiden', () => {
		// Semantisch: Oberaufgabe 1 mit zwei Unteraufgaben 2 und 3.
		const semantic = [node(1, 10, [node(2, 6), node(3, 4)])];

		const inverted = invertForest(semantic);

		// Beide Unteraufgaben liegen auf oberster Ebene.
		expect(inverted.map((n) => n.id).sort((a, b) => a - b)).toEqual([2, 3]);

		// Die geteilte Oberaufgabe (1) taucht unter jeder Unteraufgabe genau einmal auf (keine Dedupe).
		for (const root of inverted) {
			expect(childIds(root)).toEqual([1]);
		}
	});

	it('AK1 (mehrere Ebenen): eine Kette Ober→Unter→Blatt kehrt sich vollständig um', () => {
		// Semantisch: 1 (Wurzel) → 2 (Unteraufgabe) → 3 (Blatt).
		const semantic = [node(1, 9, [node(2, 6, [node(3, 3)])])];

		const inverted = invertForest(semantic);

		// Das Blatt (3) ist die einzige neue Wurzel.
		expect(inverted).toHaveLength(1);
		expect(inverted[0]?.id).toBe(3);

		// Aufklappen führt schrittweise nach oben: 3 → 2 → 1.
		const mid = inverted[0]!.dependents[0];
		expect(mid?.id).toBe(2);
		expect(childIds(mid!)).toEqual([1]);
		expect(mid?.dependents[0]?.dependents).toHaveLength(0);
	});

	it('sortiert die neuen Wurzeln nach value absteigend (konsistent zu buildTaskForest)', () => {
		// Drei unabhängige Einzelaufgaben mit unterschiedlichem Wert.
		const inverted = invertForest([node(1, 3), node(2, 9), node(3, 6)]);

		expect(inverted.map((n) => n.id)).toEqual([2, 3, 1]);
	});

	it('AK4: mutiert den semantischen Wald nicht (Guard/Fortschritt rechnen unverändert weiter)', () => {
		// Semantisch: Oberaufgabe 1 mit einer Unteraufgabe 2.
		const child = node(2, 4);
		const parent = node(1, 10, [child]);
		const semantic = [parent];

		invertForest(semantic);

		// Die Original-Kanten der Oberaufgabe bleiben unangetastet: 2 bleibt ihre Unteraufgabe.
		expect(parent.dependents).toHaveLength(1);
		expect(parent.dependents[0]?.id).toBe(2);
		// Das Blatt behält seine (leeren) semantischen Unteraufgaben.
		expect(child.dependents).toHaveLength(0);
	});
});
