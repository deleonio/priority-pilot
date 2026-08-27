/**
 * Integrationstests für die Adresssuche (Forward Geocoding) — `GET /geocode-search`.
 * Nominatim wird per `globalThis.fetch`-Mock nachgebildet (analog `transit.test.ts`).
 */
import { describe, it, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closeDb, type TestServer } from '../test/helpers.js';

let server: TestServer;
let savedFetch: typeof fetch | null = null;

function mockNominatim(response: { status: number; body: unknown }) {
	const original = globalThis.fetch;
	savedFetch = original;
	globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
		const url = input instanceof Request ? input.url : String(input);
		if (url.startsWith('https://nominatim.openstreetmap.org/search')) {
			return new Response(JSON.stringify(response.body), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return original(input, init);
	} as typeof fetch;
}

describe('Adresssuche (GET /geocode-search)', () => {
	before(async () => {
		server = await startTestServer();
	});

	afterEach(() => {
		if (savedFetch) {
			globalThis.fetch = savedFetch;
			savedFetch = null;
		}
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	// Der Rate-Limiter zählt je (IP+Session) — ein eigener Session-Token pro Test hält die Tests
	// unabhängig voneinander (sonst würde ein schnell folgender Test vom vorigen mit-limitiert).
	const get = (path: string, sessionToken: string) =>
		fetch(`${server.baseUrl}${path}`, { headers: { 'x-session-token': sessionToken } });

	it('gibt 200 mit gemappten Vorschlägen (address/lat/lon) zurück', async () => {
		mockNominatim({
			status: 200,
			body: [
				{ display_name: 'Musterstraße 1, 12345 Musterstadt', lat: '52.52', lon: '13.405' },
				{ display_name: 'Musterstraße 2, 12345 Musterstadt', lat: '52.53', lon: '13.406' },
			],
		});

		const res = await get('/geocode-search?q=Musterstra%C3%9Fe', 'test-1');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { address: string; lat: number; lon: number }[];
		assert.equal(body.length, 2);
		assert.equal(body[0]?.address, 'Musterstraße 1, 12345 Musterstadt');
		assert.equal(body[0]?.lat, 52.52);
		assert.equal(body[0]?.lon, 13.405);
	});

	it('ohne q-Parameter → 400', async () => {
		const res = await get('/geocode-search', 'test-2');
		assert.equal(res.status, 400);
	});

	it('mit leerem q-Parameter → 400', async () => {
		const res = await get('/geocode-search?q=', 'test-3');
		assert.equal(res.status, 400);
	});

	it('Nominatim-Fehler (5xx) → 200 mit leerer Liste (Fallback)', async () => {
		mockNominatim({ status: 503, body: { error: 'Service Unavailable' } });

		const res = await get('/geocode-search?q=Irgendwas', 'test-4');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), []);
	});

	it('Rate-Limit (>1 req/sec) → zweite Anfrage derselben Session liefert leere Liste', async () => {
		mockNominatim({ status: 200, body: [{ display_name: 'Treffer', lat: '1', lon: '1' }] });

		const first = await get('/geocode-search?q=Erste', 'test-5');
		assert.equal(first.status, 200);
		assert.equal(((await first.json()) as unknown[]).length, 1);

		const second = await get('/geocode-search?q=Zweite', 'test-5');
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), [], 'zweite Anfrage innerhalb 1s wird rate-limitiert');
	});
});
