import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #1783 AK6: keine Anzahl KI-Anfragen mehr auf der Website (Fair-Use-Formulierung).
describe('website i18n — aiQuota ohne Anzahl (#1783)', () => {
	const dir = new URL('./i18n/', import.meta.url);
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	it('deckt alle 10 Sprachen ab', () => expect(files).toHaveLength(10));

	for (const file of files) {
		it(`${file}: pricing.aiQuota enthält weder {count} noch eine Ziffer`, () => {
			const text = (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { pricing: { aiQuota: string } }).pricing
				.aiQuota;
			expect(text).not.toMatch(/\{count\}|\d/);
		});
	}
});
