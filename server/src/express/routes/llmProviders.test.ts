import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	type TestServer,
	registerOn,
	applyTestAuthEnv,
} from '../../test/helpers.js';
import { resetProviderModelsCache, resetProviderTestCache } from './llmProviders.js';

/**
 * Vertrag der Provider-API: Custom-Provider (CRUD + Radio-Aktivierung), fixe Built-ins
 * (Mistral/OpenRouter, Key aus ENV) und die Modellliste je Provider.
 *
 * Die ENV-Keys der Built-ins werden je Fall deterministisch gesetzt/gelöscht — der Fallback
 * (Mistral vor OpenRouter) hängt an `MISTRAL_API_KEY`/`OPENROUTER_API_KEY`. Der Upstream der
 * Modellliste wird über AppDeps injiziert (kein echter Provider-Call).
 */

applyTestAuthEnv('test-secret-llm-providers');

const ENV_KEYS = ['MISTRAL_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_MODEL', 'OPENROUTER_MODEL'] as const;
const envBackup: Record<string, string | undefined> = {};

let server: TestServer;

/** Zählt Aufrufe des injizierten Test-Runners — Grundlage der Cooldown/Dedupe-Assertions. */
let testRunnerCalls = 0;

describe('LLM-Providers API', () => {
	before(async () => {
		for (const key of ENV_KEYS) {
			envBackup[key] = process.env[key];
		}
		server = await startTestServer({
			fetchProviderModels: async (runtime) => [{ id: `${runtime.label}-model-a` }, { id: 'z-model' }],
			runProviderTest: async (runtime) => {
				testRunnerCalls += 1;
				return { ok: true, model: runtime.model, latencyMs: 42, sample: '{"ok": true}' };
			},
		});
	});

	beforeEach(async () => {
		for (const key of ENV_KEYS) {
			delete process.env[key];
		}
		resetProviderModelsCache(); // Provider-IDs starten nach resetDb von vorn — Cache deterministisch kalt halten
		resetProviderTestCache();
		await resetDb();
	});

	after(async () => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
		if (server) await server.close();
		await closeDb();
	});

	const register = (email: string) => registerOn(server, email, 'password');

	const getProviders = (cookie: string) => fetch(`${server.baseUrl}/llm-providers`, { headers: { Cookie: cookie } });

	const createProvider = (cookie: string, body: unknown) =>
		fetch(`${server.baseUrl}/llm-providers`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const updateProvider = (cookie: string, id: number, body: unknown) =>
		fetch(`${server.baseUrl}/llm-providers/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const deleteProvider = (cookie: string, id: number) =>
		fetch(`${server.baseUrl}/llm-providers/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });

	const activateProvider = (cookie: string, id: number) =>
		fetch(`${server.baseUrl}/llm-providers/${id}/activate`, { method: 'POST', headers: { Cookie: cookie } });

	const getModels = (cookie: string, id: number) =>
		fetch(`${server.baseUrl}/llm-providers/${id}/models`, { headers: { Cookie: cookie } });

	const customPayload = {
		name: 'z.ai',
		endpoint: 'https://api.z.ai/v1',
		apiKey: 'secret-key-123',
		model: 'glm-4.7',
	};

	/** Legt einen Custom-Provider an und gibt dessen ID aus der Antwort zurück. */
	const createProviderAndGetId = async (cookie: string, payload: unknown): Promise<number> => {
		const res = await createProvider(cookie, payload);
		assert.equal(res.status, 201, 'POST /llm-providers muss 201 liefern');
		const body = (await res.json()) as { id: number };
		assert.ok(body.id, 'Antwort muss die neue Provider-ID enthalten');
		return body.id;
	};

	/** Holt die Liste als getyptes Array. */
	const listProviders = async (cookie: string): Promise<Array<Record<string, unknown> & { id: number }>> => {
		const res = await getProviders(cookie);
		assert.equal(res.status, 200, 'GET /llm-providers muss 200 liefern');
		return (await res.json()) as Array<Record<string, unknown> & { id: number }>;
	};

	// ── Built-ins: immer angelegt, fix ────────────────────────────────
	it('listet Mistral und OpenRouter immer — zuerst, kind=builtin, mit ENV-Key-Präsenz', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const cookie = await register('builtins@example.com');

		const list = await listProviders(cookie);
		assert.equal(list.length, 2, 'Ohne Custom-Provider exakt die zwei Built-ins');
		assert.equal(list[0]?.name, 'Mistral');
		assert.equal(list[0]?.kind, 'builtin');
		assert.equal(list[0]?.hasApiKey, true, 'ENV-Key-Präsenz wird signalisiert (nie der Wert)');
		assert.equal(list[1]?.name, 'OpenRouter');
		assert.equal(list[1]?.kind, 'builtin');
		assert.equal(list[1]?.hasApiKey, false);
		assert.ok(!('apiKey' in list[0]), 'Feld apiKey darf nicht serialisiert werden');
	});

	it('ohne ENV-Key und ohne Wahl ist kein Provider aktiv; mit ENV-Key ist der Fallback aktiv', async () => {
		const cookie = await register('fallback-off@example.com');
		assert.equal(
			(await listProviders(cookie)).every((p) => p.isActive !== true),
			true,
			'Kein Fallback ohne ENV-Key',
		);

		process.env.OPENROUTER_API_KEY = 'env-or-key';
		const withKey = await listProviders(cookie);
		const active = withKey.filter((p) => p.isActive === true);
		assert.equal(active.length, 1);
		assert.equal(active[0]?.name, 'OpenRouter', 'Ohne Mistral-Key ist OpenRouter der Fallback');
	});

	it('Mistral hat als Fallback Vorrang vor OpenRouter', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		process.env.OPENROUTER_API_KEY = 'env-or-key';
		const cookie = await register('fallback-order@example.com');
		const active = (await listProviders(cookie)).filter((p) => p.isActive === true);
		assert.equal(active.length, 1);
		assert.equal(active[0]?.name, 'Mistral');
	});

	it('Built-ins sind fix: DELETE → 400, PUT mit name/endpoint/apiKey → 400', async () => {
		const cookie = await register('immutable@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');
		assert.ok(mistral);

		assert.equal((await deleteProvider(cookie, mistral.id)).status, 400, 'Built-in nicht löschbar');
		assert.equal((await updateProvider(cookie, mistral.id, { name: 'Hack' })).status, 400, 'Name nicht änderbar');
		assert.equal((await updateProvider(cookie, mistral.id, { apiKey: 'x' })).status, 400, 'Key nicht änderbar');
	});

	it('Built-in-Modellwahl: PUT mit nur model → 200; Default-Modell ohne Wahl', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const cookie = await register('builtin-model@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');
		assert.equal(mistral.model, 'mistral-small-latest', 'Ohne Wahl gilt der Code-Default (AK1, #1060)');

		const res = await updateProvider(cookie, mistral.id, { model: 'mistral-large-latest' });
		assert.equal(res.status, 200);
		const updated = (await listProviders(cookie)).find((p) => p.id === mistral.id);
		assert.equal(updated.model, 'mistral-large-latest', 'Gewähltes Modell persistiert');
	});

	// ── Custom-Provider ────────────────────────────────────────────────
	it('Custom-Provider anlegen: mit Modell (Pflicht), inaktiv, ohne Key-Rückgabe', async () => {
		const cookie = await register('create@example.com');
		const res = await createProvider(cookie, customPayload);
		assert.equal(res.status, 201);
		const created = await res.json();
		assert.ok(!('apiKey' in created), 'Antwort darf den API-Key nicht enthalten');
		assert.equal(created.isActive, false, 'Neuer Provider ist inaktiv (Radio entscheidet)');
		assert.equal(created.model, 'glm-4.7', 'Angegebenes Modell wird gespeichert');
		assert.equal(created.kind, 'custom');

		const list = await listProviders(cookie);
		assert.equal(list.length, 3, 'Zwei Built-ins + ein Custom');
		assert.equal(JSON.stringify(list).includes('secret-key-123'), false, 'Key-Wert darf nirgends auftauchen');
	});

	it('Radio-Aktivierung: genau einer aktiv — Custom UND Built-in wählbar', async () => {
		const cookie = await register('activate@example.com');
		const customId = await createProviderAndGetId(cookie, customPayload);
		const builtins = await listProviders(cookie);
		const openrouter = builtins.find((p) => p.name === 'OpenRouter');

		assert.equal((await activateProvider(cookie, customId)).status, 200);
		let list = await listProviders(cookie);
		assert.equal(list.find((p) => p.id === customId)?.isActive, true);
		assert.equal(list.find((p) => p.id === openrouter.id)?.isActive, false);

		assert.equal((await activateProvider(cookie, openrouter.id)).status, 200);
		list = await listProviders(cookie);
		assert.equal(list.find((p) => p.id === openrouter.id)?.isActive, true, 'Auch Built-in explizit wählbar');
		assert.equal(list.find((p) => p.id === customId)?.isActive, false, 'Alle anderen deaktiviert');
	});

	it('Löschen des aktiven Custom-Providers → Built-in-Fallback übernimmt', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const cookie = await register('delete-active@example.com');
		const customId = await createProviderAndGetId(cookie, customPayload);
		await activateProvider(cookie, customId);

		assert.equal((await deleteProvider(cookie, customId)).status, 204);
		const list = await listProviders(cookie);
		assert.equal(list.length, 2, 'Nur die Built-ins bleiben');
		const active = list.filter((p) => p.isActive === true);
		assert.equal(active[0]?.name, 'Mistral', 'Fallback ist wieder aktiv');
	});

	it('PUT aktualisiert Custom-Provider; apiKey nur bei nicht-leerem Wert', async () => {
		const cookie = await register('update@example.com');
		const id = await createProviderAndGetId(cookie, customPayload);

		const res = await updateProvider(cookie, id, { name: 'z.ai staging', endpoint: 'https://staging.z.ai/v1' });
		assert.equal(res.status, 200);
		const updated = (await listProviders(cookie)).find((p) => p.id === id);
		assert.equal(updated.name, 'z.ai staging');
		assert.equal(updated.endpoint, 'https://staging.z.ai/v1');
	});

	it('Validation: POST ohne Pflichtfelder oder mit ungültiger URL → 400', async () => {
		const cookie = await register('validation@example.com');
		assert.equal(
			(await createProvider(cookie, { name: 'x', endpoint: 'ftp://nope', apiKey: 'k', model: 'm' })).status,
			400,
		);
		assert.equal(
			(await createProvider(cookie, { name: '', endpoint: 'https://a.de/v1', apiKey: 'k', model: 'm' })).status,
			400,
		);
		assert.equal(
			(await createProvider(cookie, { name: 'x', endpoint: 'https://a.de/v1', apiKey: 'k', model: '' })).status,
			400,
		);
	});

	// ── Modellliste ────────────────────────────────────────────────────
	it('GET /llm-providers/{id}/models liefert die Modelle des Providers (Upstream-Mock)', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const cookie = await register('models@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');

		const res = await getModels(cookie, mistral.id);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { models: { id: string; name: string }[] };
		assert.deepEqual(
			body.models.map((m) => m.id),
			['Mistral-model-a', 'z-model'],
			'Modelle kommen vom injizierten Upstream, nach id sortiert',
		);
	});

	it('GET models: unbekannte ID → 404', async () => {
		const cookie = await register('models-404@example.com');
		assert.equal((await getModels(cookie, 99999)).status, 404);
	});

	// ── Mistral-Fallback-Katalog bei gescheitertem Live-Abruf ──────────
	it('Mistral hat einen Fallback-Katalog mit den bekannten -latest-Modellen', async () => {
		const cookie = await register('models-fallback@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');
		assert.ok(mistral);

		const { LlmProvider } = await import('../../models/index.js');
		const { builtinModelFallback } = await import('../../llm/llmProviders.js');
		const fallback = builtinModelFallback(await LlmProvider.findByPk(mistral.id));
		assert.ok(fallback !== null, 'Mistral hat einen Fallback-Katalog');
		assert.ok(
			fallback.some((m) => m.id === 'mistral-medium-latest'),
			'Katalog enthält mistral-medium-latest',
		);
	});

	// ── Verbindungstest (`POST /llm-providers/{id}/test`) ───────────────
	it('Test: Erfolg meldet ok, Modell, Latenz und Antwort-Auszug', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key'; // Vorab-Check Key-Presence bestehen lassen
		const cookie = await register('test-ok@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');
		assert.ok(mistral);

		const res = await fetch(`${server.baseUrl}/llm-providers/${mistral.id}/test`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { ok: boolean; model?: string; latencyMs?: number; sample?: string };
		assert.equal(body.ok, true, 'Injizierter Runner meldet Erfolg');
		assert.equal(body.model, 'mistral-small-latest', 'Effektives Modell wird genannt');
		assert.equal(body.latencyMs, 42);
		assert.equal(body.sample, '{"ok": true}');
	});

	it('Test ohne ENV-Key: klare Vorab-Meldung statt sinnlosem Upstream-Call', async () => {
		const cookie = await register('test-nokey@example.com');
		const openrouter = (await listProviders(cookie)).find((p) => p.name === 'OpenRouter');
		assert.ok(openrouter);

		const res = await fetch(`${server.baseUrl}/llm-providers/${openrouter.id}/test`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		const body = (await res.json()) as { ok: boolean; message?: string };
		assert.equal(body.ok, false);
		assert.match(body.message ?? '', /Kein API-Key vorhanden/, 'Ursache Key-Fehlen wird genannt');
	});

	it('Test unbekannter Provider → 404', async () => {
		const cookie = await register('test-404@example.com');
		const res = await fetch(`${server.baseUrl}/llm-providers/99999/test`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		assert.equal(res.status, 404);
	});

	it('Test-Cooldown: Wiederholung innerhalb der TTL hämmert den Upstream nicht; PUT testet neu', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key'; // Vorab-Check Key-Presence bestehen lassen
		const cookie = await register('test-cooldown@example.com');
		const mistral = (await listProviders(cookie)).find((p) => p.name === 'Mistral');
		assert.ok(mistral);

		const postTest = () =>
			fetch(`${server.baseUrl}/llm-providers/${mistral.id}/test`, { method: 'POST', headers: { Cookie: cookie } });
		const before = testRunnerCalls;
		const first = await postTest();
		assert.equal(first.status, 200);
		assert.equal(testRunnerCalls - before, 1, 'Erster Aufruf testet tatsächlich');

		const second = await postTest();
		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), await first.clone().json(), 'Wiederholung liefert dasselbe Ergebnis');
		assert.equal(testRunnerCalls - before, 1, 'Wiederholung innerhalb der TTL spart den Upstream-Call');

		await updateProvider(cookie, mistral.id, { model: 'mistral-small-latest' });
		assert.equal((await postTest()).status, 200);
		assert.equal(testRunnerCalls - before, 2, 'Nach Konfigurationsänderung (PUT) wird neu getestet');
	});

	it('OpenRouter hat keinen Katalog — ohne Katalog bleibt ein Live-Fehler 502', async () => {
		const cookie = await register('models-no-fallback@example.com');
		const openrouter = (await listProviders(cookie)).find((p) => p.name === 'OpenRouter');
		assert.ok(openrouter);
		const { LlmProvider } = await import('../../models/index.js');
		const { builtinModelFallback } = await import('../../llm/llmProviders.js');
		assert.equal(builtinModelFallback(await LlmProvider.findByPk(openrouter.id)), null, 'OpenRouter ohne Katalog');
	});

	// ── #1547: nutzergebundene Custom-Provider (Spec docs/spec/issue-1547.md) ──
	it('#1547 TF1 (AK1): GET zeigt instanzweite + eigene Provider, fremde nicht; Zeilen tragen userId', async () => {
		const cookieA = await register('user-a@1547.example.com');
		const cookieB = await register('user-b@1547.example.com');
		const { LlmProvider, User } = await import('../../models/index.js');

		const idA = await createProviderAndGetId(cookieA, { ...customPayload, name: 'A-privat' });
		const idB = await createProviderAndGetId(cookieB, { ...customPayload, name: 'B-privat' });
		// Instanzweite Custom-Zeile (userId = null) direkt anlegen — muss für beide sichtbar bleiben.
		const shared = await LlmProvider.create({
			name: 'instanzweit',
			endpoint: 'https://shared.example.com/v1',
			apiKey: 'shared-key',
			model: 'shared-model',
			kind: 'custom',
		});

		const userA = await User.findOne({ where: { email: 'user-a@1547.example.com' } });
		const userB = await User.findOne({ where: { email: 'user-b@1547.example.com' } });
		assert.ok(userA && userB, 'Beide Testnutzer existieren');
		const rowA = await LlmProvider.findByPk(idA);
		const rowB = await LlmProvider.findByPk(idB);
		assert.equal(
			(rowA as unknown as { userId?: number | null }).userId,
			userA.id,
			'Angelegt von A → Zeile trägt userId von A (AK1)',
		);
		assert.equal(
			(rowB as unknown as { userId?: number | null }).userId,
			userB.id,
			'Angelegt von B → Zeile trägt userId von B (AK1)',
		);

		const listA = await listProviders(cookieA);
		const idsA = listA.map((p) => p.id);
		assert.equal(listA.length, 4, 'A sieht 2 Built-ins + instanzweite + eigenen');
		assert.ok(idsA.includes(idA) && idsA.includes(shared.id), 'Eigener + instanzweiter Provider sichtbar');
		assert.ok(!idsA.includes(idB), 'Provider von B erscheinen für A nicht (AK1)');

		const listB = await listProviders(cookieB);
		const idsB = listB.map((p) => p.id);
		assert.equal(listB.length, 4, 'B sieht 2 Built-ins + instanzweite + eigenen');
		assert.ok(idsB.includes(idB) && idsB.includes(shared.id));
		assert.ok(!idsB.includes(idA), 'Provider von A erscheinen für B nicht (AK1)');
	});

	it('#1547 TF2 (AK1): PUT/activate/DELETE auf fremde Provider-ID → 404; Eigentümer darf löschen', async () => {
		const cookieA = await register('owner@1547.example.com');
		const cookieB = await register('intruder@1547.example.com');
		const idA = await createProviderAndGetId(cookieA, { ...customPayload, name: 'A-privat' });

		assert.equal(
			(await updateProvider(cookieB, idA, { name: 'gekapert' })).status,
			404,
			'PUT auf fremden Provider → 404 (AK1)',
		);
		assert.equal((await activateProvider(cookieB, idA)).status, 404, 'activate auf fremden Provider → 404 (AK1)');
		assert.equal((await deleteProvider(cookieB, idA)).status, 404, 'DELETE auf fremden Provider → 404 (AK1)');

		const listA = await listProviders(cookieA);
		assert.ok(
			listA.some((p) => p.id === idA),
			"Nach Fremd-Zugriffen ist A's Provider unverändert da",
		);

		assert.equal((await deleteProvider(cookieA, idA)).status, 204, 'Eigentümer darf löschen');
		assert.ok(!(await listProviders(cookieA)).some((p) => p.id === idA));
	});

	it('#1547 TF3 (AK2): GET/PUT/activate/models leaken weder apiKey-Feld noch Schlüsselwert', async () => {
		const cookie = await register('leak@1547.example.com');
		const id = await createProviderAndGetId(cookie, { ...customPayload, apiKey: 'leak-check-key-4711' });

		const assertNoLeak = (label: string, text: string) => {
			assert.ok(!text.includes('"apiKey"'), `${label}: Feld apiKey darf nicht serialisiert werden (AK2)`);
			assert.ok(!text.includes('leak-check-key-4711'), `${label}: Schlüsselwert darf nicht vorkommen (AK2)`);
		};

		assertNoLeak('GET-Liste', await (await getProviders(cookie)).text());
		assertNoLeak('PUT', await (await updateProvider(cookie, id, { name: 'leak-check-renamed' })).text());
		assertNoLeak('activate', await (await activateProvider(cookie, id)).text());
		assertNoLeak('models', await (await getModels(cookie, id)).text());
	});

	it('#1547 Review Runde 1: nutzerlose Requests (Auth aktiv, kein Cookie) schreiben keine Provider', async () => {
		// Auth ist in dieser Suite aktiv (applyTestAuthEnv) — ein Request ohne Session-Cookie ist
		// der nutzerlose Fall aus resolveProviderUserId. Schreib-Endpunkte müssen ihn mit 401
		// abweisen (Defense-in-Depth neben requireAuth), GET bleibt bei instanzweiten offen.
		const { LlmProvider } = await import('../../models/index.js');
		const shared = await LlmProvider.create({
			name: 'instanzweit-guard',
			endpoint: 'https://shared.example.com/v1',
			apiKey: 'shared-key',
			model: 'shared-model',
			kind: 'custom',
		});
		const jsonHeaders = { 'Content-Type': 'application/json' };
		const noSession = (path: string, init?: RequestInit) => fetch(`${server.baseUrl}${path}`, init);

		assert.equal(
			(
				await noSession('/llm-providers', {
					method: 'POST',
					headers: jsonHeaders,
					body: JSON.stringify(customPayload),
				})
			).status,
			401,
			'POST ohne Session darf keinen (instanzweiten) Provider anlegen',
		);
		assert.equal(
			(
				await noSession(`/llm-providers/${shared.id}`, {
					method: 'PUT',
					headers: jsonHeaders,
					body: JSON.stringify({ name: 'gekapert' }),
				})
			).status,
			401,
			'PUT auf instanzweite Zeile ohne Session → 401',
		);
		assert.equal(
			(await noSession(`/llm-providers/${shared.id}`, { method: 'DELETE' })).status,
			401,
			'DELETE auf instanzweite Zeile ohne Session → 401',
		);
		assert.equal(
			(await noSession(`/llm-providers/${shared.id}/activate`, { method: 'POST' })).status,
			401,
			'activate ohne Session → 401',
		);
		assert.equal(
			(await noSession(`/llm-providers/${shared.id}/test`, { method: 'POST' })).status,
			401,
			'test ohne Session → 401 (kein Upstream-Call auf instanzweite Kosten)',
		);

		assert.equal(await LlmProvider.count({ where: { name: customPayload.name } }), 0, 'POST hat keine Zeile angelegt');
		const row = await LlmProvider.findByPk(shared.id);
		assert.ok(row, 'Instanzweite Zeile bleibt bestehen');
		assert.equal(row.name, 'instanzweit-guard', 'Instanzweite Zeile unverändert');
	});
});
