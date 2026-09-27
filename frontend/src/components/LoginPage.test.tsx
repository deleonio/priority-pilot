import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Login-Seite mit Magic Link per E-Mail: Das Formular erscheint nur, wenn die Instanz den
 * Anmeldeweg anbietet (`GET /auth/providers`), und meldet Erfolg bzw. Fehler beim Anfordern.
 */

vi.mock('../lib/nativeAuth', () => ({ startNativeGoogleLogin: vi.fn(() => Promise.resolve()) }));

vi.mock('../api', () => ({
	api: {
		getAuthProviders: vi.fn(),
		requestMagicLink: vi.fn(),
	},
}));

import { api } from '../api';
import { startNativeGoogleLogin } from '../lib/nativeAuth';
import { LoginPage } from './LoginPage';

const providers = vi.mocked(api.getAuthProviders);
const requestMagicLink = vi.mocked(api.requestMagicLink);

describe('LoginPage — Magic Link per E-Mail', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/app/');
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('zeigt ohne konfigurierten Magic Link nur den Google-Button', async () => {
		providers.mockResolvedValue({ google: true, magicLink: false });
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		expect(screen.getByRole('button', { name: /Mit Google anmelden/i })).toBeTruthy();
		expect(screen.queryByLabelText('Anmeldelink per E-Mail')).toBeNull();
	});

	it('fordert den Link an und bestätigt den Versand', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		requestMagicLink.mockResolvedValue(undefined);
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Anmeldelink per E-Mail'), {
			target: { value: 'ich@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Anmeldelink senden' }));

		expect((await screen.findByRole('status')).textContent).toMatch(/Anmeldelink unterwegs/);
		expect(requestMagicLink).toHaveBeenCalledWith('ich@example.com');
	});

	it('meldet einen gescheiterten Versand', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		requestMagicLink.mockRejectedValue(new Error('429'));
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Anmeldelink per E-Mail'), {
			target: { value: 'ich@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Anmeldelink senden' }));

		expect((await screen.findByRole('alert')).textContent).toMatch(/nicht angefordert werden/);
	});

	it('zeigt die Meldung für einen abgelaufenen Link aus ?error=magic_link_invalid', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		window.history.replaceState(null, '', '/app/?error=magic_link_invalid');
		render(<LoginPage />);
		expect(screen.getByRole('alert').textContent).toMatch(/abgelaufen oder wurde schon benutzt/);
		await waitFor(() => expect(providers).toHaveBeenCalled());
	});
});

describe('LoginPage — Wortmarke statt Icon+Text (#1741, AK3)', () => {
	beforeEach(() => {
		providers.mockResolvedValue({ google: true, magicLink: false });
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('rendert die Wortmarke und weder Icon noch brand-name-Span', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const brand = document.querySelector('.login-page__brand');
		expect(brand, 'Brand-Block (.login-page__brand) muss vorhanden sein').toBeTruthy();

		const wordmark = brand?.querySelector('img') ?? null;
		expect(wordmark, 'Brand-Block muss ein img (Wortmarke) enthalten').toBeTruthy();
		expect(wordmark?.getAttribute('src'), 'img src muss ein logo-with-name-Asset referenzieren').toMatch(
			/logo\/logo-with-name/,
		);

		expect(brand?.querySelector('.login-page__brand-name'), 'brand-name-Span faellt weg (AK3)').toBeNull();
		expect(
			document.querySelector('img[src*="icon-192"]'),
			'keine icon-192-Referenz mehr auf der Login-Seite',
		).toBeNull();
	});
});

describe('LoginPage — Card-Kopf, Rücklink, deutsche Texte (#1767)', () => {
	beforeEach(() => {
		providers.mockResolvedValue({ google: true, magicLink: false });
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('AK1: Titel und Subline liegen innerhalb der Card', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const card = document.querySelector('.login-page__card');
		expect(card, 'Card (.login-page__card) muss vorhanden sein').toBeTruthy();
		expect(
			card?.querySelector('.login-page__title'),
			'.login-page__title muss innerhalb der Card liegen (AK1)',
		).toBeTruthy();
		expect(
			card?.querySelector('.login-page__sub'),
			'.login-page__sub muss innerhalb der Card liegen (AK1)',
		).toBeTruthy();
	});

	it('AK2: Web-Kanal rendert den Rücklink zur Website, Native-Kanal nicht', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const back = screen.queryByRole('link', { name: /Website/i });
		expect(back, 'Web: Link mit Label „Website" erforderlich (AK2)').toBeTruthy();
		expect(back?.getAttribute('href'), 'Rücklink zeigt auf / (AK2)').toBe('/');

		cleanup();
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		expect(
			screen.queryByRole('link', { name: /Website/i }),
			'Native: Rücklink darf nicht gerendert werden (AK2)',
		).toBeNull();
	});

	it('AK3: Google-Button heißt „Mit Google anmelden"', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		expect(screen.getByRole('button', { name: /Mit Google anmelden/i })).toBeTruthy();
	});

	it('AK4: Magic-Link-Formular nutzt eine CSS-Klasse statt Inline-Style', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		render(<LoginPage />);
		await screen.findByLabelText('Anmeldelink per E-Mail');

		const form = document.querySelector('form');
		expect(form?.classList.contains('login-page__magic'), 'Form braucht .login-page__magic (AK4)').toBe(true);
		expect(form?.getAttribute('style'), 'kein Inline-Style am Formular (AK4)').toBeNull();
	});
});

describe('LoginPage — CSS-Vertrag Card-Kopf (#1767, Datei-Lese-Guard)', () => {
	it('AK1: .login-page__title nutzt --pp-font-size-lg; .login-page__sub ohne negative Margin', () => {
		const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

		const titleBlock = css.match(/\.login-page__title\s*\{[^}]*\}/)?.[0] ?? '';
		expect(titleBlock, 'Regel .login-page__title muss existieren').toContain('--pp-font-size-lg');
		expect(titleBlock, 'Titel darf nicht mehr 2xl nutzen (AK1)').not.toContain('--pp-font-size-2xl');

		const subBlock = css.match(/\.login-page__sub\s*\{[^}]*\}/)?.[0] ?? '';
		expect(subBlock, 'Regel .login-page__sub muss existieren').not.toContain('calc(-1');
	});
});

describe('LoginPage — Google-Login je Kanal (#1678)', () => {
	beforeEach(() => {
		providers.mockResolvedValue({ google: true, magicLink: false });
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('play: startet den Login im System-Browser', () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		render(<LoginPage />);

		fireEvent.click(screen.getByRole('button', { name: /Google/ }));

		expect(startNativeGoogleLogin).toHaveBeenCalledTimes(1);
	});

	it('web: bleibt bei der Weiterleitung, kein System-Browser', () => {
		render(<LoginPage />);

		fireEvent.click(screen.getByRole('button', { name: /Google/ }));

		expect(startNativeGoogleLogin).not.toHaveBeenCalled();
	});
});
