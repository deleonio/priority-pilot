import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Root } from './Root';

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

describe('Issue #1136 — Root-Auth-Gate', () => {
	const originalFetch = global.fetch;
	const originalTimeout = AbortSignal.timeout;

	afterEach(() => {
		cleanup();
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
		expect(screen.getByRole('button', { name: /Login with Google/i })).toBeVisible();

		// … ohne jeden stillen Login-Versuch (Loop-Guard `params.has('error')` bleibt intakt):
		// der Redirect auf /auth/google/silent würde eine Navigation auslösen — geschehen ist hier nichts.
		expect(window.location.pathname).toBe('/');
		expect(window.location.search).toBe('?error=access_denied');
	});
});
