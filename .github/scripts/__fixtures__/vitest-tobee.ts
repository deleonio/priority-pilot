// Fixture: Vitest-Test mit .toBe — darf NICHT als tautologisch markiert werden.
// (Regression: früher fehlte .toBe im „Observable"-Vokabular → False Positive.)
import { describe, it, expect } from 'vitest';

describe('Säule', () => {
	it('trägt den Namen aus dem State', () => {
		const result = { name: 'Wichtig' };
		expect(result.name).toBe('Wichtig');
	});
});
