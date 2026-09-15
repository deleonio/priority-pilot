import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneLebensbalance } from './heartBalance.js';

/**
 * Rote Spec-Tests für #1423 (Spec docs/spec/issue-1423.md), AK4 — Paritätstest.
 *
 * `berechneLebensbalance` ist die Server-Portierung von `buildHeartBalance`/`buildPillarBalances`
 * (frontend/src/lib/heartBalance.ts, frontend/src/lib/pillar.ts:131-190 via Dashboard.tsx). Diese
 * Tests rechnen die Dashboard-Formel unabhängig hier im Test nach (kein Import aus dem Frontend,
 * das ist keine Server-Abhängigkeit) und vergleichen den Füllstand — Abweichung < 1e-9.
 */

interface Saeule {
	id: number;
	name: string;
	weight: number;
}

interface TaskFixture {
	status: 'Open' | 'In process' | 'Done';
	estimatedEffort: number;
	pillars: { pillarId: number; share: number }[];
}

/** Rechnet den erwarteten Füllstand unabhängig nach (Dashboard.tsx:131-147, pillar.ts:161-190). */
const erwarteterFuellstand = (saeulen: Saeule[], tasks: TaskFixture[]): number => {
	const punkte = new Map<number, number>(saeulen.map((s) => [s.id, 0]));
	for (const task of tasks) {
		if (task.status !== 'Done') continue;
		for (const beitrag of task.pillars) {
			punkte.set(beitrag.pillarId, (punkte.get(beitrag.pillarId) ?? 0) + task.estimatedEffort * (beitrag.share / 100));
		}
	}
	const totalWeight = saeulen.reduce((sum, s) => sum + s.weight, 0);
	if (totalWeight > 0) {
		for (const task of tasks) {
			if (task.status === 'Done' && task.pillars.length === 0) {
				for (const s of saeulen) {
					punkte.set(s.id, (punkte.get(s.id) ?? 0) + task.estimatedEffort * (s.weight / totalWeight));
				}
			}
		}
	}
	const totalPoints = [...punkte.values()].reduce((sum, p) => sum + p, 0);
	if (totalPoints === 0) return 0;

	const targetShares = saeulen.map((s) => (totalWeight > 0 ? s.weight / totalWeight : 1 / saeulen.length));
	const spread = saeulen.reduce((sum, s, index) => {
		const targetShare = targetShares[index];
		const actualShare = (punkte.get(s.id) ?? 0) / totalPoints;
		const deficit = targetShare > 0 ? 1 - Math.min(1, actualShare / targetShare) : 1;
		return sum + targetShare * deficit ** 2;
	}, 0);
	const mitZiel = targetShares.filter((t) => t > 0);
	const worstSpread = mitZiel.length > 1 ? 1 - Math.min(...mitZiel) : mitZiel.length === 1 ? 1 : 0;
	if (worstSpread === 0) return 1;
	return Math.max(0, 1 - Math.sqrt(spread / worstSpread));
};

describe('berechneLebensbalance (#1423 AK4)', () => {
	it('stimmt mit der unabhängig nachgerechneten Dashboard-Formel überein, wenn Ist auf Soll liegt', () => {
		const saeulen: Saeule[] = [
			{ id: 1, name: 'Körper', weight: 50 },
			{ id: 2, name: 'Geist', weight: 30 },
			{ id: 3, name: 'Beziehung', weight: 20 },
		];
		const tasks: TaskFixture[] = [
			{ status: 'Done', estimatedEffort: 1, pillars: [{ pillarId: 1, share: 100 }] },
			{ status: 'Done', estimatedEffort: 0.6, pillars: [{ pillarId: 2, share: 100 }] },
			{ status: 'Done', estimatedEffort: 0.4, pillars: [{ pillarId: 3, share: 100 }] },
		];

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - erwarteterFuellstand(saeulen, tasks)) < 1e-9,
			`fill=${result.fill} muss der nachgerechneten Formel entsprechen`,
		);
		assert.equal(result.hasPoints, true);
	});

	it('AK4 Randfall "keine Punkte": fill 0, hasPoints false, jede Säule punkte 0', () => {
		const saeulen: Saeule[] = [{ id: 1, name: 'Körper', weight: 100 }];
		const result = berechneLebensbalance(saeulen, []);

		assert.equal(result.fill, 0);
		assert.equal(result.hasPoints, false);
		assert.deepEqual(
			result.saeulen.map((s) => s.punkte),
			[0],
		);
	});

	it('AK4 Randfall "alle Gewichte 0": Gleichverteilung als Soll', () => {
		const saeulen: Saeule[] = [
			{ id: 1, name: 'A', weight: 0 },
			{ id: 2, name: 'B', weight: 0 },
		];
		const tasks: TaskFixture[] = [
			{ status: 'Done', estimatedEffort: 5, pillars: [{ pillarId: 1, share: 100 }] },
			{ status: 'Done', estimatedEffort: 5, pillars: [{ pillarId: 2, share: 100 }] },
		];

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - erwarteterFuellstand(saeulen, tasks)) < 1e-9,
			`fill=${result.fill} muss der nachgerechneten Formel entsprechen (hier: 1)`,
		);
		assert.ok(Math.abs(result.fill - 1) < 1e-9);
	});

	it('AK4 Randfall "Soll einer Säule = 0": ihre Punkte zählen nicht auf den Füllstand ein', () => {
		const saeulen: Saeule[] = [
			{ id: 1, name: 'Mit Soll', weight: 100 },
			{ id: 2, name: 'Ohne Soll', weight: 0 },
		];
		const tasks: TaskFixture[] = [{ status: 'Done', estimatedEffort: 1, pillars: [{ pillarId: 2, share: 100 }] }];

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - erwarteterFuellstand(saeulen, tasks)) < 1e-9,
			`fill=${result.fill} muss der nachgerechneten Formel entsprechen (hier: 0)`,
		);
		assert.ok(Math.abs(result.fill - 0) < 1e-9);
	});
});
