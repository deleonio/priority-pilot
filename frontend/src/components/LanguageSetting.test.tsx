import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next, { SUPPORTED_LANGUAGES } from '../i18n/config';
import { LanguageSetting } from './LanguageSetting';

/**
 * Vertrag der Sprachauswahl (#1339, Settings-Tab „Allgemein"): alle mitgelieferten Sprachen stehen
 * zur Wahl, ein Wechsel stellt die Oberfläche um und überlebt den Reload, und ein Browser mit
 * Regionalcode (`en-US`) landet auf der Basissprache statt auf dem Fallback.
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
	it('stellt alle mitgelieferten Sprachen zur Wahl, beschriftet mit dem jeweiligen Endonym', () => {
		render(<LanguageSetting />);

		const values = Array.from(select().options).map((option) => option.value);
		expect(values).toEqual(SUPPORTED_LANGUAGES);

		// Endonyme: die eigene Sprache bleibt auffindbar, auch wenn man die aktuelle nicht versteht.
		const labels = Array.from(select().options).map((option) => option.textContent);
		expect(labels).toContain('Deutsch');
		expect(labels).toContain('Svenska');
		expect(labels).toContain('Русский');
	});

	it('stellt bei der Auswahl die Sprache um und schreibt sie in den localStorage', async () => {
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
	});

	it('bildet einen Regionalcode auf die Basissprache ab statt auf den Fallback', async () => {
		// Ein Browser meldet `en-US`; ohne diese Auflösung stünde die App auf `de` (fallbackLng)
		// oder auf einem `en-US`, für das es keine Übersetzungen gibt.
		await i18next.changeLanguage('en-US');

		expect(i18next.resolvedLanguage).toBe('en');
		expect(i18next.resolvedLanguage).not.toBe('de');
	});
});
