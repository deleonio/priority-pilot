/**
 * Integrationstests für die Adresssuche (Forward Geocoding) — `GET /geocode-search`.
 * #1083: Photon (https://photon.komoot.io/api) ist primär, Nominatim bleibt Fallback. Beide
 * Upstreams werden per `globalThis.fetch`-Mock nachgebildet (analog `transit.test.ts`).
 */
import { describe, it, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closeDb, type TestServer } from '../test/helpers.js';

let server: TestServer;
let savedFetch: typeof fetch | null = null;

/** Antwort-Definition je Upstream; `fail` simuliert Timeout/Netzwerkfehler (fetch wirft). */
type Upstream = { status: number; body: unknown; fail?: false } | { fail: true };

/** Mitgezählte Aufrufe je Upstream — beweist, WER geantwortet hat und WER NICHT gefragt wurde. */
interface UpstreamCalls {
	photon: number;
	nominatim: number;
	photonUrl: string;
	photonHeaders: Record<string, string>;
}

const DEFAULT_PHOTON: Upstream = { status: 200, body: { type: 'FeatureCollection', features: [] } };
const DEFAULT_NOMINATIM: Upstream = { status: 200, body: [] };

function mockUpstreams(opts: { photon?: Upstream; nominatim?: Upstream } = {}): UpstreamCalls {
	const original = globalThis.fetch;
	savedFetch = original;
	const calls: UpstreamCalls = { photon: 0, nominatim: 0, photonUrl: '', photonHeaders: {} };

	const respond = (def: Upstream | undefined, fallback: Upstream) => {
		const effective = def ?? fallback;
		if (effective.fail) {
			throw new Error('upstream nicht erreichbar (Timeout/Netzwerkfehler)');
		}
		return new Response(JSON.stringify(effective.body), {
			status: effective.status,
			headers: { 'Content-Type': 'application/json' },
		});
	};

	globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
		const url = input instanceof Request ? input.url : String(input);
		const headers =
			input instanceof Request ? Object.fromEntries(input.headers) : ((init?.headers ?? {}) as Record<string, string>);
		if (url.startsWith('https://photon.komoot.io/api')) {
			calls.photon += 1;
			calls.photonUrl = url;
			calls.photonHeaders = headers;
			return respond(opts.photon, DEFAULT_PHOTON);
		}
		if (url.startsWith('https://nominatim.openstreetmap.org/search')) {
			calls.nominatim += 1;
			return respond(opts.nominatim, DEFAULT_NOMINATIM);
		}
		return original(input, init);
	} as typeof fetch;

	return calls;
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

	it('AK1 — fragt Photon primär ab und mappt GeoJSON [lon,lat] auf {address, lat, lon}', async () => {
		const calls = mockUpstreams({
			photon: {
				status: 200,
				body: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							// GeoJSON: Koordinaten sind [lon, lat] — die Reihenfolge muss getauscht werden.
							geometry: { type: 'Point', coordinates: [13.405, 52.52] },
							properties: {
								name: 'Hauptbahnhof',
								street: 'Invalidenstraße',
								housenumber: '1',
								postcode: '10557',
								city: 'Berlin',
								country: 'Deutschland',
							},
						},
						{
							type: 'Feature',
							geometry: { type: 'Point', coordinates: [13.406, 52.53] },
							properties: { name: 'Hauptbahnhof Süd', city: 'Berlin', country: 'Deutschland' },
						},
						// Feature ohne Geometrie → fällt ersatzlos weg (wie die fehlerhaften Nominatim-Einträge).
						{ type: 'Feature', properties: { name: 'Ohne Koordinate' } },
					],
				},
			},
		});

		const query = 'hauptbahnof münche';
		const res = await get(`/geocode-search?q=${encodeURIComponent(query)}`, 'test-1');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { address: string; lat: number; lon: number }[];

		assert.equal(calls.photon, 1, 'Photon ist die Primärquelle und wird zuerst gefragt');
		assert.equal(calls.nominatim, 0, 'bei Photon-Treffern wird Nominatim nicht gebraucht');
		assert.ok(calls.photonUrl.includes(`q=${encodeURIComponent(query)}`), 'Suchtext wird an Photon durchgereicht');
		assert.ok(calls.photonUrl.includes('limit=5'), 'max. 5 Vorschläge je Suche');
		assert.ok(calls.photonUrl.includes('accept-language=de'), 'deutsche Sprachvariante anfordern');

		assert.equal(body.length, 2, 'Feature ohne Geometrie fällt weg');
		assert.equal(body[0]?.lat, 52.52, 'lat aus coordinates[1]');
		assert.equal(body[0]?.lon, 13.405, 'lon aus coordinates[0] — Reihenfolge getauscht');
		assert.equal(body[1]?.lat, 52.53);
		assert.equal(body[1]?.lon, 13.406);
		assert.match(body[0]?.address ?? '', /Hauptbahnhof/);
		assert.match(body[0]?.address ?? '', /Berlin/);
	});

	it('AK2 — Photon 429 → Antwort kommt vom Nominatim-Fallback', async () => {
		const calls = mockUpstreams({
			photon: { status: 429, body: { error: 'rate limited' } },
			nominatim: {
				status: 200,
				body: [{ display_name: 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München', lat: '48.1402', lon: '11.5600' }],
			},
		});

		const res = await get('/geocode-search?q=munchen%20hauptbahnhof', 'test-2');
		assert.equal(res.status, 200);
		assert.equal(calls.photon, 1, 'Photon wird zuerst gefragt (und antwortet 429)');
		assert.equal(calls.nominatim, 1, '429 löst den Nominatim-Fallback aus');
		const body = (await res.json()) as { address: string; lat: number; lon: number }[];
		assert.equal(body.length, 1, 'Nominatim-Fallback liefert den Treffer');
		assert.equal(body[0]?.address, 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München');
		assert.equal(body[0]?.lat, 48.1402);
		assert.equal(body[0]?.lon, 11.56);
	});

	it('AK2 — Photon nicht erreichbar (Timeout/Netzwerkfehler) → Nominatim-Fallback', async () => {
		const calls = mockUpstreams({
			photon: { fail: true },
			nominatim: {
				status: 200,
				body: [{ display_name: 'Fallback-Straße 1, 10115 Berlin', lat: '52.53', lon: '13.406' }],
			},
		});

		const res = await get('/geocode-search?q=Fallbackstra%C3%9Fe', 'test-3');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { address: string; lat: number; lon: number }[];
		assert.equal(calls.photon, 1, 'Photon wird zuerst versucht');
		assert.equal(calls.nominatim, 1, 'nach dem Photon-Fehler greift der Fallback');
		assert.equal(body.length, 1);
		assert.equal(body[0]?.address, 'Fallback-Straße 1, 10115 Berlin');
	});

	it('AK3 — Photon 200 mit 0 Treffern → leere Liste, Nominatim wird NICHT gerufen', async () => {
		const calls = mockUpstreams({
			photon: { status: 200, body: { type: 'FeatureCollection', features: [] } },
			nominatim: {
				status: 200,
				body: [{ display_name: 'Nominatim-Treffer, 10115 Berlin', lat: '52.52', lon: '13.405' }],
			},
		});

		const res = await get('/geocode-search?q=xyznichtstreffer', 'test-4');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), [], '0 Photon-Treffer ist ein legitimes leeres Ergebnis');
		assert.equal(calls.photon, 1);
		assert.equal(calls.nominatim, 0, 'leeres Photon-Ergebnis löst keinen Fallback aus (schont das Kontingent)');
	});

	it('ohne q-Parameter → 400', async () => {
		mockUpstreams();
		const res = await get('/geocode-search', 'test-5');
		assert.equal(res.status, 400);
	});

	it('mit leerem q-Parameter → 400', async () => {
		mockUpstreams();
		const res = await get('/geocode-search?q=', 'test-6');
		assert.equal(res.status, 400);
	});

	it('Nominatim-Fallback schlägt fehl (5xx) → 200 mit leerer Liste', async () => {
		mockUpstreams({
			photon: { status: 200, body: { type: 'FeatureCollection', features: [] } },
			nominatim: { status: 503, body: { error: 'Service Unavailable' } },
		});

		const res = await get('/geocode-search?q=Irgendwas', 'test-7');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), []);
	});

	it('Rate-Limit (>1 req/sec) → zweite Anfrage derselben Session liefert leere Liste', async () => {
		mockUpstreams({
			photon: {
				status: 200,
				body: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							geometry: { type: 'Point', coordinates: [1, 1] },
							properties: { name: 'Treffer' },
						},
					],
				},
			},
		});

		const first = await get('/geocode-search?q=Erste', 'test-8');
		assert.equal(first.status, 200);

		const second = await get('/geocode-search?q=Zweite', 'test-8');
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), [], 'zweite Anfrage innerhalb 1s wird rate-limitiert');
	});

	it('Rate-Limit ist geteilt: Reverse-Geocode direkt nach Suche derselben Session → gedrosselt', async () => {
		// Nominatim würde für /reverse eine echte Adresse liefern — käme die Anfrage durch,
		// wäre die Antwort nicht leer. Der geteilte Zähler muss sie vorher abfangen.
		mockUpstreams();
		const original = globalThis.fetch;
		globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
			const url = input instanceof Request ? input.url : String(input);
			if (url.startsWith('https://nominatim.openstreetmap.org/reverse')) {
				return new Response(JSON.stringify({ address: { road: 'Daumenkino' } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return original(input, init);
		} as typeof fetch;

		const search = await get('/geocode-search?q=Erste', 'test-9');
		assert.equal(search.status, 200, 'erste Anfrage verbraucht das Limit-Kontingent');

		const reverse = await get('/reverse-geocode?lat=52.52&lon=13.405', 'test-9');
		assert.equal(reverse.status, 200);
		assert.deepEqual(
			await reverse.json(),
			{ address: '' },
			'Reverse-Geocode binnen 1s nach der Suche muss vom geteilten Zähler gedrosselt werden',
		);
	});
});
