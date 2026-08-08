// Fixture: matchAll-Extraktion mit Guard ZWISCHEN Zuweisung und Loop
// → darf NICHT als empty-set markiert werden.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('parser', () => {
	it('extrahiert alle Treffer (mit Guard)', () => {
		const text = 'a b c';
		const items = [...text.matchAll(/(\w)/g)];
		assert.ok(items.length > 0, 'Extraktion lieferte leere Menge');
		for (const item of items) {
			assert.ok(item[1]);
		}
	});
});
