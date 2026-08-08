// Fixture B (Querdatei-Regression): gleicher generischer Name wie cross-a.ts,
// aber anderer Endpoint. Innerhalb EINER Datei wäre das Redundanz; quer über
// Dateien darf es nicht flaggen.
import { describe, it, expect } from 'vitest';

describe('endpointB', () => {
	it('200 mit leerer Liste', () => {
		expect(listB()).toEqual([]);
	});
});
