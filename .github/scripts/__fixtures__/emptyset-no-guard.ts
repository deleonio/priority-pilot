// Fixture: matchAll-Extraktion speist einen for..of-Loop OHNE Längen-Guard
// → MUSS als empty-set markiert werden (Loop läuft nie bei leerer Menge).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('parser', () => {
	it('extrahiert alle Treffer', () => {
		const text = 'a b c';
		const items = [...text.matchAll(/(\w)/g)];
		for (const item of items) {
			assert.ok(item[1]);
		}
	});
});
