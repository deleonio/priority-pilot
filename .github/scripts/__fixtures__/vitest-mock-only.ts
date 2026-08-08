// Fixture: Vitest-Test, der NUR einen Mock-Aufruf prüft — kein beobachtbares
// Outcome → MUSS als tautologisch markiert werden.
import { describe, it, expect, vi } from 'vitest';

describe('service', () => {
	it('ruft fetch auf', () => {
		const fetch = vi.fn();
		fetch();
		expect(fetch).toHaveBeenCalled();
	});
});
