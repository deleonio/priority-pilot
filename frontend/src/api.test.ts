import { ResponseError } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.mock-Hoisting: Die Factory wird vor allen Imports ausgefuehrt, daher muessen
// die Mock-Objekte ueber vi.hoisted() vorab deklariert werden.
const { mockPOST, mockPATCH, mockDELETE, mockUse } = vi.hoisted(() => ({
	mockPOST: vi.fn(),
	mockPATCH: vi.fn(),
	mockDELETE: vi.fn(),
	// CSRF-Middleware-Registrierung (api.ts ruft client.use() beim Import) — ohne Implementierung.
	mockUse: vi.fn(),
}));

vi.mock('openapi-fetch', () => ({
	default: vi.fn(() => ({
		POST: mockPOST,
		PATCH: mockPATCH,
		DELETE: mockDELETE,
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
	const csrfFetch = (token: string) =>
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ csrfToken: token }) });

	afterEach(() => {
		vi.unstubAllGlobals();
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

describe('api.createPillar', () => {
	it('liefert die erstellte Säule (Pillar) zurück', async () => {
		const pillar = { id: 2, name: 'Sport', description: '', weight: 0 };
		mockPOST.mockResolvedValueOnce({ data: pillar, response: { ok: true } });

		const result = await api.createPillar({ pillarCreate: { name: 'Sport', description: '' } });

		expect(result).toEqual(pillar);
	});

	it('wirft ResponseError bei 409 (Name existiert bereits)', async () => {
		const errorResponse = { ok: false, status: 409 } as Response;
		mockPOST.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.createPillar({ pillarCreate: { name: 'Familie', description: '' } })).rejects.toThrow(
			ResponseError,
		);
	});

	it('wirft ResponseError bei 400 (Validierungsfehler)', async () => {
		const errorResponse = { ok: false, status: 400 } as Response;
		mockPOST.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.createPillar({ pillarCreate: { name: '', description: '' } })).rejects.toThrow(ResponseError);
	});

	it('wirft ResponseError bei undefined data trotz ok:true', async () => {
		mockPOST.mockResolvedValueOnce({ data: undefined, response: { ok: true } });

		await expect(api.createPillar({ pillarCreate: { name: 'Test', description: '' } })).rejects.toThrow(ResponseError);
	});
});

describe('api.updatePillar', () => {
	it('liefert die aktualisierte Säule zurück', async () => {
		const updated = { id: 1, name: 'Familie', description: 'Neu', weight: 20 };
		mockPATCH.mockResolvedValueOnce({ data: updated, response: { ok: true } });

		const result = await api.updatePillar({ id: 1, pillarUpdate: { description: 'Neu' } });

		expect(result).toEqual(updated);
	});

	it('wirft ResponseError bei 404 (Säule nicht gefunden)', async () => {
		const errorResponse = { ok: false, status: 404 } as Response;
		mockPATCH.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.updatePillar({ id: 999, pillarUpdate: { name: 'Nicht da' } })).rejects.toThrow(ResponseError);
	});

	it('wirft ResponseError bei 409 (Name-Konflikt)', async () => {
		const errorResponse = { ok: false, status: 409 } as Response;
		mockPATCH.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.updatePillar({ id: 1, pillarUpdate: { name: 'Doppelt' } })).rejects.toThrow(ResponseError);
	});
});

describe('api.deletePillar', () => {
	it('gibt nichts zurück (void) bei Erfolg', async () => {
		mockDELETE.mockResolvedValueOnce({ data: undefined, response: { ok: true, status: 204 } });

		const result = await api.deletePillar({ id: 1 });

		expect(result).toBeUndefined();
	});

	it('wirft ResponseError bei nicht-erfolgreicher Antwort', async () => {
		const errorResponse = { ok: false, status: 500 } as Response;
		mockDELETE.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.deletePillar({ id: 1 })).rejects.toThrow(ResponseError);
	});
});
