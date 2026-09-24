import { ResponseError } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.mock-Hoisting: Die Factory wird vor allen Imports ausgefuehrt, daher muessen
// die Mock-Objekte ueber vi.hoisted() vorab deklariert werden.
const { mockGET, mockUse } = vi.hoisted(() => ({
	mockGET: vi.fn(),
	// CSRF-Middleware-Registrierung (api.ts ruft client.use() beim Import) — ohne Implementierung.
	mockUse: vi.fn(),
}));

vi.mock('openapi-fetch', () => ({
	default: vi.fn(() => ({
		GET: mockGET,
		use: mockUse,
	})),
}));

import { api } from './api';

// --- CSRF-Middleware (F2 aus Review Runde 1) ---------------------------------------------
// Die Middleware wird beim Import von api.ts ueber client.use() registriert; ihre Handler
// werden hier direkt aus dem Mock-Aufruf gelesen und getrieben. Der Token-Cache ist
// Modul-Zustand — die Tests bauen deshalb als deterministische Sequenz aufeinander auf:
// 1) Token-Fetch + Header-Setzung, 2) 403-Verwurf, 3) Logout-Invalidierung.
describe('CSRF-Middleware (client.use)', () => {
	const middleware = () =>
		mockUse.mock.calls[0][0] as {
			onRequest: (c: { request: { method: string; headers: Headers } }) => Promise<void>;
			onResponse: (c: { response: { status: number } }) => void;
		};
	const postRequest = () => ({ method: 'POST', headers: new Headers() });
	// `onResponse` liest seit #1458 den Body (`response.clone().json()`) und ist damit asynchron.
	// Dieser Helfer baut eine Response-Attrappe mit `clone()` und wartet den Handler ab; ohne `body`
	// schlaegt `clone()` bewusst fehl (wie bei einer Antwort ohne JSON) und der Token wird verworfen.
	const asyncOnResponse = async ({ status, body }: { status: number; body?: unknown }) => {
		const response = body === undefined ? { status } : { status, clone: () => ({ json: async () => body }) };
		await (middleware().onResponse as (c: { response: unknown }) => Promise<void> | void)({ response });
	};
	const csrfFetch = (token: string) =>
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ csrfToken: token }) });

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('onRequest setzt X-Client-Channel mit dem erkannten Kanal', async () => {
		const request = { method: 'GET', headers: new Headers() };
		await middleware().onRequest({ request });
		expect(request.headers.get('X-Client-Channel')).toBe('web');

		vi.stubGlobal('Capacitor', { getPlatform: () => 'android' });
		await middleware().onRequest({ request });
		expect(request.headers.get('X-Client-Channel')).toBe('play');
	});

	it('onRequest setzt x-csrf-token bei schreibenden Requests und cachet den Token', async () => {
		const fetchMock = csrfFetch('csrf-1');
		vi.stubGlobal('fetch', fetchMock);

		const request = postRequest();
		await middleware().onRequest({ request });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/csrf');
		expect(request.headers.get('x-csrf-token')).toBe('csrf-1');

		// Lese-Requests bekommen keinen Header und loesen keinen Token-Fetch aus.
		const getRequest = { method: 'GET', headers: new Headers() };
		await middleware().onRequest({ request: getRequest });
		expect(getRequest.headers.get('x-csrf-token')).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Zweiter Write-Request nutzt den Cache: weiterhin genau ein Token-Fetch.
		await middleware().onRequest({ request: postRequest() });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('onResponse verwirft den Token bei 403 — der naechste Write holt frisch', async () => {
		const fetchMock = csrfFetch('csrf-2');
		vi.stubGlobal('fetch', fetchMock);

		middleware().onResponse({ response: { status: 403 } });

		const request = postRequest();
		await middleware().onRequest({ request });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(request.headers.get('x-csrf-token')).toBe('csrf-2');

		// Andere Statuscodes lassen den Cache unberuehrt.
		middleware().onResponse({ response: { status: 500 } });
		await middleware().onRequest({ request: postRequest() });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	// #1458 AK8: Ein 403 mit `code: plan_required` ist eine Paket-Ablehnung, kein CSRF-Problem — der
	// gecachte Token muss ihn ueberleben, sonst holt jede gesperrte Aktion unnoetig einen neuen.
	// Entscheidend ist der Body, nicht der Status.
	it('onResponse behaelt den Token bei 403 mit code plan_required', async () => {
		// Ausgangslage: Cache leeren, dann genau einen Token holen.
		await asyncOnResponse({ status: 403 });
		const fetchMock = csrfFetch('csrf-plan');
		vi.stubGlobal('fetch', fetchMock);
		await middleware().onRequest({ request: postRequest() });
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await asyncOnResponse({
			status: 403,
			body: { code: 'plan_required', feature: 'graph_write', requiredPlan: 'pro', currentPlan: 'free' },
		});

		// Token unveraendert im Cache: der naechste Write loest KEINEN zweiten Token-Fetch aus.
		const request = postRequest();
		await middleware().onRequest({ request });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(request.headers.get('x-csrf-token')).toBe('csrf-plan');

		// Gegenprobe: ein 403 OHNE den Code bleibt ein CSRF-403 und verwirft den Token weiterhin.
		await asyncOnResponse({ status: 403, body: { message: 'invalid csrf token' } });
		const afterPlainRejection = postRequest();
		await middleware().onRequest({ request: afterPlainRejection });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('logout() invalidiert den Token-Cache', async () => {
		// Cache leeren (wie nach einem Session-Ablauf), damit logout selbst einen frischen Token holt:
		// 1. Aufruf = Token-Fetch, 2. Aufruf = Logout-POST, 3. Aufruf = frischer Token nach Logout.
		middleware().onResponse({ response: { status: 403 } });
		const fetchMock = csrfFetch('csrf-3');
		vi.stubGlobal('fetch', fetchMock);

		await api.logout();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenLastCalledWith(
			'/api/v1/auth/logout',
			expect.objectContaining({ method: 'POST', headers: { 'x-csrf-token': 'csrf-3' } }),
		);

		// Nach dem Logout muss der naechste Write einen frischen Token holen.
		const request = postRequest();
		await middleware().onRequest({ request });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(request.headers.get('x-csrf-token')).toBe('csrf-3');
	});
});

/**
 * Die Anzeigereihenfolge der Kategorien entsteht hier, nicht in den einzelnen Auswahlfeldern —
 * dadurch stehen Formular, Suchfilter, Filterleiste und der Einstellungs-Tab in derselben
 * Reihenfolge. Der Server liefert eine byteweise (BINARY) sortierte Liste; dieser Test spielt genau
 * so eine ein und belegt, dass sie deutsch-alphabetisch beim Aufrufer ankommt.
 */
describe('api.listCategories', () => {
	it('sortiert die Antwort des Servers deutsch-alphabetisch', async () => {
		// Reihenfolge wie aus SQLite: erst alle Großbuchstaben, dann Kleinschreibung, Umlaute zuletzt.
		mockGET.mockResolvedValueOnce({
			data: [
				{ id: 1, name: 'Bau', color: '#b42318' },
				{ id: 2, name: 'Zoo', color: '#1064d0' },
				{ id: 3, name: 'auto', color: '#1a7f37' },
				{ id: 4, name: 'Ärzte', color: '#6941c6' },
			],
			response: { ok: true },
		});

		const result = await api.listCategories();

		expect(result.map((category) => category.name)).toEqual(['Ärzte', 'auto', 'Bau', 'Zoo']);
	});

	it('wirft ResponseError bei undefined data trotz ok:true', async () => {
		mockGET.mockResolvedValueOnce({ data: undefined, response: { ok: true } });

		await expect(api.listCategories()).rejects.toThrow(ResponseError);
	});
});
