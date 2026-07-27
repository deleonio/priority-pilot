import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, Task } from '../models/index.js';
import { calculateValueContribution } from './value.js';
import { resetDb, closeDb } from '../test/helpers.js';

/**
 * Helfer: Berechnet den erwarteten Faktor mit dynamischem Neutralgewicht 100/N.
 *
 * Formel (Issue #423):
 *   factor = Σ (shareᵢ/100) · [1 + (confᵢ/100) · (weightᵢ · N / 100 − 1)]
 *
 * Für einen einzelnen Beitrag (share=100, conf=c):
 *   factor = 1 + (c/100) · (weight · N / 100 − 1)
 */
const expectedFactor = (weight: number, N: number, confidence: number, share: number = 100): number => {
	const s = share / 100;
	const c = confidence / 100;
	return s * (1 + c * ((weight * N) / 100 - 1));
};

beforeEach(resetDb);
after(closeDb);

describe('calculateValueContribution', () => {
	it('Blatt-Task: Wert = priority', async () => {
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	it('Blatt-Task mit priority 1: Wert = 1', async () => {
		const task = await Task.create({ title: 'Leaf2', priority: 1, estimatedEffort: 0.5 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 1);
	});

	it('Ein Dependent mit default weight 1: (childValue * 1 + priority) / 2', async () => {
		// parent.getDependents() = [child]
		// child is leaf: value = child.priority / 1 = 3
		// parent value = (3 * 1 + 5) / (1 + 1) = 8/2 = 4
		const parent = await Task.create({ title: 'Parent', priority: 5, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1 });
		// child depends on parent: child.addDependency(parent) => parent has child as dependent
		await child.addDependency(parent);
		const value = await calculateValueContribution(parent);
		assert.equal(value, 4);
	});

	it('Gewichteter Dependent: Kantengewicht wird berücksichtigt', async () => {
		// parent.getDependents() = [child with weight 2]
		// child value = 4
		// parent value = (4 * 2 + 5) / (1 + 1) = (8 + 5) / 2 = 6.5
		const parent = await Task.create({ title: 'P', priority: 5, estimatedEffort: 1 });
		const child = await Task.create({ title: 'C', priority: 4, estimatedEffort: 1 });
		await child.addDependency(parent, { through: { weight: 2 } });
		const value = await calculateValueContribution(parent);
		assert.equal(value, 6.5);
	});

	it('Konkreter Zahlenfall: zwei dependents', async () => {
		// root is leaf with priority 2 → value = 2
		// mid1 depends on root (weight 1), mid1 priority = 4
		//   mid1 getDependents = [] (no one depends on mid1), wait — getDependents is children in tree
		//
		// Let's be precise:
		// A is the task under test
		// B and C are tasks that depend on A (B.addDependency(A), C.addDependency(A))
		// so A.getDependents() = [B, C]
		// B is leaf: value(B) = B.priority = 5
		// C is leaf: value(C) = C.priority = 2
		// value(A) = (value(B)*weight(B) + value(C)*weight(C) + A.priority) / (2 + 1)
		//          = (5*1 + 2*1 + 3) / 3 = 10/3
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 5, estimatedEffort: 1 });
		const c = await Task.create({ title: 'C', priority: 2, estimatedEffort: 1 });
		await b.addDependency(a);
		await c.addDependency(a);
		const value = await calculateValueContribution(a);
		assert.ok(Math.abs(value - 10 / 3) < 1e-10, `Expected ${10 / 3} but got ${value}`);
	});

	it('Säule mit Gleichverteilung (weight 20, 100 % Anteil/Konfidenz): neutral, Wert = priority', async () => {
		const pillar = await Pillar.create({ name: 'Neutral', weight: 20 });
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		await task.addPillar(pillar.id, { through: { share: 100, confidence: 100 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	it('Höher gewichtete Säule (weight 40, 100 %/100 %): Faktor 2, Wert = priority * 2', async () => {
		const pillar = await Pillar.create({ name: 'Hoch', weight: 40 });
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		await task.addPillar(pillar.id, { through: { share: 100, confidence: 100 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 10);
	});

	it('Niedriger gewichtete Säule (weight 10, 100 %/100 %): Faktor 0.5, Wert = priority * 0.5', async () => {
		const pillar = await Pillar.create({ name: 'Niedrig', weight: 10 });
		const task = await Task.create({ title: 'Leaf', priority: 4, estimatedEffort: 1 });
		await task.addPillar(pillar.id, { through: { share: 100, confidence: 100 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 2);
	});

	it('Task ohne Säule: Faktor 1 (unverändert)', async () => {
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	it('Zwei Säulen 50/50 (weight 40 & 20, Konfidenz 100 %): Faktor 1.5', async () => {
		// factor = 0.5·[1 + 1·(40/20 − 1)] + 0.5·[1 + 1·(20/20 − 1)] = 0.5·2 + 0.5·1 = 1.5
		const hoch = await Pillar.create({ name: 'Hoch', weight: 40 });
		const neutral = await Pillar.create({ name: 'Neutral', weight: 20 });
		const task = await Task.create({ title: 'Leaf', priority: 4, estimatedEffort: 1 });
		await task.addPillar(hoch.id, { through: { share: 50, confidence: 100 } });
		await task.addPillar(neutral.id, { through: { share: 50, confidence: 100 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 6); // 4 · 1.5
	});

	it('Konfidenz interpoliert zu neutral: weight 40, Konfidenz 50 % ⇒ Faktor 1.5', async () => {
		// factor = 1·[1 + 0.5·(40/20 − 1)] = 1 + 0.5 = 1.5
		const hoch = await Pillar.create({ name: 'Hoch', weight: 40 });
		const task = await Task.create({ title: 'Leaf', priority: 4, estimatedEffort: 1 });
		await task.addPillar(hoch.id, { through: { share: 100, confidence: 50 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 6); // 4 · 1.5
	});

	it('Konfidenz 0 %: Säule bleibt neutral (Faktor 1)', async () => {
		const hoch = await Pillar.create({ name: 'Hoch', weight: 40 });
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		await task.addPillar(hoch.id, { through: { share: 100, confidence: 0 } });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5); // 5 · 1
	});

	it('Säulen-Faktor wirkt auf jeden Task im Baum (Dependent mit höher gewichteter Säule)', async () => {
		// parent.getDependents() = [child], child mit Säule weight 40 (100 %/100 %) ⇒ Faktor 2
		// child (Blatt) value = child.priority * 2 = 3 * 2 = 6
		// parent ohne Säule ⇒ Faktor 1: value = (6 * 1 + 5) / (1 + 1) = 5.5
		const pillar = await Pillar.create({ name: 'Hoch', weight: 40 });
		const parent = await Task.create({ title: 'Parent', priority: 5, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1 });
		await child.addPillar(pillar.id, { through: { share: 100, confidence: 100 } });
		await child.addDependency(parent);
		const value = await calculateValueContribution(parent);
		assert.equal(value, 5.5);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Issue #423 — Dynamischer Säulen-Faktor bei beliebiger Säulenzahl N
// ═══════════════════════════════════════════════════════════════════════════

describe('Issue #423 — Säulen-Faktor mit dynamischem Neutralgewicht (rote Spec-Tests)', () => {
	// ── AK1: Gleichverteilung ⇒ Faktor 1 ──────────────────────────────────
	for (const N of [1, 2, 4, 10]) {
		it(`AK1: N=${N} gleichgewichtete Säulen (je ${(100 / N).toFixed(3)} %) ⇒ Faktor 1`, async () => {
			const userId = 1;
			// N Säulen mit je 100/N Gewicht anlegen
			const pillarIds: number[] = [];
			for (let i = 0; i < N; i++) {
				const p = await Pillar.create({ name: `S${i + 1}`, weight: 100 / N, userId });
				pillarIds.push(p.id);
			}

			const task = await Task.create({ title: 'AK1', priority: 3, estimatedEffort: 1, userId });
			const equalShare = 100 / N;
			for (const pid of pillarIds) {
				await task.addPillar(pid, { through: { share: equalShare, confidence: 100 } });
			}

			const value = await calculateValueContribution(task);
			assert.ok(Math.abs(value - 3) < 1e-10, `N=${N}: expected value=3 (Faktor 1) but got ${value}`);
		});
	}

	// ── AK3: Über-/untergewichtete Säulen ─────────────────────────────────
	it('AK3: N=3, übergewichtete Säule (weight=60, neutral=33.3) ⇒ Faktor 1.8', async () => {
		const userId = 1;
		await Pillar.create({ name: 'A', weight: 10, userId });
		await Pillar.create({ name: 'B', weight: 30, userId });
		const pc = await Pillar.create({ name: 'C', weight: 60, userId });

		const task = await Task.create({ title: 'AK3-over', priority: 5, estimatedEffort: 1, userId });
		await task.addPillar(pc.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 5 * expectedFactor(60, 3, 100); // 5 * 1.8 = 9
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	it('AK3: N=3, untergewichtete Säule (weight=10, neutral=33.3) ⇒ Faktor 0.3', async () => {
		const userId = 1;
		const pa = await Pillar.create({ name: 'A', weight: 10, userId });
		await Pillar.create({ name: 'B', weight: 30, userId });
		await Pillar.create({ name: 'C', weight: 60, userId });

		const task = await Task.create({ title: 'AK3-under', priority: 5, estimatedEffort: 1, userId });
		await task.addPillar(pa.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 5 * expectedFactor(10, 3, 100); // 5 * 0.3 = 1.5
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	it('AK3: Konfidenz interpoliert: N=3, weight=60, conf=50 ⇒ Faktor 1.4', async () => {
		const userId = 1;
		await Pillar.create({ name: 'A', weight: 10, userId });
		await Pillar.create({ name: 'B', weight: 30, userId });
		const pc = await Pillar.create({ name: 'C', weight: 60, userId });

		const task = await Task.create({ title: 'AK3-conf', priority: 5, estimatedEffort: 1, userId });
		await task.addPillar(pc.id, { through: { share: 100, confidence: 50 } });

		const value = await calculateValueContribution(task);
		// factor = 1 + 0.5*(1.8−1) = 1.4, value = 5 * 1.4 = 7
		const expected = 5 * expectedFactor(60, 3, 50); // 5 * 1.4 = 7
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	// ── AK4: Edge-Cases — kein NaN/Infinity ──────────────────────────────
	it('AK4: N=0 (keine Säulen für den Nutzer) ⇒ Faktor 1, kein NaN/Infinity', async () => {
		// Keine Pillars im System für userId=99
		const task = await Task.create({
			title: 'AK4-nopillars',
			priority: 3,
			estimatedEffort: 1,
			userId: 99,
		});
		// Task hat keine Beiträge (keine Säulen existieren) ⇒ Faktor 1
		const value = await calculateValueContribution(task);
		assert.equal(value, 3);
	});

	it('AK4: Task ohne Säulen-Beiträge (aber Säulen existieren) ⇒ Faktor 1', async () => {
		const userId = 1;
		// Säulen existieren für den Nutzer
		await Pillar.create({ name: 'A', weight: 50, userId });
		await Pillar.create({ name: 'B', weight: 50, userId });

		const task = await Task.create({ title: 'AK4-nocontrib', priority: 3, estimatedEffort: 1, userId });
		// Task ist KEINER Säule zugewiesen
		const value = await calculateValueContribution(task);
		assert.equal(value, 3);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Issue #429 — Bewertungslogik (Säulen-Faktor) auf beliebige Säulenzahl
// Epic #420 Schritt 3/5 („Beliebige, nutzerdefinierte Säulen").
//
// Diese Spec-Tests sind der Vertrag für #429: sie verlangen, dass der Säulen-Faktor
// für beliebige Nutzer-Säulenzahlen (N) korrekt arbeitet — Neutralpunkt 100/N,
// Über-/Untergewicht relativ zu 100/N, keine Beiträge ⇒ 1, und Robustheit (N=1)
// ohne NaN/Infinity. Sie grünen, sobald die dynamische Formel (weight·N/100) greift.
// ═══════════════════════════════════════════════════════════════════════════

describe('Issue #429 — Säulen-Faktor auf beliebige Säulenzahl (rote Spec-Tests)', () => {
	// ── AK1: Gleichverteilung neutral für N=3 (auf einzelne Säule) ────────
	it('AK1: N=3, Task zahlt 100 %/100 % auf eine gleichgewichtete Säule (33,33 %) ⇒ Faktor 1', async () => {
		const userId = 1;
		// Drei Säulen à 100/3 Gewicht (Gleichverteilung)
		await Pillar.create({ name: 'A', weight: 100 / 3, userId });
		await Pillar.create({ name: 'B', weight: 100 / 3, userId });
		const pc = await Pillar.create({ name: 'C', weight: 100 / 3, userId });

		const task = await Task.create({ title: 'AK1-429', priority: 5, estimatedEffort: 1, userId });
		// Task zahlt 100 % Konfidenz 100 % auf EINE Säule (die gleichgewichtet ist)
		await task.addPillar(pc.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 5 * expectedFactor(100 / 3, 3, 100); // ≈ 5 * 1
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} (Faktor 1) but got ${value}`);
		assert.ok(Math.abs(value - 5) < 1e-6, `N=3 Gleichverteilung muss neutral sein (Wert=priority) but got ${value}`);
	});

	// ── AK2: Über-/Untergewicht relativ zu 100/N ist linear ──────────────
	it('AK2: N=3, übergewichtige Säule (weight=60 > 33,3) ⇒ Faktor > 1', async () => {
		const userId = 1;
		await Pillar.create({ name: 'A', weight: 20, userId });
		await Pillar.create({ name: 'B', weight: 20, userId });
		const pc = await Pillar.create({ name: 'C', weight: 60, userId });

		const task = await Task.create({ title: 'AK2-over', priority: 5, estimatedEffort: 1, userId });
		await task.addPillar(pc.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 5 * expectedFactor(60, 3, 100); // Faktor 1.8
		assert.ok(value > 5, `Übergewicht muss Faktor > 1 ⇒ Wert > priority, got ${value}`);
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	it('AK2: N=3, untergewichtige Säule (weight=10 < 33,3) ⇒ Faktor < 1', async () => {
		const userId = 1;
		const pa = await Pillar.create({ name: 'A', weight: 10, userId });
		await Pillar.create({ name: 'B', weight: 45, userId });
		await Pillar.create({ name: 'C', weight: 45, userId });

		const task = await Task.create({ title: 'AK2-under', priority: 5, estimatedEffort: 1, userId });
		await task.addPillar(pa.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 5 * expectedFactor(10, 3, 100); // Faktor 0.3
		assert.ok(value < 5, `Untergewicht muss Faktor < 1 ⇒ Wert < priority, got ${value}`);
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	it('AK2: Faktor verhält sich linear in weight (100/N ist Neutralpunkt)', async () => {
		const userId = 1;
		const N = 4;
		const neutral = 100 / N; // 25
		// weight = 2·neutral ⇒ Faktor muss genau 2 sein (lineare Skalierung)
		const p = await Pillar.create({ name: 'Doppel', weight: 2 * neutral, userId });
		// drei weitere Säulen (damit N=4 für diesen Nutzer gilt)
		await Pillar.create({ name: 'F1', weight: neutral, userId });
		await Pillar.create({ name: 'F2', weight: neutral, userId });
		await Pillar.create({ name: 'F3', weight: neutral, userId });

		const task = await Task.create({ title: 'AK2-linear', priority: 4, estimatedEffort: 1, userId });
		await task.addPillar(p.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 4 * expectedFactor(2 * neutral, N, 100); // 4 * 2 = 8
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} (Faktor 2) but got ${value}`);
	});

	// ── AK3: Task ohne Säulen-Beiträge ⇒ Faktor exakt 1 ──────────────────
	it('AK3: Task ohne Säulen-Beiträge bei N=3 ⇒ Faktor exakt 1 (Wert = priority)', async () => {
		const userId = 1;
		await Pillar.create({ name: 'X', weight: 60, userId });
		await Pillar.create({ name: 'Y', weight: 30, userId });
		await Pillar.create({ name: 'Z', weight: 10, userId });

		const task = await Task.create({ title: 'AK3-429', priority: 5, estimatedEffort: 1, userId });
		// KEINE addPillar — Task zahlt auf keine Säule
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	// ── AK4: Robust nach Löschen — N=1, kein NaN/Infinity ────────────────
	it('AK4: nur noch 1 Säule (N=1) ⇒ kein NaN/Infinity, Faktor nach Formel', async () => {
		const userId = 1;
		// Genau EINE Säule (N=1); Neutralpunkt wäre 100/1 = 100.
		// weight 50 < 100 ⇒ Faktor 0.5 (wohldefiniert, kein NaN)
		const p = await Pillar.create({ name: 'Solo', weight: 50, userId });

		const task = await Task.create({ title: 'AK4-N1', priority: 4, estimatedEffort: 1, userId });
		await task.addPillar(p.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		const expected = 4 * expectedFactor(50, 1, 100); // 4 * 0.5 = 2
		assert.ok(Number.isFinite(value), `N=1 darf kein NaN/Infinity ergeben, got ${value}`);
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} but got ${value}`);
	});

	it('AK4: N=1 mit Neutralgewicht (weight=100) ⇒ Faktor 1, kein NaN', async () => {
		const userId = 1;
		const p = await Pillar.create({ name: 'SoloNeutral', weight: 100, userId });

		const task = await Task.create({ title: 'AK4-N1-neutral', priority: 3, estimatedEffort: 1, userId });
		await task.addPillar(p.id, { through: { share: 100, confidence: 100 } });

		const value = await calculateValueContribution(task);
		assert.ok(Number.isFinite(value), `N=1 darf kein NaN/Infinity ergeben, got ${value}`);
		assert.ok(Math.abs(value - 3) < 1e-10, `Expected 3 (Faktor 1) but got ${value}`);
	});

	it('AK4: Säulen werden gelöscht bis N=1 ⇒ Faktor bleibt endlich (kein NaN)', async () => {
		const userId = 1;
		const p1 = await Pillar.create({ name: 'Bleibt', weight: 40, userId });
		const p2 = await Pillar.create({ name: 'Weg1', weight: 30, userId });
		const p3 = await Pillar.create({ name: 'Weg2', weight: 30, userId });

		const task = await Task.create({ title: 'AK4-shrink', priority: 4, estimatedEffort: 1, userId });
		await task.addPillar(p1.id, { through: { share: 100, confidence: 100 } });

		// Zwei Säulen löschen — N fällt auf 1
		await p2.destroy();
		await p3.destroy();

		const value = await calculateValueContribution(task);
		assert.ok(Number.isFinite(value), `Nach Löschen darf kein NaN/Infinity entstehen, got ${value}`);
		const expected = 4 * expectedFactor(40, 1, 100); // 4 * 0.4 = 1.6
		assert.ok(Math.abs(value - expected) < 1e-10, `Expected ${expected} (N=1) but got ${value}`);
	});
});
