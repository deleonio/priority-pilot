import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOURS_PER_EFFORT_DAY, MAX_EFFORT, MIN_EFFORT, effortFromHours } from './effort.js';

/**
 * Rote Spec-Tests für #2690 (Spec docs/spec/issue-2690.md) — die Effort-Umrechnung (Stunden →
 * Tage-Feld 0.1–1 zu je 14 h) wandert aus `mcp/tools.ts` in das geteilte Logik-Modul
 * `logics/effort.ts`; die Route validiert künftig gegen dieselben exportierten Grenzen.
 */
describe('effortFromHours', () => {
	it('rechnet 7 h in einen halben Tag (0.5) um', () => {
		assert.equal(effortFromHours(7), 0.5);
	});

	it('kappt oben bei einem Tag (42 h → 1) statt einen Fehler zu werfen', () => {
		assert.equal(effortFromHours(42), 1);
	});

	it('kappt unten bei 0.1 (0.5 h → 0.1) statt einen Fehler zu werfen', () => {
		assert.equal(effortFromHours(0.5), 0.1);
	});

	it('rundet krumme Divisionen auf zwei Nachkommastellen (3 h → 0.21)', () => {
		assert.equal(effortFromHours(3), 0.21);
	});

	it('wirft für nicht-endliche oder nicht-positive Eingaben die bestehende MCP-Fehlermeldung', () => {
		// Byte-identischer Vertrag zu mcp/tools.ts — der Client darf den Fehlertext nicht verlieren.
		for (const invalid of ['3', undefined, null, Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
			assert.throws(() => effortFromHours(invalid), {
				message: 'estimatedEffortHours must be a finite number > 0.',
			});
		}
	});
});

describe('effort-Grenzen (von Route und MCP geteilt)', () => {
	it('exportiert die Skala: 14 h je Tag, Tage von 0.1 bis 1', () => {
		assert.equal(HOURS_PER_EFFORT_DAY, 14);
		assert.equal(MIN_EFFORT, 0.1);
		assert.equal(MAX_EFFORT, 1);
	});
});
