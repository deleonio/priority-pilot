import { describe, expect, it } from 'vitest';
import { CANCELLATION } from './cancellation.ts';
import { TERMS } from './terms.ts';

// Spiegel gegen cancellation.ts: ein Rename des Kündigungsseiten-Titels ohne AGB-Pflege macht den Test rot (#2776).

describe('website — AGB-Verweis auf die Kündigungsseite (#2776, docs/spec/issue-2776.md)', () => {
	it('AK3 (de): nennt „Seite „Vertrag kündigen““ statt „Seite „Kündigen““', () => {
		const text = JSON.stringify(TERMS.de);
		expect(text).toContain(`Seite „${CANCELLATION.de.title}“`);
		expect(text).not.toContain('Seite „Kündigen“');
	});

	it('AK3 (en): nennt “Cancel contract” page statt “Cancel” page', () => {
		const text = JSON.stringify(TERMS.en);
		expect(text).toContain(`“${CANCELLATION.en.title}” page`);
		expect(text).not.toContain('“Cancel” page');
	});
});
