// Fixture: Server-Test (node:test) mit assert.match — Assertion muss als
// beobachtbares Outcome erkannt werden. (Regression: früher zählte nur expect-*.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('formatName', () => {
	it('gibt den Namen mit Präfix zurück', () => {
		assert.match(formatName('Welt'), /^Hallo Welt$/);
	});
});
