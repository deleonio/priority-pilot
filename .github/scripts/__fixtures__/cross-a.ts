// Fixture A (Querdatei-Regression): generischer Test-Name, der in vielen
// Endpoint-Tests vorkommt. Zusammen mit cross-b.ts dürfen diese NICHT als
// redundant gelten — Within-File-Scoping verhindert die Querdatei-Kollision.
import { describe, it, expect } from 'vitest';

describe('endpointA', () => {
	it('200 mit leerer Liste', () => {
		expect(listA()).toEqual([]);
	});
});
