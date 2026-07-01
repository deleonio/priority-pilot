/**
 * Rote Spec-Tests für Issue #224: Öffentlicher CORS-Proxy für Transitous/MOTIS-API
 *
 * Diese Tests werden grün, sobald:
 * - server/src/express/routes/transit.ts angelegt wird (GET /api/transit/geocode + /api/transit/plan)
 * - Die Route in server/src/express/index.ts VOR requireAuth registriert wird
 */
import { describe, it, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closeDb, type TestServer } from '../test/helpers.js';

let server: TestServer;
let savedFetch: typeof fetch | null = null;

function mockTransitous(interceptors: Record<string, { status: number; body: unknown }>) {
	const original = globalThis.fetch;
	savedFetch = original;
	globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
		const url = input instanceof Request ? input.url : String(input);
		if (url.startsWith('https://api.transitous.org')) {
			for (const [pattern, { status, body }] of Object.entries(interceptors)) {
				if (url.includes(pattern)) {
					return new Response(JSON.stringify(body), {
						status,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			}
			return new Response(JSON.stringify({ error: 'Unmatched transitous request' }), { status: 500 });
		}
		return original(input, init);
	} as typeof fetch;
}

describe('Transit-Proxy (#224)', () => {
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

	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	// AK 1 — Geocode-Proxy
	describe('GET /api/transit/geocode', () => {
		it('AK1: gibt 200 mit JSON-Array zurück (name, lat, lon)', async () => {
			const stops = [{ name: 'Berlin Hbf', lat: 52.525, lon: 13.369 }];
			mockTransitous({ '/api/v1/geocode': { status: 200, body: stops } });

			const res = await get('/api/transit/geocode?text=Berlin&language=de');
			assert.equal(res.status, 200, `Erwartet 200, war ${res.status}`);
			const body = (await res.json()) as unknown[];
			assert.ok(Array.isArray(body), 'Body muss ein Array sein');
			assert.ok(body.length > 0, 'Array darf nicht leer sein');
			const first = body[0] as Record<string, unknown>;
			assert.ok('name' in first, 'Stop-Objekt braucht ein name-Feld');
			assert.ok('lat' in first, 'Stop-Objekt braucht ein lat-Feld');
			assert.ok('lon' in first, 'Stop-Objekt braucht ein lon-Feld');
		});
	});

	// AK 2 — Plan-Proxy
	describe('GET /api/transit/plan', () => {
		it('AK2: gibt 200 mit JSON zurück (itineraries-Array)', async () => {
			const plan = {
				itineraries: [{ duration: 7200, legs: [{ mode: 'RAIL', from: { name: 'Berlin' }, to: { name: 'München' } }] }],
			};
			mockTransitous({ '/api/v3/plan': { status: 200, body: plan } });

			const res = await get(
				'/api/transit/plan?fromPlace=52.5,13.4&toPlace=48.1,11.6&time=12:00:00&arriveBy=false&numItineraries=3',
			);
			assert.equal(res.status, 200, `Erwartet 200, war ${res.status}`);
			const body = (await res.json()) as { itineraries: unknown[] };
			assert.ok('itineraries' in body, 'Body muss itineraries-Feld haben');
			assert.ok(Array.isArray(body.itineraries), 'itineraries muss ein Array sein');
		});
	});

	// AK 3 — Upstream-Fehler werden durchgereicht
	describe('Upstream-Fehlerweiterleitung', () => {
		it('AK3-geocode: Transitous 503 → Proxy antwortet mit 502 oder 503', async () => {
			mockTransitous({ '/api/v1/geocode': { status: 503, body: { error: 'Service Unavailable' } } });

			const res = await get('/api/transit/geocode?text=Berlin&language=de');
			assert.ok(res.status === 502 || res.status === 503, `Erwartet 502 oder 503, war ${res.status}`);
		});

		it('AK3-plan: Transitous 503 → Proxy antwortet mit 502 oder 503', async () => {
			mockTransitous({ '/api/v3/plan': { status: 503, body: { error: 'Service Unavailable' } } });

			const res = await get(
				'/api/transit/plan?fromPlace=52.5,13.4&toPlace=48.1,11.6&time=12:00:00&arriveBy=false&numItineraries=3',
			);
			assert.ok(res.status === 502 || res.status === 503, `Erwartet 502 oder 503, war ${res.status}`);
		});
	});

	// AK 4 — Endpunkte erfordern keine Authentifizierung
	describe('Öffentliche Endpunkte (kein Auth)', () => {
		it('AK4-geocode: ohne Session-Cookie → 200, nicht 401', async () => {
			mockTransitous({ '/api/v1/geocode': { status: 200, body: [] } });

			const res = await get('/api/transit/geocode?text=Berlin&language=de');
			assert.notEqual(res.status, 401, 'Geocode-Endpunkt darf keine Authentifizierung erfordern');
			assert.equal(res.status, 200);
		});

		it('AK4-plan: ohne Session-Cookie → 200, nicht 401', async () => {
			mockTransitous({ '/api/v3/plan': { status: 200, body: { itineraries: [] } } });

			const res = await get(
				'/api/transit/plan?fromPlace=52.5,13.4&toPlace=48.1,11.6&time=12:00:00&arriveBy=false&numItineraries=3',
			);
			assert.notEqual(res.status, 401, 'Plan-Endpunkt darf keine Authentifizierung erfordern');
			assert.equal(res.status, 200);
		});
	});
});
