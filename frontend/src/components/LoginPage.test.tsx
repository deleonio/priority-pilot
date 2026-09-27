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
		expect(screen.getByRole('button', { name: 'Mit Google anmelden' })).toBeTruthy();
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

describe('LoginPage — Hierarchie, Card-Kopf und Website-Link (#1753)', () => {
	beforeEach(() => {
		providers.mockResolvedValue({ google: true, magicLink: false });
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('#1753/AK1: Titel und Subline liegen als Card-Kopf innerhalb der Card', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const card = document.querySelector('.login-page__card');
		expect(card, 'Card (.login-page__card) muss vorhanden sein').toBeTruthy();
		const title = card?.querySelector('h1.login-page__title') ?? null;
		expect(title, 'h1.login-page__title muss IN der Card liegen').toBeTruthy();
		expect(title?.textContent).toBe('Anmelden');
		// Card-Kopf vor Alert/Buttons: Titel ist erstes Kind, die Subline folgt direkt.
		expect(card?.firstElementChild?.classList.contains('login-page__title')).toBe(true);
		expect(title?.nextElementSibling?.classList.contains('login-page__sub')).toBe(true);
	});

	it('#1753/AK2: Web rendert „Zurück zur Website“ (href /), der native Kanal nicht', async () => {
		const { unmount } = render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const link = screen.getByRole('link', { name: 'Zurück zur Website' });
		expect(link.getAttribute('href')).toBe('/');

		unmount();
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		render(<LoginPage />);
		expect(screen.queryByRole('link', { name: 'Zurück zur Website' })).toBeNull();
	});

	it('#1753/AK3: Google-Button trägt das deutsche Label samt Brand-SVG', async () => {
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		const btn = screen.getByRole('button', { name: 'Mit Google anmelden' });
		expect(btn.querySelector('svg[aria-hidden="true"]')?.getAttribute('width')).toBe('18');
	});

	it('#1753/AK4: Magic-Link-Formular über Klasse gestylt, ohne Inline-style', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		render(<LoginPage />);

		await screen.findByLabelText('Anmeldelink per E-Mail');
		const form = document.querySelector('form');
		expect(form?.classList.contains('login-page__form'), 'Formular trägt .login-page__form').toBe(true);
		expect(form?.hasAttribute('style'), 'kein Inline-style-Attribut mehr').toBe(false);
	});
});
