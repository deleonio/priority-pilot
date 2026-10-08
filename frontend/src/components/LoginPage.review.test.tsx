import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prüfzugang Google Play (#2426, AK6/AK7): Die Login-Seite zeigt kein Passwortfeld; 7 Taps auf die
 * Wortmarke öffnen bei `reviewAccess: true` einen Dialog mit genau einem Passwortfeld. Vertrag:
 * docs/spec/issue-2426.md.
 */

vi.mock('../lib/nativeAuth', () => ({ startNativeGoogleLogin: vi.fn(() => Promise.resolve()) }));

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), in jsdom nicht lauffähig — Passthrough
// wie in CategoryList.test.tsx.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
}));

vi.mock('../api', () => ({
	api: {
		getAuthProviders: vi.fn(),
		requestMagicLink: vi.fn(),
		addToWaitlist: vi.fn(),
		reviewLogin: vi.fn(),
	},
}));

import { api } from '../api';
import { LoginPage } from './LoginPage';

const providers = vi.mocked(api.getAuthProviders);
// `reviewLogin`/`reviewAccess` gibt es noch nicht (rote Spec-Tests) — gecasteter Zugriff, damit der
// Pre-Commit-tsc nicht stirbt (Muster #1566).
const reviewLogin = (api as unknown as { reviewLogin: ReturnType<typeof vi.fn> }).reviewLogin;
const withReviewAccess = (reviewAccess: boolean) =>
	({ google: true, magicLink: false, reviewAccess }) as Awaited<ReturnType<typeof api.getAuthProviders>>;

const tapLogo = (times: number) => {
	const logo = screen.getByAltText('Balamentum');
	for (let i = 0; i < times; i += 1) {
		fireEvent.click(logo);
	}
};

describe('LoginPage — Prüfzugang (#2426)', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/app/');
	});
	afterEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
	});

	it('AK6: ohne Geste gibt es kein Passwortfeld; 7 Taps öffnen genau ein Passwortfeld', async () => {
		providers.mockResolvedValue(withReviewAccess(true));
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		expect(screen.queryByLabelText(/Passwort/i)).toBeNull();

		tapLogo(7);

		expect(await screen.findByLabelText(/Passwort/i)).toBeTruthy();
		expect(screen.getAllByLabelText(/Passwort/i)).toHaveLength(1);
	});

	it('AK6: 6 Taps öffnen nichts', async () => {
		providers.mockResolvedValue(withReviewAccess(true));
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		tapLogo(6);

		expect(screen.queryByLabelText(/Passwort/i)).toBeNull();
	});

	it('AK6: bei reviewAccess false öffnen auch 7 Taps nichts', async () => {
		providers.mockResolvedValue(withReviewAccess(false));
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());

		tapLogo(7);

		expect(screen.queryByLabelText(/Passwort/i)).toBeNull();
	});

	it('AK7: falsches Passwort zeigt eine Fehlermeldung im Dialog', async () => {
		providers.mockResolvedValue(withReviewAccess(true));
		reviewLogin.mockRejectedValue(new Error('401'));
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		tapLogo(7);

		fireEvent.change(await screen.findByLabelText(/Passwort/i), { target: { value: 'falsch' } });
		fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

		const dialog = await screen.findByRole('dialog');
		await waitFor(() => expect(dialog.querySelector('[role="alert"]')).toBeTruthy());
		expect(reviewLogin).toHaveBeenCalledWith('falsch');
	});

	it('AK7: korrektes Passwort ruft den Prüf-Login auf', async () => {
		providers.mockResolvedValue(withReviewAccess(true));
		reviewLogin.mockResolvedValue(undefined);
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		tapLogo(7);

		fireEvent.change(await screen.findByLabelText(/Passwort/i), { target: { value: 'richtig' } });
		fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

		await waitFor(() => expect(reviewLogin).toHaveBeenCalledWith('richtig'));
	});
});
