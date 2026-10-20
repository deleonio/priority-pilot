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

describe('Impress Widerrufs-Link und Drei-Link-Liste (#2776, docs/spec/issue-2776.md)', () => {
	it('TF1 (AK1): genau drei Links, Widerrufs-Link mit Pfad, Label und hreflang (de)', () => {
		render(<Impress />);
		expect(document.querySelectorAll('ul.help-legal-links li')).toHaveLength(3);
		const link = screen.getByRole('link', { name: 'Widerrufsbelehrung' });
		expect(link.getAttribute('href')).toMatch(/\/widerruf\/$/);
		expect(link.getAttribute('hreflang')).toBe('de');
	});

	it('TF1 (AK1): Widerrufs-Link englisch (/en/withdrawal/, „Right of withdrawal“)', async () => {
		await i18next.changeLanguage('en');
		render(<Impress />);
		const link = screen.getByRole('link', { name: 'Right of withdrawal' });
		expect(link.getAttribute('href')).toMatch(/\/en\/withdrawal\/$/);
		expect(link.getAttribute('hreflang')).toBe('en');
	});

	it('TF2 (AK2): Hinweistext passt zur Drei-Link-Liste (de + en)', async () => {
		const de = render(<Impress />);
		const deHint = de.container.querySelector('#legal-links-hint')?.textContent ?? '';
		expect(deHint).not.toContain('Beide');
		de.unmount();
		await i18next.changeLanguage('en');
		const en = render(<Impress />);
		expect(en.container.querySelector('#legal-links-hint')?.textContent ?? '').not.toContain('Both');
	});
});
