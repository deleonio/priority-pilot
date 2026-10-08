import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next, { SUPPORTED_LANGUAGES } from '../i18n/config';
import { LanguageSetting } from './LanguageSetting';

/**
 * Vertrag der Sprachauswahl (#1339, Settings-Tab „Allgemein"): alle freigegebenen Sprachen stehen
 * zur Wahl (#1966-Allowlist), ein Wechsel stellt die Oberfläche um und überlebt den Reload, und ein
 * Browser mit Regionalcode (`en-US`) landet auf der Basissprache statt auf dem Fallback.
 */

// KoliBri-Komponenten sind nicht jsdom-kompatibel (Custom Elements, Shadow DOM) — natives
// Ersatzelement nach dem Muster von LlmSettings.test.tsx.
vi.mock('@public-ui/react-v19', () => ({
	KolSingleSelect: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void };
	}) => (
		<select
			id="language-select"
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		>
			{(_options ?? []).map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
}));

/**
 * `vitest.setup.ts` legt die Testsprache global auf `de` fest. Ohne diese Rückstellung würde ein
 * hier gewechselter Zustand in die Textassertions anderer Suites hineinlaufen.
 */
afterEach(async () => {
	localStorage.removeItem('i18nextLng');
	await i18next.changeLanguage('de');
});

const select = (): HTMLSelectElement => screen.getByRole('combobox') as HTMLSelectElement;

describe('LanguageSetting', () => {
	it('stellt die freigegebenen Sprachen zur Wahl, beschriftet mit dem jeweiligen Endonym', () => {
		render(<LanguageSetting />);

		const values = Array.from(select().options).map((option) => option.value);
		expect(values).toEqual(SUPPORTED_LANGUAGES);

		// Endonyme: die eigene Sprache bleibt auffindbar, auch wenn man die aktuelle nicht versteht.
		// #1966: nur die Allowlist-Sprachen werden angeboten — die Dateien der übrigen bleiben zwar
		// für den Schlüssel-Gleichstand-Test bestehen, erscheinen aber nicht in der Auswahl.
		const labels = Array.from(select().options).map((option) => option.textContent);
		expect(labels).toEqual(['Deutsch', 'English']);
	});

	it('stellt bei der Auswahl die Sprache um, schreibt sie in den localStorage und lädt neu', async () => {
		// window.location.reload ist in jsdom nicht spybar (#1095-Präzedenz) — Stub per stubGlobal.
		const reload = vi.fn();
		vi.stubGlobal('location', { reload });
		render(<LanguageSetting />);
		expect(select().value).toBe('de');

		fireEvent.change(select(), { target: { value: 'en' } });

		// `changeLanguage` läuft asynchron — auf den umgestellten Zustand warten.
		await screen.findByRole('combobox');
		await vi.waitFor(() => {
			expect(i18next.resolvedLanguage).toBe('en');
		});
		// Persistenz kommt vom LanguageDetector (`caches: ['localStorage']`), nicht aus der Komponente.
		expect(localStorage.getItem('i18nextLng')).toBe('en');
		await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
		vi.unstubAllGlobals();
	});

	it('bildet einen Regionalcode auf die Basissprache ab statt auf den Fallback', async () => {
		// Ein Browser meldet `en-US`; ohne diese Auflösung stünde die App auf `de` (fallbackLng)
		// oder auf einem `en-US`, für das es keine Übersetzungen gibt.
		await i18next.changeLanguage('en-US');

		expect(i18next.resolvedLanguage).toBe('en');
		expect(i18next.resolvedLanguage).not.toBe('de');
	});
});
