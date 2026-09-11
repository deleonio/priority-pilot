import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
import { buildBalancePriorities, sortTasksByBalance, virtualPriorityLabel, type BalanceTask } from './balancePriority';

/**
 * Vertrag des Rechenkerns der „Balance-Priorisierung" (Konzept: `docs/spec/issue-1220.md`, ohne
 * die dort beschriebene Snapshot-Mechanik — die Liste sortiert live):
 * Defizit-Mathematik nach `server/src/logics/find.ts` (Client-Übertragung), Ist-Quelle wie das
 * Dashboard (erledigter Aufwand je Säule), Score = Σ (share/100)·nDefizit, virtuelle Prio
 * 1–5 per Punktmapping und Sortierung mit der Original-Prio als stabilem Sekundärkriterium.
 */

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

const task = (
	id: number,
	priority: number,
	contributions: ReadonlyArray<{ pillarId: number; share: number }> = [],
): BalanceTask => ({
	id,
	priority,
	pillars: contributions,
});

describe('buildBalancePriorities', () => {
	it('gewichtet Säulen-Beitrag mit dem Versorgungsdefizit — niedrige Original-Prio kann oben liegen', () => {
		// Zwei Säulen, je die Hälfte des Soll. Gesamter erledigter Aufwand liegt in Säule 2 →
		// Säule 1 hat Defizit 1, Säule 2 Defizit 0.
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const doneEffort = new Map([[2, 10]]);

		// Task A: Original-Prio 1, zahlt voll in die unterversorgte Säule 1.
		// Task B: Original-Prio 5, zahlt voll in die versorgte Säule 2.
		const tasks = [task(101, 1, [{ pillarId: 1, share: 100 }]), task(102, 5, [{ pillarId: 2, share: 100 }])];

		const priorities = buildBalancePriorities(pillars, doneEffort, tasks);

		expect(priorities.get(101)?.balanceScore).toBeCloseTo(1);
		expect(priorities.get(102)?.balanceScore).toBeCloseTo(0);

		const sorted = sortTasksByBalance(tasks, priorities);
		// Der Defizit-Task steht trotz niedriger Original-Prio oben.
		expect(sorted.map((entry) => entry.id)).toEqual([101, 102]);
		// Die Original-Prio bleibt unangetastet (kein Überschreiben des Tasks).
		expect(sorted[0]?.priority).toBe(1);
		expect(sorted[1]?.priority).toBe(5);
	});

	it('mappt den Score auf virtuelle Prio 1–5 und labelt sie mit Tilde-Präfix', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const doneEffort = new Map([[2, 10]]);
		const tasks = [task(101, 1, [{ pillarId: 1, share: 100 }]), task(102, 5, [{ pillarId: 2, share: 100 }])];

		const priorities = buildBalancePriorities(pillars, doneEffort, tasks);

		// Score 1 → P5, Score 0 → P1 (1 + round(score · 4)).
		expect(priorities.get(101)?.virtualPriority).toBe(5);
		expect(priorities.get(102)?.virtualPriority).toBe(1);
		// KI-UX: virtuelles Badge darf mit dem echten nicht verwechselbar sein (~P{n} vs. P{n}).
		expect(virtualPriorityLabel(5)).toBe('~P5');
		expect(virtualPriorityLabel(1)).toBe('~P1');
	});

	it('verteilt Task-Anteile auf mehrere Säulen anteilig nach share', () => {
		const pillars = [pillar(1, 'Körper', 34), pillar(2, 'Geist', 33), pillar(3, 'Sinn', 33)];
		// Alles in Säule 3 erledigt → Säule 1 und 2 je Defizit 1, Säule 3 Defizit 0.
		const doneEffort = new Map([[3, 9]]);
		const halfAndHalf = task(201, 3, [
			{ pillarId: 1, share: 50 },
			{ pillarId: 3, share: 50 },
		]);
		const onlyDeficit = task(202, 3, [{ pillarId: 2, share: 100 }]);

		const priorities = buildBalancePriorities(pillars, doneEffort, [halfAndHalf, onlyDeficit]);

		expect(priorities.get(201)?.balanceScore).toBeCloseTo(0.5);
		expect(priorities.get(202)?.balanceScore).toBeCloseTo(1);
	});

	it('behandelt Säulen ohne Soll und Tasks ohne Säulen-Beitrag neutral', () => {
		// Säule 2 hat Gewicht 0 → kann kein Defizit haben, auch wenn dort nichts erledigt ist.
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 0)];
		const doneEffort = new Map([[1, 8]]);
		const neutral = task(301, 2);
		const zeroWeight = task(302, 2, [{ pillarId: 2, share: 100 }]);

		const priorities = buildBalancePriorities(pillars, doneEffort, [neutral, zeroWeight]);

		expect(priorities.get(301)?.balanceScore).toBeCloseTo(0);
		expect(priorities.get(302)?.balanceScore).toBeCloseTo(0);
	});

	it('verteilt bei Gesamtgewicht 0 gleichmäßig als Soll', () => {
		// Kein Soll gepflegt → Gleichverteilung (Muster vesselBalance.ts); Aufwand nur in Säule 1
		// → Säule 2 behält ihr volles Defizit.
		const pillars = [pillar(1, 'A', 0), pillar(2, 'B', 0)];
		const doneEffort = new Map([[1, 4]]);
		const tasks = [task(401, 3, [{ pillarId: 2, share: 100 }])];

		const priorities = buildBalancePriorities(pillars, doneEffort, tasks);

		expect(priorities.get(401)?.balanceScore).toBeCloseTo(1);
	});

	it('rechnet auf dem übergebenen Stand — geänderte Datenlage liefert neue Werte', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const tasks = [task(801, 1, [{ pillarId: 1, share: 100 }])];

		// Gesamter Aufwand in Säule 2 → Säule 1 unterversorgt; danach kippt der Aufwand.
		expect(buildBalancePriorities(pillars, new Map([[2, 10]]), tasks).get(801)?.balanceScore).toBeCloseTo(1);
		expect(buildBalancePriorities(pillars, new Map([[1, 10]]), tasks).get(801)?.balanceScore).toBeCloseTo(0);
	});
});

describe('sortTasksByBalance', () => {
	it('folgt der Original-Prio als Sekundärkriterium, wenn alle Säulen ausgeglichen sind', () => {
		// Ist = Soll (50/50-Gewichtung, Aufwand 1:1) → Defizit überall 0, Score überall 0.
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const doneEffort = new Map([
			[1, 5],
			[2, 5],
		]);
		const tasks = [
			task(501, 2, [{ pillarId: 1, share: 100 }]),
			task(502, 5, [{ pillarId: 2, share: 100 }]),
			task(503, 3), // kein Säulen-Beitrag → neutral (Score 0)
		];

		const sorted = sortTasksByBalance(tasks, buildBalancePriorities(pillars, doneEffort, tasks));

		expect(sorted.map((entry) => entry.id)).toEqual([502, 503, 501]);
	});

	it('sortiert bei Gleichstand von Score und Prio stabil — keine Gleichstands-Umsortierung', () => {
		const pillars = [pillar(1, 'A', 100)];
		const doneEffort = new Map([[1, 3]]);
		const first = task(601, 3, [{ pillarId: 1, share: 100 }]);
		const second = task(602, 3, [{ pillarId: 1, share: 100 }]);
		const third = task(603, 3, [{ pillarId: 1, share: 100 }]);

		const sorted = sortTasksByBalance(
			[first, second, third],
			buildBalancePriorities(pillars, doneEffort, [first, second, third]),
		);

		expect(sorted.map((entry) => entry.id)).toEqual([601, 602, 603]);
	});

	it('nimmt für Tasks ohne Eintrag im Ergebnis den neutralen Score 0', () => {
		// Einzige Säule, ihr Aufwand ist erledigt → Defizit 0, alle Scores 0. Es entscheidet also
		// allein der Tiebreak: `unknown` fehlt im Ergebnis und zählt wie Score 0 — seine Prio 5
		// bringt ihn nach oben.
		const pillars = [pillar(1, 'A', 100)];
		const known = task(811, 1, [{ pillarId: 1, share: 100 }]);
		const priorities = buildBalancePriorities(pillars, new Map([[1, 3]]), [known]);
		const unknown = task(812, 5, [{ pillarId: 1, share: 100 }]);

		expect(priorities.has(812)).toBe(false);
		expect(sortTasksByBalance([unknown, known], priorities).map((entry) => entry.id)).toEqual([812, 811]);
	});

	it('mutiert das Eingabe-Array nicht', () => {
		const pillars = [pillar(1, 'A', 50), pillar(2, 'B', 50)];
		const doneEffort = new Map([[2, 2]]);
		const tasks = [task(701, 5, [{ pillarId: 2, share: 100 }]), task(702, 1, [{ pillarId: 1, share: 100 }])];

		const sorted = sortTasksByBalance(tasks, buildBalancePriorities(pillars, doneEffort, tasks));

		expect(sorted.map((entry) => entry.id)).toEqual([702, 701]);
		expect(tasks.map((entry) => entry.id)).toEqual([701, 702]);
	});
});
