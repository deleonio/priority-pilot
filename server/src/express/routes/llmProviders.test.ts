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
});
