// Fixture: Zwei echte Copy-Paste-Duplikate — gleicher Name, gleiche Assertion,
// gleiche Datei → MUSS als redundant markiert werden.
import { describe, it, expect } from 'vitest';

describe('util', () => {
	it('addiert zwei Zahlen', () => {
		expect(add(1, 2)).toBe(3);
	});

	// Copy-Paste: identischer Name + identische Assertion.
	it('addiert zwei Zahlen', () => {
		expect(add(1, 2)).toBe(3);
	});
});
