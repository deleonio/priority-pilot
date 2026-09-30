import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #1898 AK5: Hinweis „Monatsäquivalent bei Jahreszahlung" in jeder Website-Sprache, mit Betrags-Platzhalter.
describe('website i18n — pricing.yearlyPerMonth (#1898)', () => {
	const dir = new URL('./i18n/', import.meta.url);
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	for (const file of files) {
		it(`${file}: pricing.yearlyPerMonth enthält {price}`, () => {
			const text = (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { pricing: { yearlyPerMonth?: string } })
				.pricing.yearlyPerMonth;
			expect(text).toContain('{price}');
		});
	}
});
