import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('LoginPage — Card-Kopf, Website-Link und deutscher Button (#1752)', () => {
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

		expect(
			document.querySelector('.login-page__card .login-page__title'),
			'Titel muss innerhalb .login-page__card liegen',
		).toBeTruthy();
		expect(
			document.querySelector('.login-page__card .login-page__sub'),
			'Subline muss innerhalb .login-page__card liegen',
		).toBeTruthy();
	});

	it('AK2: Web-Kanal rendert den Website-Link auf "/"', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const link = screen.getByRole('link', { name: /Website/ });
		expect(link.getAttribute('href')).toBe('/');
	});

	it('AK2: Native-Kanal rendert den Website-Link nicht', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		expect(screen.queryByRole('link', { name: /Website/ })).toBeNull();
	});

	it('AK3: Google-Button heißt "Mit Google anmelden"', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		expect(screen.getByRole('button', { name: /Mit Google anmelden/i })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Login with Google/i }), 'kein englischer Button-Text mehr').toBeNull();
	});
});

describe('LoginPage — Magic-Link-Formular ohne Inline-Style (#1752, AK5)', () => {
	beforeEach(() => {
		providers.mockResolvedValue({ google: true, magicLink: true });
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('AK5: Formular nutzt eine CSS-Klasse statt des Inline-Style', async () => {
		render(<LoginPage />);
		const form = (await screen.findByLabelText('Anmeldelink per E-Mail')).closest('form');

		expect(form).toBeTruthy();
		expect(form?.className, 'Formular trägt die Klasse login-page__form').toContain('login-page__form');
		expect(form?.getAttribute('style'), 'kein Inline-Style am Magic-Link-Formular').toBeNull();
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
