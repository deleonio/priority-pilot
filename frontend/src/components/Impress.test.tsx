import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../i18n/locales/en/messages.json';
import { Impress } from './Impress';

/** Rechtstext-Hinweis im Hilfe-Tab „Impressum“ (#2226, docs/spec/issue-2226.md). */

const hint = (en.legal as { germanOnly?: string }).germanOnly;

afterEach(async () => {
	localStorage.removeItem('i18nextLng');
	await i18next.changeLanguage('de');
});

describe('Impress Rechtstext-Links (#2226)', () => {
	it('Englisch verlinkt die englischen Rechtsseiten ohne Hinweis, Links tragen hreflang="en"', async () => {
		await i18next.changeLanguage('en');
		expect(hint, 'Key legal.germanOnly fehlt in en/messages.json').toBeTruthy();
		render(<Impress />);
		expect(screen.queryByText(hint!)).toBeNull();
		const links = screen
			.getAllByRole('link')
			.filter((a) => /\/en\/(terms|privacy)\/$/.test(a.getAttribute('href') ?? ''));
		expect(links).toHaveLength(2);
		for (const a of links) expect(a.getAttribute('hreflang')).toBe('en');
	});

	it('AK4: Deutsch zeigt keinen Hinweis', () => {
		expect(hint, 'Key legal.germanOnly fehlt in en/messages.json').toBeTruthy();
		render(<Impress />);
		expect(screen.queryByText(hint!)).toBeNull();
	});
});
