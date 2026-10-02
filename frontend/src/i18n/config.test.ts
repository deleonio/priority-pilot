import { describe, expect, it } from 'vitest';

import i18next, { SUPPORTED_LANGUAGES } from './config';

/**
 * Sprach-Allowlist (#1966): nur vollständig übersetzte Sprachen (de, en) kommen ins Bundle und in
 * die Auswahl. Die übrigen Locale-Dateien bleiben für den Schlüssel-Gleichstand-Test in
 * `locales.test.ts` bestehen — sie dürfen nur nicht mehr in die App gelangen.
 *
 * AK4 sichert den stillen Ausfall ab: ein alter/localStorage-Sprachcode außerhalb der Allowlist
 * muss wortlos auf `de` fallen, sonst zeigt die Oberfläche fehlende Übersetzungen.
 */
describe('Sprach-Allowlist', () => {
	it('AK1: listet genau Deutsch und Englisch', () => {
		expect(SUPPORTED_LANGUAGES).toEqual(['de', 'en']);
	});

	it('AK2: enthält nur Ressourcen der Allowlist-Sprachen', () => {
		const resources = i18next.options.resources ?? {};
		expect(Object.keys(resources).sort()).toEqual(['de', 'en']);
	});

	it('AK4: fällt bei Sprachcode außerhalb der Allowlist auf Deutsch zurück', async () => {
		await i18next.changeLanguage('fr');
		expect(i18next.language).toBe('de');
	});
});
