import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Root } from './Root';
import { NATIVE_LOGGED_OUT_KEY } from './lib/appToken';
import { nativeGoogleLogin } from './lib/nativeAuth';

/**
 * Spec-Tests (#1136, docs/spec/issue-1136.md) für das Auth-Gate in `Root.tsx`:
 *
 * AK1 — Bricht der /auth/me-Check ab (30-s-Timeout, siehe auth.test.ts), muss Root den
 *       Lade-Spinner verlassen und den Fehler-State (`role="alert"`) zeigen — kein Dauerspinner.
 * AK3 — Nach dem Fehler erfolgt kein zweiter Versuch: genau ein checkAuth-Aufruf, keine
 *       Weiterleitung (kein stiller Re-Login, kein Redirect-Loop).
 *
 * `@public-ui/react-v19` und `./App` sind gestubbt — der Test adressiert ausschließlich das
 * Auth-Gate, nicht die Haupt-App. Der Abort wird wie in auth.test.ts über einen
 * AbortSignal.timeout-Spy mit sofort ablaufendem echtem Timer deterministisch ausgelöst
 * (Node- interne Abort-Timer folgen keinen Fake-Timern).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolSpin: (props: { _label?: string }) => createElement('div', { 'data-testid': 'kol-spin' }, props?._label),
}));

vi.mock('./App', () => ({
	App: () => createElement('div', { 'data-testid': 'app' }),
}));

vi.mock('./lib/nativeAuth', () => ({
	nativeGoogleLogin: vi.fn(async () => 'unavailable'),
	finishNativeLogin: vi.fn(),
	startNativeGoogleLogin: vi.fn(),
}));

describe('Issue #1136 — Root-Auth-Gate', () => {
	const originalFetch = global.fetch;
	const originalTimeout = AbortSignal.timeout;

	afterEach(() => {
		cleanup();
		sessionStorage.removeItem('pp_silent_attempted');
		global.fetch = originalFetch;
		AbortSignal.timeout = originalTimeout;
		window.history.replaceState(null, '', '/');
	});

	beforeEach(() => {
		window.history.replaceState(null, '', '/');
	});

	it('AC-1136-2 (AK1): nach dem Abort zeigt Root den Fehler-Alert statt des Spinners', async () => {
		AbortSignal.timeout = (() => originalTimeout.call(AbortSignal, 0)) as typeof AbortSignal.timeout;

		// /auth/me antwortet nie — nur der Signal-Abbruch beendet den Check.
		global.fetch = vi.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('AbortError (Test)')));
			}) as unknown as Promise<Response>;
		}) as unknown as typeof fetch;

		render(<Root />);

		// Der Fehler-State (bestehendes UI, Root.tsx:96) nennt den manuellen Ausweg „neu laden".
		const alert = await screen.findByRole('alert', undefined, { timeout: 3000 });
		expect(alert).toHaveTextContent(/neu laden/i);
		// Kein Spinner mehr.
		expect(screen.queryByTestId('kol-spin')).toBeNull();
	});

	it('AC-1136-3 (AK3): nach dem Fehler bleibt es bei genau einem checkAuth-Aufruf — kein Auto-Retry, kein Redirect', async () => {
		AbortSignal.timeout = (() => originalTimeout.call(AbortSignal, 0)) as typeof AbortSignal.timeout;

		const fetchMock = vi.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('AbortError (Test)')));
			}) as unknown as Promise<Response>;
		});
		global.fetch = fetchMock as unknown as typeof fetch;

		render(<Root />);

		await screen.findByRole('alert', undefined, { timeout: 3000 });

		// Kein zweiter Versuch: der Auth-Check lief genau einmal.
		expect(fetchMock).toHaveBeenCalledTimes(1);
		// Keine Weiterleitung (kein stiller Re-Login, kein Redirect-Loop).
		expect(window.location.pathname).toBe('/');
		expect(window.location.search).toBe('');
	});

	it('AC-1231-1 (AK3): erfolgreicher Auth-Check entfernt pp_silent_attempted — nach Reload ist ein neuer stiller Versuch möglich', async () => {
		// Simuliert: In dieser Browser-Session lief bereits ein stiller Login (Flag gesetzt, wie vor
		// dem Redirect auf /auth/google/silent). Kehrt der Nutzer mit gültiger Session zurück (hier:
		// nach dem Reload aus dem Session-Dialog), muss das Flag zurückgesetzt sein — sonst würde der
		// NÄCHSTE Ablauf ohne stillen Versuch auf der LoginPage landen (Spec issue-1231.md).
		sessionStorage.setItem('pp_silent_attempted', '1');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 1, email: 'peter@example.com', displayName: 'Peter', avatarUrl: null }),
		});
		global.fetch = fetchMock as unknown as typeof fetch;

		render(<Root />);

		expect(await screen.findByTestId('app')).toBeVisible();
		expect(sessionStorage.getItem('pp_silent_attempted')).toBeNull();
	});

	it('AC-1136-4 (AK3): ?error=access_denied zeigt die LoginPage mit Alert — ohne stillen Versuch (Guard-Regression)', async () => {
		window.history.replaceState(null, '', '/?error=access_denied');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ error: 'Unauthorized' }),
		}) as unknown as typeof fetch;
		global.fetch = fetchMock;

		render(<Root />);

		// LoginPage mit der passenden Meldung aus ERROR_MESSAGES …
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(/Zugriff wurde verweigert/i);
		expect(screen.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();

		// … ohne jeden stillen Login-Versuch (Loop-Guard `params.has('error')` bleibt intakt):
		// der Redirect auf /auth/google/silent würde eine Navigation auslösen — geschehen ist hier nichts.
		expect(window.location.pathname).toBe('/');
		expect(window.location.search).toBe('?error=access_denied');
	});
	it('AC-2335-1 (AK1): /bahn rendert keinen Routenplaner mehr, sondern den regulären Einstieg (#2335)', async () => {
		// /auth/me antwortet nie — der reguläre Einstieg zeigt dann den Lade-Spinner des Auth-Gates.
		global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
		window.history.replaceState(null, '', '/bahn');

		render(<Root />);

		expect(screen.queryByRole('heading', { name: /Bahn-Routenplaner/i })).toBeNull();
		expect(await screen.findByTestId('kol-spin')).toBeTruthy();
	});
});

// ADR 0023: In der App versucht Root ohne Sitzung einmal die native Google-Anmeldung, nach dem
// Abmelden auch über einen Neustart hinweg nicht mehr.
describe('Root in der Android-App (ADR 0023)', () => {
	const originalFetch = global.fetch;
	const scope = globalThis as { __PP_CHANNEL__?: string };

	beforeEach(() => {
		scope.__PP_CHANNEL__ = 'play';
		global.fetch = vi
			.fn()
			.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as unknown as typeof fetch;
	});

	afterEach(() => {
		cleanup();
		delete scope.__PP_CHANNEL__;
		global.fetch = originalFetch;
		sessionStorage.clear();
		localStorage.clear();
		vi.clearAllMocks();
	});

	it('ohne Sitzung startet genau ein automatischer Versuch, danach die Login-Seite', async () => {
		render(<Root />);

		expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		expect(nativeGoogleLogin).toHaveBeenCalledTimes(1);
		expect(nativeGoogleLogin).toHaveBeenCalledWith(true);
	});

	it('nach dem Abmelden kein automatischer Versuch', async () => {
		localStorage.setItem(NATIVE_LOGGED_OUT_KEY, '1');

		render(<Root />);

		expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		expect(nativeGoogleLogin).not.toHaveBeenCalled();
	});
});
