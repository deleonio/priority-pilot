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
		addToWaitlist: vi.fn(),
	},
}));

import { api } from '../api';
import { startNativeGoogleLogin } from '../lib/nativeAuth';
import { LoginPage } from './LoginPage';

// Tab-Session-Cache der Komponente zwischen den Tests leeren (Render-Reihenfolge soll nicht zählen).
afterEach(() => {
	sessionStorage.clear();
});

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

describe('LoginPage — Login-Card-Struktur (#1769)', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/app/');
		providers.mockResolvedValue({ google: true, magicLink: true });
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('AK2: Web-Kanal zeigt unterhalb der Card „Zurück zur Website“ mit href="/"', async () => {
		render(<LoginPage />);

		// Name darf präziser sein als der sichtbare Text (UX: aria-label, siehe docs/spec/issue-1769.md).
		const link = await screen.findByRole('link', { name: /Zurück zur/ });
		expect(link.getAttribute('href')).toBe('/');
	});

	it('AK2: nativer Kanal rendert den Website-Link nicht', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		expect(screen.queryByRole('link', { name: /Zurück zur/ })).toBeNull();
	});

	it('AK5: Magic-Link-Formular trägt .login-page__form statt Inline-Style', async () => {
		render(<LoginPage />);

		// <form> ohne accessible name hat keine form-Role → über das Input zum Formular navigieren.
		const input = await screen.findByLabelText('Anmeldelink per E-Mail');
		const form = input.closest('form');
		expect(form, 'Magic-Link-Formular muss vorhanden sein').toBeTruthy();
		expect(form?.classList.contains('login-page__form'), 'Formular trägt .login-page__form').toBe(true);
		expect(form?.getAttribute('style'), 'kein Inline-style-Attribut mehr').toBeNull();
	});
});

describe('LoginPage — Wartelisten-Eintrag (#1982, AK5)', () => {
	// `addToWaitlist` gibt es im API-Client noch nicht (rote Spec-Tests) — gecasteter Zugriff,
	// damit der Pre-Commit-tsc an dieser Stelle nicht stirbt (Muster #1566).
	const addToWaitlist = (api as unknown as { addToWaitlist: ReturnType<typeof vi.fn> }).addToWaitlist;

	beforeEach(() => {
		window.history.replaceState(null, '', '/app/');
		providers.mockResolvedValue({ google: true, magicLink: true });
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('trägt Unbekannte ein und zeigt Position mit Bezugsgröße und den Empfehlungs-Link', async () => {
		addToWaitlist.mockResolvedValue({ position: 3, referralCode: 'ref-abc' });
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Auf die Warteliste per E-Mail'), {
			target: { value: 'unbekannt@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: /Warteliste/ }));

		expect(addToWaitlist).toHaveBeenCalledWith('unbekannt@example.com', undefined);
		const status = await screen.findByRole('status');
		expect(status.textContent).toMatch(/Position 3/);
		expect(status.textContent).toMatch(/ref-abc/);
	});

	it('meldet einen gescheiterten Eintrag als Alert (Fuer sorge-Tonalität statt Schuldspruch)', async () => {
		addToWaitlist.mockRejectedValue(new Error('500'));
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Auf die Warteliste per E-Mail'), {
			target: { value: 'unbekannt@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: /Warteliste/ }));

		expect(await screen.findByRole('alert').then((a) => a.textContent)).toMatch(/nicht geklappt|versuch es/i);
	});
});
