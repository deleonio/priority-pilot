import { describe, expect, it } from 'vitest';
import { fullPillarContributions } from './pillarContributions';

/**
 * Rote Spec-Tests für #2154 (AK1) — Verteilungshilfer `fullPillarContributions`
 * (Spec: docs/spec/issue-2154.md).
 *
 * Die E2E-Fixture-Verteilung muss seit #2077 server-valide sein: jeder Anteil in [5, 80],
 * Summe exakt 100, die Betonungs-Säule trägt den Höchstanteil. Die reine Logik liegt in
 * `src/lib/pillarContributions.ts` (Vitest excludiert `**/ e2e; /**`, `@playwright/test` crasht
 * unter jsdom) und wird aus `e2e/helpers.ts` re-exportiert — Signatur und Exportstelle der
 * neun Importstellen bleiben stabil. Rot, solange das Modul fehlt bzw. die alte Formel
 * (Betonung = 100 − (n−1)·5) für n = 2–4 Anteile > 80 liefert.
 */
describe('fullPillarContributions (#2154, AK1)', () => {
	const pillars = (n: number): Array<{ id: number }> => Array.from({ length: n }, (_, index) => ({ id: index + 1 }));

	it('AK1 — für n = 2–5: jeder Anteil in [5, 80], Summe exakt 100, Betonung trägt das Maximum', () => {
		for (const n of [2, 3, 4, 5]) {
			for (const emphasisIndex of [0, n - 1]) {
				const result = fullPillarContributions(pillars(n), emphasisIndex);
				expect(result).toHaveLength(n);
				expect(result.reduce((acc, entry) => acc + entry.share, 0)).toBe(100);
				for (const entry of result) {
					expect(entry.share).toBeGreaterThanOrEqual(5);
					expect(entry.share).toBeLessThanOrEqual(80);
				}
				expect(result[emphasisIndex]?.share).toBe(Math.max(...result.map((entry) => entry.share)));
			}
		}
	});

	it('AK1 — `confidence` wird nur gesetzt, wenn übergeben (Rückgabeform unverändert)', () => {
		const without = fullPillarContributions(pillars(5), 0);
		expect(without.every((entry) => !('confidence' in entry))).toBe(true);
		const withConfidence = fullPillarContributions(pillars(5), 0, 99);
		expect(withConfidence.every((entry) => entry.confidence === 99)).toBe(true);
	});
});
