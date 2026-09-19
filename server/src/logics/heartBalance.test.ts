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

/**
 * Rote Spec-Tests für #1474 (Spec docs/spec/issue-1474.md), AK4 — Parität mit den gepinnten
 * Frontend-Werten der neuen Formel (Strengste-Prinzip: min aus soll-gewichteter und ungewichteter
 * Komponente). Die Erwartungswerte sind die aus `frontend/src/lib/heartBalance.test.ts` gepinnten
 * Zahlen; der Server muss sie für gleichwertige Eingänge auf mindestens 4 Dezimalen treffen.
 */
describe('berechneLebensbalance (#1474 AK4 Parität)', () => {
	it('Problemfall 60/0/10/10/10 bei Gewichten 60/10/10/10/10 → 0,5528', () => {
		const saeulen: Saeule[] = [60, 10, 10, 10, 10].map((weight, index) => ({
			id: index + 1,
			name: `S${index + 1}`,
			weight,
		}));
		const tasks: TaskFixture[] = [
			{ status: 'Done', estimatedEffort: 60, pillars: [{ pillarId: 1, share: 100 }] },
			{ status: 'Done', estimatedEffort: 10, pillars: [{ pillarId: 3, share: 100 }] },
			{ status: 'Done', estimatedEffort: 10, pillars: [{ pillarId: 4, share: 100 }] },
			{ status: 'Done', estimatedEffort: 10, pillars: [{ pillarId: 5, share: 100 }] },
		];

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - 0.5527864045) < 1e-4,
			`fill=${result.fill} muss dem gepinnten Frontend-Wert 0,5527864 entsprechen (AK1/#1474)`,
		);
	});

	it('gefüllter Fall 60/10/10/10/10 → 1,0', () => {
		const saeulen: Saeule[] = [60, 10, 10, 10, 10].map((weight, index) => ({
			id: index + 1,
			name: `S${index + 1}`,
			weight,
		}));
		const tasks: TaskFixture[] = [60, 10, 10, 10, 10].map((effort, index) => ({
			status: 'Done' as const,
			estimatedEffort: effort,
			pillars: [{ pillarId: index + 1, share: 100 }],
		}));

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - 1) < 1e-4,
			`fill=${result.fill} muss dem gepinnten Frontend-Wert 1 entsprechen (AK2/#1474)`,
		);
	});

	it('Ausgangsfall 16/20/5/12/47 → unverändert 0,5634', () => {
		const saeulen: Saeule[] = [20, 20, 20, 20, 20].map((weight, index) => ({
			id: index + 1,
			name: `S${index + 1}`,
			weight,
		}));
		const tasks: TaskFixture[] = [16, 20, 5, 12, 47].map((effort, index) => ({
			status: 'Done' as const,
			estimatedEffort: effort,
			pillars: [{ pillarId: index + 1, share: 100 }],
		}));

		const result = berechneLebensbalance(saeulen, tasks);
		assert.ok(
			Math.abs(result.fill - 0.5633937701) < 1e-4,
			`fill=${result.fill} muss dem gepinnten Frontend-Wert 0,5633938 entsprechen (AK3/#1474)`,
		);
	});
});
