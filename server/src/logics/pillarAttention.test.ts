import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#328 / AK1): Das serverseitige Aufmerksamkeits-Modul existiert noch nicht. Der
// Import schlägt fehl, bis `server/src/logics/pillarAttention.ts` die hier eingeklagte Schnittstelle
// bereitstellt. Ziel ist EINE reine (DB-freie) Score-Aggregation je Säule, die sich der Advisor-
// Endpoint injizieren lässt. KEIN Produktivcode.
import { calculatePillarAttention, type PillarAttentionInput } from './pillarAttention.js';

/**
 * Vertrag für `calculatePillarAttention(pillars, now)` — die reine (DB-freie) Aggregation eines
 * Aufmerksamkeits-Scores je Säule. Der Score fasst drei Signale zusammen:
 *  (a) Unterversorgung: Abweichung `weight` (Soll-Anteil, 0–100) vs. `actualShare` (Ist-Anteil, 0–1)
 *      — je stärker eine Säule unter ihrem Soll bedient wird, desto höher der Score.
 *  (b) Anteil offener Aufgaben: `openCount / (openCount + doneCount)` — viele offene Tasks ziehen
 *      Aufmerksamkeit auf sich.
 *  (c) Staleness: Abstand `now − updatedAt` — je länger eine Säule nicht mehr bewegt wurde, desto
 *      höher der Score.
 *
 * Die Tests fixieren bewusst NICHT die konkrete Zahlen-Formel, sondern nur die Monotonie-/Ordnungs-
 * Eigenschaften: Bei sonst gleichen Eingaben erhält die unterversorgte / stärker veraltete / mit mehr
 * offenen Tasks behaftete Säule den höheren (bzw. mindestens gleich hohen) Score. Rückgabe ist je
 * Eingabe-Säule ein Eintrag `{ pillarId, score }`.
 */
describe('calculatePillarAttention — Score-Aggregation je Säule (#328)', () => {
	// Fester Bezugszeitpunkt, damit die Staleness deterministisch bleibt (kein `Date.now()`-Flackern).
	const now = new Date('2026-07-05T12:00:00.000Z');

	/** Neutraler Basis-Eintrag: ausgewogen, frisch, keine offenen Tasks — als Ausgangspunkt für Varianten. */
	const base = (pillarId: number, overrides: Partial<PillarAttentionInput> = {}): PillarAttentionInput => ({
		pillarId,
		weight: 20,
		actualShare: 0.2,
		openCount: 0,
		doneCount: 4,
		updatedAt: now,
		...overrides,
	});

	/** Bequemer Zugriff: Score der Säule `pillarId` aus dem Ergebnis-Array. */
	const scoreOf = (result: { pillarId: number; score: number }[], pillarId: number): number => {
		const entry = result.find((item) => item.pillarId === pillarId);
		assert.ok(entry, `Ergebnis enthält einen Eintrag für Säule ${pillarId}`);
		return entry.score;
	};

	it('liefert je Eingabe-Säule genau einen Score-Eintrag', () => {
		const result = calculatePillarAttention([base(1), base(2), base(3)], now);
		assert.equal(result.length, 3);
		assert.deepEqual(
			[...result].map((entry) => entry.pillarId).sort((a, b) => a - b),
			[1, 2, 3],
		);
	});

	it('Monotonie (a): unterversorgte Säule (actualShare < weight) erhält höheren Score als überversorgte', () => {
		// Säule A: deutlich unter ihrem Soll-Anteil (weight 20 % ⇒ Soll 0.2, Ist nur 0.02).
		const under = base(1, { actualShare: 0.02 });
		// Säule B: über ihrem Soll-Anteil (Ist 0.5 ≫ Soll 0.2) — gut bedient.
		const over = base(2, { actualShare: 0.5 });

		const result = calculatePillarAttention([under, over], now);
		assert.ok(
			scoreOf(result, 1) > scoreOf(result, 2),
			'unterversorgte Säule A hat einen höheren Aufmerksamkeits-Score als die überversorgte B',
		);
	});

	it('Monotonie (b): Säule mit hohem Anteil offener Tasks erhält mindestens so hohen Score wie eine mit allen erledigt', () => {
		// Säule E: fast nur offene Tasks. Säule F: alle Tasks erledigt. Sonst identisch.
		const manyOpen = base(1, { openCount: 8, doneCount: 0 });
		const allDone = base(2, { openCount: 0, doneCount: 8 });

		const result = calculatePillarAttention([manyOpen, allDone], now);
		assert.ok(
			scoreOf(result, 1) >= scoreOf(result, 2),
			'Säule mit vielen offenen Tasks hat einen mindestens gleich hohen Score wie die vollständig erledigte',
		);
	});

	it('Monotonie (c): stärker veraltete Säule (alt) erhält höheren Score als eine frische (heute)', () => {
		// Säule C: seit ~180 Tagen nicht mehr bewegt. Säule D: heute aktualisiert. Sonst identisch.
		const stale = base(1, { updatedAt: new Date('2026-01-06T12:00:00.000Z') });
		const fresh = base(2, { updatedAt: now });

		const result = calculatePillarAttention([stale, fresh], now);
		assert.ok(
			scoreOf(result, 1) > scoreOf(result, 2),
			'stark veraltete Säule C hat einen höheren Aufmerksamkeits-Score als die frische D',
		);
	});

	it('leere Eingabe → leeres Ergebnis (kein Fehler)', () => {
		assert.deepEqual(calculatePillarAttention([], now), []);
	});
});
