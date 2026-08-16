import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { resetFreeModelsCache, type FetchFreeModels } from './routes/freeModels.js';

/**
 * Tests für `GET /models/free` (#742): liefert die aktuellen kostenlosen OpenRouter-Modelle
 * (dynamisch, `openrouter/free` zuerst) — gefiltert, sortiert, gecacht und hinter Session-Pflicht.
 *
 * Der OpenRouter-Upstream wird per AppDeps injiziert (Muster: createPillarAdvisorRouter) — die
 * Route-Logik selbst läuft unverändert echt gegen den Test-Server, nur der externe Call ist
 * deterministisch gemockt. Kein globalThis.fetch-Mock nötig: Register/GET sprechen den echten
 * Express-Server an.
 */
process.env.SESSION_SECRET = 'test-secret-issue-742';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

const FREE_MODELS = [
	{ id: 'openrouter/free', name: 'OpenRouter Free' },
	{ id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' },
	{ id: 'zeta/model:free', name: 'Zeta Free' },
];

/** Registriert einen Nutzer und gibt den Session-Cookie zurück (Muster: llm-config.test.ts). */
const register = async (email: string, password: string): Promise<string> => {
	const res = await fetch(`http://localhost:${serverPort}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	assert.equal(res.status, 201, `Register ${email} muss 201 liefern`);
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
	return setCookie.split(';')[0];
};

let server: TestServer;
let serverPort: number;
let upstream: FetchFreeModels;
let upstreamCalls: number;

before(async () => {
	server = await startTestServer({ fetchFreeModels: () => upstream() });
	serverPort = Number(new URL(server.baseUrl).port);
});

beforeEach(async () => {
	await resetDb();
	resetFreeModelsCache();
	upstreamCalls = 0;
	// Default-Mock: gültige Liste (einzelne Tests überschreiben ihn für ihren Fall).
	upstream = async () => {
		upstreamCalls++;
		return FREE_MODELS.map((model) => ({ ...model }));
	};
});

after(async () => {
	if (server) await server.close();
	await closeDb();
});

const getFreeModels = (cookie: string) => fetch(`${server.baseUrl}/models/free`, { headers: { Cookie: cookie } });

describe('Free Models API (#742)', () => {
	it('liefert die injizierte Liste unverändert (Default-Mock, openrouter/free zuerst)', async () => {
		const cookie = await register('default@example.com', 'sicheres-passwort-1');

		const res = await getFreeModels(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { models: FREE_MODELS });
	});

	it('ohne Session → 401 (hinter requireAuth montiert)', async () => {
		const res = await getFreeModels('');
		assert.equal(res.status, 401);
	});

	it('Upstream wirft (Netzwerk/Non-200/Timeout) → 502 statt Fake-Liste', async () => {
		upstream = async () => {
			throw new Error('OpenRouter antwortete 429.');
		};
		const cookie = await register('upstream-error@example.com', 'sicheres-passwort-1');

		const res = await getFreeModels(cookie);
		assert.equal(res.status, 502);
		const body = (await res.json()) as { message: string };
		assert.match(body.message, /OpenRouter/);
	});

	it('cached die Liste für die TTL — zweiter Call fragt den Upstream nicht erneut', async () => {
		const cookie = await register('cache@example.com', 'sicheres-passwort-1');

		assert.equal((await getFreeModels(cookie)).status, 200);
		assert.equal((await getFreeModels(cookie)).status, 200);
		assert.equal(upstreamCalls, 1, 'Upstream darf innerhalb der TTL nur einmal gefragt werden');
	});
});

describe('toFreeModels-Filterung (Upstream-Rohdaten → Free-Liste)', () => {
	it('filtert bezahlte Modelle heraus, openrouter/free zuerst, Rest alphabetisch nach Name', async () => {
		const { fetchFreeModelsFromOpenRouter } = await import('./routes/freeModels.js');
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (async () =>
				new Response(
					JSON.stringify({
						data: [
							{ id: 'vendor/paid-model', name: 'Paid Model', pricing: { prompt: '0.001' } },
							{ id: 'zeta/model:free', name: 'Zeta Free', pricing: { prompt: '0' } },
							{ id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B', pricing: { prompt: '0' } },
							{ id: 'openrouter/free', name: 'OpenRouter Free', pricing: {} },
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				)) as typeof fetch;

			const models = await fetchFreeModelsFromOpenRouter();
			assert.deepEqual(models, [
				{ id: 'openrouter/free', name: 'OpenRouter Free' },
				{ id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B' },
				{ id: 'zeta/model:free', name: 'Zeta Free' },
			]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('ungültige Upstream-Antwort (kein data-Array) → Fehler statt leerer Hardcode-Liste', async () => {
		const { fetchFreeModelsFromOpenRouter } = await import('./routes/freeModels.js');
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (async () => new Response(JSON.stringify({ wrong: true }), { status: 200 })) as typeof fetch;
			await assert.rejects(() => fetchFreeModelsFromOpenRouter());
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
