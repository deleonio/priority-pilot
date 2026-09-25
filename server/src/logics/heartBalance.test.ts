import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneLebensbalance, berechneKadenzFuellstand } from './heartBalance.js';
import type { KadenzSaeule, KadenzTask } from './heartBalance.js';

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

/**
 * Rote Spec-Tests für #1638 (Spec docs/spec/issue-1638.md) — Kadenz-Modell.
 *
 * `berechneKadenzFuellstand` löst den Ist-Anteil-am-Gesamtaufwand-Füllstand durch die Erfüllung des
 * eigenen Soll-Rhythmus je Säule im 28-Tage-Fenster ab. Neue Funktion/Typen neben der bestehenden
 * `berechneLebensbalance` (die oben unverändert weitergetestet wird) — Produktionscode existiert für
 * diese Runde noch nicht, der Import schlägt legitim fehl (neue Funktionalität).
 */
describe('berechneKadenzFuellstand (#1638, docs/spec/issue-1638.md)', () => {
	const JETZT = new Date('2026-09-23T12:00:00Z');
	const TAG_MS = 24 * 60 * 60 * 1000;
	const vorTagen = (tage: number): Date => new Date(JETZT.getTime() - tage * TAG_MS);

	const SAEULEN: KadenzSaeule[] = [
		{ id: 1, name: 'Körper', rhythmusProWoche: 5, weight: 1 },
		{ id: 2, name: 'Beziehungen', rhythmusProWoche: 3, weight: 1 },
		{ id: 3, name: 'Mentale Gesundheit', rhythmusProWoche: 3, weight: 1 },
		{ id: 4, name: 'Wirksamkeit', rhythmusProWoche: 5, weight: 1 },
		{ id: 5, name: 'Sinn', rhythmusProWoche: 1, weight: 1 },
	];

	/** Erzeugt `anzahl` erledigte Tasks für eine Säule, verteilt über die letzten `tageZurueck` Tage. */
	const erledigteTasksFuer = (pillarId: number, anzahl: number, tageZurueck = 27): KadenzTask[] =>
		Array.from({ length: anzahl }, (_, i) => ({
			status: 'Done',
			estimatedEffort: 1,
			erledigtAm: vorTagen(anzahl > 1 ? (i / (anzahl - 1)) * tageZurueck : 0),
			pillars: [{ pillarId, share: 100 }],
		}));

	it('AK1/AK2: alle Säulen im Soll-Rhythmus bedient → erfuellung(Sinn) ≥ 0,8 und fill ≥ 0,8', () => {
		const tasks = SAEULEN.flatMap((saeule) => erledigteTasksFuer(saeule.id, saeule.rhythmusProWoche * 4));
		const result = berechneKadenzFuellstand(SAEULEN, tasks, JETZT);
		const sinn = result.saeulen.find((saeule) => saeule.id === 5);
		assert.ok(sinn, 'Säule Sinn muss im Ergebnis enthalten sein');
		assert.ok(sinn!.erfuellung >= 0.8, `erfuellung(Sinn)=${sinn!.erfuellung} muss ≥ 0,8 sein (AK1)`);
		assert.ok(result.fill >= 0.8, `fill=${result.fill} muss ≥ 0,8 sein (AK2)`);
	});

	it('AK3/AK4: Säule ohne Aktivität in 28 Tagen hat erfuellung 0 und fill < 1, punkte bleibt aber > 0', () => {
		const koerperAlt: KadenzTask = {
			status: 'Done',
			estimatedEffort: 5,
			erledigtAm: vorTagen(60),
			pillars: [{ pillarId: 1, share: 100 }],
		};
		const restTasks = SAEULEN.filter((saeule) => saeule.id !== 1).flatMap((saeule) =>
			erledigteTasksFuer(saeule.id, saeule.rhythmusProWoche * 4),
		);
		const result = berechneKadenzFuellstand(SAEULEN, [koerperAlt, ...restTasks], JETZT);
		const koerper = result.saeulen.find((saeule) => saeule.id === 1);
		assert.ok(koerper, 'Säule Körper muss im Ergebnis enthalten sein');
		assert.equal(koerper!.erfuellung, 0, 'erfuellung(Körper) muss 0 sein ohne Aktivität im 28-Tage-Fenster (AK3)');
		assert.ok(koerper!.punkte > 0, 'punkte(Körper) muss > 0 bleiben — alte Erledigung zählt weiter (AK4)');
		assert.ok(result.fill < 1, `fill=${result.fill} muss < 1 sein, wenn eine Säule ihr Soll nicht erfüllt (AK3)`);
	});

	it('AK6: keine erledigten Aufgaben → fill = 0 und hasPoints = false', () => {
		const result = berechneKadenzFuellstand(SAEULEN, [], JETZT);
		assert.equal(result.fill, 0, 'fill muss 0 sein ohne erledigte Aufgaben (AK6)');
		assert.equal(result.hasPoints, false, 'hasPoints muss false sein ohne erledigte Aufgaben (AK6)');
	});
});

/**
 * Rote Spec-Tests für #1663 (Spec docs/spec/issue-1663.md) — die Säulen-Gewichte wirken wieder im
 * Kadenz-Füllstand: Kombination aus soll-gewichteter und ungewichteter Komponente wie in
 * `berechneLebensbalance` (#1474, Strengste-Prinzip `min`), Defizit aus der Kadenz-Erfüllung (#1638).
 *
 * `KadenzSaeule` hat noch kein `weight` — der Spec-Test deklariert es per Intersection-Typ optional
 * (Produktiv-Typ unangetastet); die Produktionsrechnung muss es auswerten, damit diese Tests grün werden.
 */
describe('berechneKadenzFuellstand (#1663, docs/spec/issue-1663.md)', () => {
	const JETZT = new Date('2026-09-23T12:00:00Z');
	const TAG_MS = 24 * 60 * 60 * 1000;
	const vorTagen = (tage: number): Date => new Date(JETZT.getTime() - tage * TAG_MS);

	/** `KadenzSaeule` um das noch nicht existierende `weight` erweitert (optional, s. Blockkommentar). */
	type GewichteteKadenzSaeule = KadenzSaeule & { weight?: number };

	/** Vier Säulen mit gleichem Rhythmus: A bleibt unbedient, B–D erfüllen ihr Soll im Fenster. */
	const SAEULEN: GewichteteKadenzSaeule[] = [
		{ id: 1, name: 'A', rhythmusProWoche: 3 },
		{ id: 2, name: 'B', rhythmusProWoche: 3 },
		{ id: 3, name: 'C', rhythmusProWoche: 3 },
		{ id: 4, name: 'D', rhythmusProWoche: 3 },
	];
	/** B–D voll erfüllt (je 12 Erledigungen = 3/Woche × 4 Wochen), A ohne Erledigung im Fenster. */
	const tasks: KadenzTask[] = [2, 3, 4].flatMap((pillarId) =>
		Array.from({ length: 12 }, (_, i) => ({
			status: 'Done',
			estimatedEffort: 1,
			erledigtAm: vorTagen(i * 2),
			pillars: [{ pillarId, share: 100 }],
		})),
	);

	it('AK1: gleiche Gewichte (25/25/25/25) → unverändert die ungewichtete Formel 1 − √(Σ defizitᵢ² / n)', () => {
		const result = berechneKadenzFuellstand(
			SAEULEN.map((saeule) => ({ ...saeule, weight: 25 })),
			tasks,
			JETZT,
		);
		// Einziges Defizit ist A (Erfüllung 0): erwarteter Wert 1 − √(1/4) = 0,5 — Regressionwächter
		// für den Prod-Stand bei gleichen Gewichten (auch alle > 0 gleich).
		const erwartet = 1 - Math.sqrt(1 / 4);
		assert.ok(Math.abs(result.fill - erwartet) < 1e-9, `fill=${result.fill} muss ${erwartet} sein (AK1)`);
	});

	it('AK2: hoch gewichtete unbediente Säule senkt den Füllstand stärker als niedrig gewichtete', () => {
		const hoch = berechneKadenzFuellstand(
			[40, 20, 20, 20].map((weight, index) => ({ ...SAEULEN[index]!, weight })),
			tasks,
			JETZT,
		);
		const niedrig = berechneKadenzFuellstand(
			[10, 30, 30, 30].map((weight, index) => ({ ...SAEULEN[index]!, weight })),
			tasks,
			JETZT,
		);
		// A=40: gewichtete Komponente 1 − √0,4 ≈ 0,368 schlägt die ungewichtete (0,5).
		// A=10: gewichtete 1 − √0,1 ≈ 0,684, die ungewichtete (0,5) bestimmt den Wert (Strengste-Prinzip).
		assert.ok(Math.abs(hoch.fill - (1 - Math.sqrt(0.4))) < 1e-3, `fill=${hoch.fill} muss ≈ 0,368 sein (AK2)`);
		assert.ok(Math.abs(niedrig.fill - 0.5) < 1e-3, `fill=${niedrig.fill} muss ≈ 0,5 sein (AK2)`);
		assert.ok(hoch.fill < niedrig.fill, 'höheres Gewicht der unbedienten Säule muss den Füllstand senken (AK2)');
	});

	it('AK3: unbediente Säule mit Gewicht 0 senkt den Füllstand nicht → fill = 1', () => {
		const result = berechneKadenzFuellstand(
			[0, 34, 33, 33].map((weight, index) => ({ ...SAEULEN[index]!, weight })),
			tasks,
			JETZT,
		);
		assert.ok(Math.abs(result.fill - 1) < 1e-9, `fill=${result.fill} muss 1 sein, Säule ohne Ziel zählt nicht (AK3)`);
	});

	it('AK4: alle Gewichte 0 → derselbe Füllstand wie bei gleichen Gewichten', () => {
		const alleNull = berechneKadenzFuellstand(
			SAEULEN.map((saeule) => ({ ...saeule, weight: 0 })),
			tasks,
			JETZT,
		);
		const alleGleich = berechneKadenzFuellstand(
			SAEULEN.map((saeule) => ({ ...saeule, weight: 25 })),
			tasks,
			JETZT,
		);
		assert.ok(
			Math.abs(alleNull.fill - alleGleich.fill) < 1e-9,
			`fill(alle 0)=${alleNull.fill} muss fill(gleich)=${alleGleich.fill} entsprechen — Gleichverteilung als Soll (AK4)`,
		);
	});
});
