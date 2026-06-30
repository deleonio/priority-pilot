import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// ROT: `./auth` (mit der Funktion `checkAuth`) existiert noch nicht — der Import schlägt fehl,
// solange der Produktivcode in der Umsetzungs-Stufe nicht angelegt ist.
import { checkAuth } from './auth';

/**
 * Rote Spec-Tests (#190) für `checkAuth`: Die Funktion fragt den Auth-Status über `GET /auth/me` ab.
 *
 * Vertrag:
 *  - HTTP 200 → das User-Objekt `{ id, name, email }` wird zurückgegeben.
 *  - HTTP 401 / jede non-ok-Antwort → `null` (= unauthentifiziert).
 *
 * `global.fetch` wird mit `vi.fn()` gemockt, damit der Test deterministisch und ohne echtes Backend
 * läuft.
 */
describe('checkAuth', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('gibt bei HTTP 200 das User-Objekt zurück', async () => {
		const user = { id: 1, name: 'Test User', email: 'test@example.com' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => user,
		}) as unknown as typeof fetch;

		await expect(checkAuth()).resolves.toEqual(user);
	});

	it('ruft den Endpunkt /auth/me auf', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 1, name: 'Test User', email: 'test@example.com' }),
		});
		global.fetch = fetchMock as unknown as typeof fetch;

		await checkAuth();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/auth/me');
	});

	it('gibt bei HTTP 401 null zurück', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ error: 'Unauthorized' }),
		}) as unknown as typeof fetch;

		await expect(checkAuth()).resolves.toBeNull();
	});

	it('gibt bei einer non-ok-Antwort (z. B. 500) null zurück', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: 'Internal Server Error' }),
		}) as unknown as typeof fetch;

		await expect(checkAuth()).resolves.toBeNull();
	});
});
