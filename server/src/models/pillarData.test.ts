import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PILLAR_RHYTHMS } from './pillarData.js';

/**
 * Roter Spec-Test für #1638 (Spec docs/spec/issue-1638.md), AK8 — Soll-Rhythmen kommen aus den
 * mitgelieferten Säulen-Stammdaten (nicht über API/UI änderbar). `PILLAR_RHYTHMS` existiert noch
 * nicht — legitimer roter Zustand für neue Funktionalität.
 */
describe('PILLAR_RHYTHMS (#1638, docs/spec/issue-1638.md, AK8)', () => {
	it('liefert die fünf Soll-Rhythmen in Seed-Reihenfolge (Körper 5, Mentale Gesundheit 3, Beziehungen 3, Wirksamkeit 5, Sinn 1)', () => {
		assert.deepEqual(
			PILLAR_RHYTHMS.map((eintrag) => ({ name: eintrag.name, rhythmusProWoche: eintrag.rhythmusProWoche })),
			[
				{ name: 'Körper', rhythmusProWoche: 5 },
				{ name: 'Mentale Gesundheit', rhythmusProWoche: 3 },
				{ name: 'Beziehungen', rhythmusProWoche: 3 },
				{ name: 'Wirksamkeit', rhythmusProWoche: 5 },
				{ name: 'Sinn', rhythmusProWoche: 1 },
			],
		);
	});
});
