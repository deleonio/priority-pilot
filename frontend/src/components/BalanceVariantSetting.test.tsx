import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next from '../i18n/config';
import { BalanceVariantSetting } from './BalanceVariantSetting';

/**
 * Spec-Tests #2496 AK3 (docs/spec/issue-2496.md): Die Vorschau-Beschriftung der Bildwahl nennt
 * das gewählte Bild in der eingestellten Sprache und folgt einem Sprachwechsel ohne Reload.
 * Der Code erfüllt das bereits (aria-label über `{{name}}`, Labels als Getter) — die Tests
 * wirken als Regressionsschutz. Radiogruppe, Herz-Gefäß und Shadow-DOM-Layout-Hook sind
 * gemockt (Muster der KoliBri-Spec-Tests); `fetch` (Konto-Nachzug der Bildwahl) wird gestubbt,
 * damit kein echter Request läuft.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolInputRadio: () => <div role="radiogroup" />,
}));

vi.mock('./HeartVessel', () => ({
	HeartVessel: ({ ariaLabel }: { ariaLabel: string }) => <div data-testid="preview-figure" aria-label={ariaLabel} />,
}));

vi.mock('../lib/useShadowDOMLayout', () => ({
	useShadowDOMLayout: () => {},
}));

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

const previewLabel = (): string | null =>
	document.querySelector('[data-testid="preview-figure"]')?.getAttribute('aria-label') ?? null;

describe('BalanceVariantSetting — Vorschau-Beschriftung (#2496 AK3)', () => {
	afterEach(async () => {
		cleanup();
		localStorage.removeItem('pp-balance-variant');
		await i18next.changeLanguage('de');
	});

	it('nennt das gewählte Bild auf Deutsch', () => {
		render(<BalanceVariantSetting />);
		expect(previewLabel()).toBe('Vorschau: Herz');
	});

	it('aktualisiert die Beschriftung nach Sprachwechsel ohne Reload', async () => {
		render(<BalanceVariantSetting />);
		expect(previewLabel()).toBe('Vorschau: Herz');
		await act(async () => {
			await i18next.changeLanguage('en');
		});
		expect(previewLabel()).toBe('Preview: Heart');
	});
});
