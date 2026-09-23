import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { distributeWithMinimum, SHARE_MIN, SHARE_TOTAL } from './pillarShares.js';
import { toContributions } from './reassignTaskPillars.js';

/**
 * #1635: Die Neuberechnung verteilt KI-Vorschläge nach derselben Regel wie das Frontend beim Anlegen
 * (`suggestionsToContributions`, #1596). Die Erwartungswerte unten sind mit der Frontend-Funktion
 * für dieselben Eingaben berechnet (Säulen-IDs 6–10 in `id`-Reihenfolge) — ändert sich die Regel,
 * müssen beide Seiten und diese Tabelle gemeinsam angepasst werden.
 */
const IDS = [6, 7, 8, 9, 10];

const PARITY: { name: string; suggestions: { pillarId: number; confidence: number }[]; expected: number[][] }[] = [
	{
		name: 'ein Vorschlag mit niedriger Konfidenz: 80 % dort, 5 % auf jeder anderen Säule',
		suggestions: [{ pillarId: 10, confidence: 30 }],
		expected: [
			[5, 100],
			[5, 100],
			[5, 100],
			[5, 100],
			[80, 30],
		],
	},
	{
		name: 'zwei Vorschläge: proportional, der Rest am Mindestanteil',
		suggestions: [
			{ pillarId: 10, confidence: 70 },
			{ pillarId: 8, confidence: 40 },
		],
		expected: [
			[5, 100],
			[5, 100],
			[31, 40],
			[5, 100],
			[54, 70],
		],
	},
	{
		name: 'drei Vorschläge',
		suggestions: [
			{ pillarId: 6, confidence: 55 },
			{ pillarId: 7, confidence: 33 },
			{ pillarId: 9, confidence: 12 },
		],
		expected: [
			[49, 55],
			[30, 33],
			[5, 100],
			[11, 12],
			[5, 100],
		],
	},
	{
		name: 'alle Säulen vorgeschlagen: Rundung nach Largest-Remainder',
		suggestions: [
			{ pillarId: 6, confidence: 90 },
			{ pillarId: 7, confidence: 10 },
			{ pillarId: 8, confidence: 10 },
			{ pillarId: 9, confidence: 10 },
			{ pillarId: 10, confidence: 10 },
		],
		expected: [
			[69, 90],
			[8, 10],
			[8, 10],
			[8, 10],
			[7, 10],
		],
	},
];

describe('toContributions — gleiche Verteilung wie das Frontend (#1635)', () => {
	for (const { name, suggestions, expected } of PARITY) {
		it(name, () => {
			const result = toContributions(suggestions, IDS);
			assert.deepEqual(
				result.map((entry) => [entry.share, entry.confidence]),
				expected,
			);
			assert.deepEqual(
				result.map((entry) => entry.pillarId),
				IDS,
				'jede Säule des Kontos ist dabei',
			);
		});
	}

	it('lässt ohne gültigen Vorschlag die Zuordnung unverändert (leeres Ergebnis)', () => {
		assert.deepEqual(toContributions([], IDS), []);
		assert.deepEqual(toContributions([{ pillarId: 99, confidence: 80 }], IDS), [], 'fremde Säule');
		assert.deepEqual(toContributions([{ pillarId: 6, confidence: 0 }], IDS), [], 'Konfidenz 0');
	});

	it('ignoriert Dubletten und fremde Säulen', () => {
		const result = toContributions(
			[
				{ pillarId: 10, confidence: 30 },
				{ pillarId: 10, confidence: 90 },
				{ pillarId: 99, confidence: 50 },
			],
			IDS,
		);
		assert.deepEqual(
			result.map((entry) => entry.share),
			[5, 5, 5, 5, 80],
		);
	});
});

describe('distributeWithMinimum', () => {
	it('hält jeden Anteil ≥ SHARE_MIN und die Summe exakt bei SHARE_TOTAL', () => {
		for (const base of [
			[100, 0, 0, 0, 0],
			[1, 2, 3, 4, 90],
			[33, 33, 34, 0, 0],
			[0, 0, 0, 0, 0],
		]) {
			const shares = distributeWithMinimum(base);
			assert.equal(
				shares.reduce((acc, share) => acc + share, 0),
				SHARE_TOTAL,
			);
			assert.ok(
				shares.every((share) => share >= SHARE_MIN),
				`${JSON.stringify(base)} → ${JSON.stringify(shares)}`,
			);
		}
	});

	it('verteilt ohne verwertbare Vorgabe gleich', () => {
		assert.deepEqual(distributeWithMinimum([0, 0, 0, 0, 0]), [20, 20, 20, 20, 20]);
	});

	it('gibt einer einzelnen Säule 100 %', () => {
		assert.deepEqual(distributeWithMinimum([0]), [100]);
	});
});
