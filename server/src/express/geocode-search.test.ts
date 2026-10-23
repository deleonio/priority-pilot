/**
 * Integrationstests für die Adresssuche (Forward Geocoding) — `GET /geocode-search`.
 * #1083: Photon (https://photon.komoot.io/api) ist primär, Nominatim bleibt Fallback. Beide
 * Upstreams werden per `globalThis.fetch`-Mock nachgebildet (analog `transit.test.ts`).
 */
import { describe, it, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closeDb, resetDb, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import * as nominatimLogics from '../logics/nominatim.js';

// Auth-Env VOR dem Server-Start (#2543: Nutzer-Isolation über server.login).
applyTestAuthEnv('geocode-search-test');

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
		await resetDb();
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

	// #2543 AK4: Der Rate-Limiter zählt je (IP + Nutzer-Id), nicht je Header — ein eigener Nutzer pro
	// Test hält die Tests unabhängig voneinander (sonst würde ein schnell folgender Test vom vorigen
	// mit-limitiert). `who` benennt den Nutzer; derselbe Name = derselbe Nutzer = dasselbe Kontingent.
	const cookies = new Map<string, string>();
	const get = async (path: string, who: string, headers: Record<string, string> = {}) => {
		let cookie = cookies.get(who);
		if (!cookie) {
			cookie = await server.login(`${who}@geocode.test`);
			cookies.set(who, cookie);
		}
		return fetch(`${server.baseUrl}${path}`, { headers: { cookie, ...headers } });
	};
	// #2543 AK3: Die globale Nominatim-Drossel (1 req/s) gilt über alle Nutzer — Tests, die Nominatim
	// erreichen, warten vorher das Fenster ab, damit der Vorgänger sie nicht trifft.
	const waitWindow = () => new Promise((resolve) => setTimeout(resolve, 1100));

	/** Mockt `/reverse` (zählt Aufrufe, merkt letzte URL) zusätzlich zu den Such-Upstreams. */
	const mockReverse = (calls: UpstreamCalls): { count: () => number; url: () => string } => {
		const upstream = globalThis.fetch;
		let reverse = 0;
		let lastUrl = '';
		globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
			const url = input instanceof Request ? input.url : String(input);
			if (url.startsWith('https://nominatim.openstreetmap.org/reverse')) {
				reverse += 1;
				lastUrl = url;
				return new Response(JSON.stringify({ address: { road: 'Zählgasse' } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return upstream(input, init);
		} as typeof fetch;
		return { count: () => reverse + calls.nominatim, url: () => lastUrl };
	};

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
		await waitWindow();
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
		await waitWindow();
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
		await waitWindow();
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
		await waitWindow();
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

	// #1280 AK1 — Der leaky Eigenbau-Limiter (Map ohne Cleanup, wächst unbeschränkt) muss ganz
	// verschwinden; Rate-Limiting läuft ausschließlich über die geteilte express-rate-limit-Instanz.
	// Rot, solange der Export existiert; bewahrt vor der Rückkehr des Eigenbau-Mechanismus.
	it('AK1 — isGeocodeRateLimited ist aus logics/nominatim.ts entfernt', async () => {
		assert.equal(
			'isGeocodeRateLimited' in nominatimLogics,
			false,
			'Eigenbau-Limiter (rateLimitMap/isGeocodeRateLimited) muss entfernt sein — express-rate-limit übernimmt',
		);
	});

	// #1280 AK2 — Fensterablauf: nach >1 s ohne Request muss dieselbe Session wieder echte
	// Treffer bekommen (guardt gegen falsch konfigurierte windowMs der neuen Limiter-Instanz).
	it('AK2 — nach Ablauf des 1-s-Fensters liefert dieselbe Session wieder Treffer', async () => {
		mockUpstreams({
			photon: {
				status: 200,
				body: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							geometry: { type: 'Point', coordinates: [13.405, 52.52] },
							properties: { name: 'Treffer' },
						},
					],
				},
			},
		});

		const first = await get('/geocode-search?q=Erste', 'spec-fenster');
		assert.equal(first.status, 200);
		assert.deepEqual(await first.json(), [{ address: 'Treffer', lat: 52.52, lon: 13.405 }]);

		await new Promise((resolve) => setTimeout(resolve, 1100));

		const second = await get('/geocode-search?q=Zweite', 'spec-fenster');
		assert.equal(second.status, 200);
		assert.deepEqual(
			await second.json(),
			[{ address: 'Treffer', lat: 52.52, lon: 13.405 }],
			'nach Fensterablauf (>1s) muss der Request wieder durchgehen',
		);
	});

	// #1280 AK2 — Reverse→Reverse: auch der zweite /reverse-geocode binnen 1s wird gedrosselt
	// (200 + leere Adresse statt 429) — der Frontend-Fallback-Vertrag gilt für beide Endpunkte.
	it('AK2 — zweite /reverse-geocode-Anfrage derselben Session binnen 1s → 200 mit leerer Adresse', async () => {
		await waitWindow();
		// Nominatim würde eine echte Adresse liefern — käme die zweite Anfrage durch, wäre die
		// Antwort nicht leer. Die Drossel muss sie abfangen, BEVOR der Upstream gefragt wird.
		mockUpstreams();
		const original = globalThis.fetch;
		globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
			const url = input instanceof Request ? input.url : String(input);
			if (url.startsWith('https://nominatim.openstreetmap.org/reverse')) {
				return new Response(JSON.stringify({ address: { road: 'Fenstergasse' } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return original(input, init);
		} as typeof fetch;

		const first = await get('/reverse-geocode?lat=52.52&lon=13.405', 'spec-reverse');
		assert.equal(first.status, 200);
		assert.deepEqual(await first.json(), { address: 'Fenstergasse' }, 'erste Anfrage verbraucht das Kontingent');

		const second = await get('/reverse-geocode?lat=52.52&lon=13.405', 'spec-reverse');
		assert.equal(second.status, 200);
		assert.deepEqual(
			await second.json(),
			{ address: '' },
			'zweite Reverse-Anfrage binnen 1s muss gedrosselt werden (200 + leer statt 429)',
		);
	});

	// #2543 AK1+AK2 — Der Header x-session-token darf kein neues Kontingent verschaffen (Bypass).
	it('#2543 AK2 — wechselnder x-session-token derselben IP/Nutzers: zweite Suche gedrosselt, Upstream 1×', async () => {
		await waitWindow();
		const calls = mockUpstreams({
			photon: {
				status: 200,
				body: {
					type: 'FeatureCollection',
					features: [
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'Treffer' } },
					],
				},
			},
		});

		const first = await get('/geocode-search?q=Erste', 'bypass-search', { 'x-session-token': 'A' });
		assert.equal(first.status, 200);
		const second = await get('/geocode-search?q=Zweite', 'bypass-search', { 'x-session-token': 'B' });
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), [], 'Token-Wechsel darf das Kontingent nicht erneuern');
		assert.equal(calls.photon, 1, 'gedrosselte Anfrage erreicht den Upstream nicht');
	});

	it('#2543 AK2 — wechselnder x-session-token: zweiter /reverse-geocode gedrosselt, Nominatim 1×', async () => {
		await waitWindow();
		const calls = mockUpstreams();
		const reverse = mockReverse(calls);

		const first = await get('/reverse-geocode?lat=52.52&lon=13.405', 'bypass-reverse', { 'x-session-token': 'A' });
		assert.deepEqual(await first.json(), { address: 'Zählgasse' });
		const second = await get('/reverse-geocode?lat=52.52&lon=13.405', 'bypass-reverse', { 'x-session-token': 'B' });
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), { address: '' });
		assert.equal(reverse.count(), 1, 'Nominatim wird nur einmal gefragt');
	});

	// #2543 AK3 — globale Nominatim-Drossel: verschiedene Nutzer teilen sich 1 req/s.
	it('#2543 AK3 — zwei Nutzer, Reverse binnen 1s: nur ein Nominatim-Aufruf, zweite Antwort Fallback', async () => {
		await waitWindow();
		const calls = mockUpstreams();
		const reverse = mockReverse(calls);

		const first = await get('/reverse-geocode?lat=52.52&lon=13.405', 'global-a');
		assert.deepEqual(await first.json(), { address: 'Zählgasse' });
		const second = await get('/reverse-geocode?lat=52.52&lon=13.405', 'global-b');
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), { address: '' }, 'anderer Nutzer, aber gleiches Nominatim-Kontingent');
		assert.equal(reverse.count(), 1);
	});

	it('#2543 AK3 — Nominatim-Fallback der Suche teilt die globale Drossel mit Reverse-Geocoding', async () => {
		await waitWindow();
		const calls = mockUpstreams({
			photon: { status: 429, body: {} },
			nominatim: { status: 200, body: [{ display_name: 'Fallback 1, Berlin', lat: '52.5', lon: '13.4' }] },
		});
		const reverse = mockReverse(calls);

		await get('/reverse-geocode?lat=52.52&lon=13.405', 'global-c');
		const search = await get('/geocode-search?q=Fallback', 'global-d');
		assert.equal(search.status, 200);
		assert.deepEqual(await search.json(), [], 'Fallback-Antwort statt Nominatim-Treffer');
		assert.equal(calls.nominatim, 0, 'Suche erreicht Nominatim nicht, das Kontingent ist verbraucht');
		assert.equal(reverse.count(), 1);
	});

	it('#2543 AK3 — Photon-Anfragen fallen nicht unter die globale Drossel', async () => {
		await waitWindow();
		const calls = mockUpstreams({
			photon: {
				status: 200,
				body: {
					type: 'FeatureCollection',
					features: [
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [2, 1] }, properties: { name: 'Photon' } },
					],
				},
			},
		});
		const reverse = mockReverse(calls);

		await get('/reverse-geocode?lat=52.52&lon=13.405', 'global-e');
		const search = await get('/geocode-search?q=Photon', 'global-f');
		assert.deepEqual(
			await search.json(),
			[{ address: 'Photon', lat: 1, lon: 2 }],
			'Photon antwortet trotz Nominatim-Verbrauch',
		);
		assert.equal(calls.photon, 1);
		assert.equal(reverse.count(), 1);
	});

	// #2608 AK1+AK2 — Ungültige oder außerhalb [-90,90]/[-180,180] liegende Koordinaten antworten
	// 400, BEVOR Nominatim gefragt wird (kein Kontingent-Verbrauch für Müll-Anfragen).
	// Rot, solange lat=91/lon=181 (parseFloat ohne Bereichsprüfung) noch bis zum Upstream durchgehen.
	it('#2608 AK1+AK2 — ungueltige/ausserhalb des Bereichs liegende lat/lon → 400, Nominatim 0x', async () => {
		const calls = mockUpstreams();
		const reverse = mockReverse(calls);

		const cases: [string, string][] = [
			['lat=abc&lon=13.405', 'nan-lat'],
			['lat=52.52&lon=abc', 'nan-lon'],
			['lat=&lon=13.405', 'leer-lat'],
			['lat=91&lon=13.405', 'bereich-lat'],
			['lat=52.52&lon=181', 'bereich-lon'],
		];
		for (const [query, who] of cases) {
			const res = await get(`/reverse-geocode?${query}`, `spec2608-${who}`);
			assert.equal(res.status, 400, `${query} muss 400 liefern`);
		}
		assert.equal(reverse.count(), 0, 'ungueltige Anfragen duerfen Nominatim nicht erreichen');
	});

	// #2608 AK3 — Fehlende Query-Parameter bleiben 400 mit der bestehenden Meldung (Status quo).
	it('#2608 AK3 — fehlende lat/lon → 400 mit bestehender Meldung', async () => {
		mockUpstreams();

		const ohneBeide = await get('/reverse-geocode', 'spec2608-ohne');
		assert.equal(ohneBeide.status, 400);
		assert.deepEqual(await ohneBeide.json(), { message: 'lat und lon als Query-Parameter erforderlich.' });

		const ohneLon = await get('/reverse-geocode?lat=52.52', 'spec2608-ohne-lon');
		assert.equal(ohneLon.status, 400);
		assert.deepEqual(await ohneLon.json(), { message: 'lat und lon als Query-Parameter erforderlich.' });
	});

	// #2608 AK4 — Gültige Koordinaten laufen unverändert: 200 mit Adresse, Nominatim genau 1x
	// mit denselben Koordinaten in der Upstream-URL (guardt die Umstellung auf parseCoordinate).
	it('#2608 AK4 — gueltige Koordinaten → 200 mit Adresse, Nominatim genau 1x mit denselben Koordinaten', async () => {
		await waitWindow();
		const calls = mockUpstreams();
		const reverse = mockReverse(calls);

		const res = await get('/reverse-geocode?lat=52.52&lon=13.405', 'spec2608-ok');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { address: 'Zählgasse' });
		assert.equal(reverse.count(), 1, 'genau ein Nominatim-Aufruf');
		assert.ok(reverse.url().includes('lat=52.52&lon=13.405'), 'Koordinaten unverändert in der Upstream-URL');
	});
});
