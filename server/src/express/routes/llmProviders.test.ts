import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../../test/helpers.js';
import LlmConfig from '../../models/llmConfig.js';

/**
 * Rote Spec-Tests für Issue #951 — Single LLM-Provider-System mit Radio-Button-Auswahl.
 * Spec: docs/spec/issue-951.md (Journey: LLM-Provider verwalten).
 *
 * Diese Tests assertieren das Zielverhalten und sind ROT, bis `GET/POST/PUT/DELETE
 * /llm-providers` existiert (aktuell nicht geroutet → 404 statt 200/201) und die
 * Tabelle `llm_providers` mit Migration angelegt ist.
 */

process.env.SESSION_SECRET = 'test-secret-issue-951';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/** Registriert einen neuen Nutzer auf dem übergebenen Server und gibt den Session-Cookie zurück. */
const registerOn = async (target: TestServer, email: string, password: string): Promise<string> => {
	const res = await fetch(`${target.baseUrl}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	assert.equal(res.status, 201, `Register ${email} muss 201 liefern`);
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
	return setCookie.split(';')[0];
};

describe('LLM-Providers API (#951)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
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

	const providerPayload = {
		name: 'Mistral',
		endpoint: 'https://api.mistral.ai/v1/chat/completions',
		apiKey: 'secret-key-123',
		model: 'mistral-medium-latest',
	};

	/** Legt einen Provider an und gibt dessen ID aus der Antwort zurück. */
	const createProviderAndGetId = async (cookie: string, payload: unknown): Promise<number> => {
		const res = await createProvider(cookie, payload);
		assert.equal(res.status, 201, 'POST /llm-providers muss 201 liefern');
		const body = (await res.json()) as { id: number };
		assert.ok(body.id, 'Antwort muss die neue Provider-ID enthalten');
		return body.id;
	};

	// ── Journey 1 — Provider-Liste anzeigen ───────────────────────────
	it('Journey 1: GET /llm-providers ohne konfigurierte Provider → leeres Array', async () => {
		const cookie = await register('journey1@example.com');

		const res = await getProviders(cookie);
		assert.equal(res.status, 200, 'GET /llm-providers muss 200 liefern');
		const body = await res.json();
		assert.deepEqual(body, [], 'Ohne Provider muss ein leeres Array kommen');
	});

	// ── Journey 2 — Neuen Provider anlegen ────────────────────────────
	it('Neuen Provider anlegen: POST /llm-providers mit Name, Endpoint, API-Key, Modell', async () => {
		const cookie = await register('journey2@example.com');

		const res = await createProvider(cookie, providerPayload);
		assert.equal(res.status, 201, 'POST /llm-providers muss 201 liefern');
		const created = await res.json();
		assert.ok(!('apiKey' in created), 'Antwort darf den API-Key nicht enthalten');

		const listRes = await getProviders(cookie);
		const list = await listRes.json();
		assert.equal(list.length, 1, 'Angelegter Provider muss in der Liste erscheinen');
		assert.equal(list[0].name, 'Mistral');
	});

	// ── Sicherheit — API-Keys werden nie zurückgegeben ────────────────
	it('SECURITY: GET /llm-providers darf keine API-Keys enthalten', async () => {
		const cookie = await register('security@example.com');

		await createProviderAndGetId(cookie, providerPayload);

		const res = await getProviders(cookie);
		assert.equal(res.status, 200, 'GET /llm-providers muss 200 liefern');
		const body = await res.json();
		assert.equal(body.length, 1, 'Angelegter Provider muss gelistet sein');
		assert.ok(!('apiKey' in body[0]), 'Feld apiKey darf nicht serialisiert werden');
		assert.equal(JSON.stringify(body).includes('secret-key-123'), false, 'Key-Wert darf nirgends auftauchen');
	});

	// ── Aktivierungslogik — genau ein Provider aktiv ──────────────────
	it('Aktivieren eines Providers: POST /llm-providers/{id}/activate setzt isActive=true, andere auf false', async () => {
		const cookie = await register('activate@example.com');

		const firstId = await createProviderAndGetId(cookie, providerPayload);
		const secondId = await createProviderAndGetId(cookie, {
			...providerPayload,
			name: 'OpenRouter',
			endpoint: 'https://openrouter.ai/api/v1/chat/completions',
		});

		const activateRes = await activateProvider(cookie, secondId);
		assert.equal(activateRes.status, 200, 'Aktivierung muss 200 liefern');

		const list = await (await getProviders(cookie)).json();
		const second = list.find((p: { id: number }) => p.id === secondId);
		const first = list.find((p: { id: number }) => p.id === firstId);
		assert.equal(second.isActive, true, 'Aktivierter Provider muss isActive=true haben');
		assert.equal(first.isActive, false, 'Alle anderen Provider müssen isActive=false haben');
	});

	// ── PUT /llm-providers/{id} ──────────────────────────────────────
	it('PUT /llm-providers/{id} aktualisiert Provider-Daten', async () => {
		const cookie = await register('update@example.com');
		const id = await createProviderAndGetId(cookie, providerPayload);

		const res = await updateProvider(cookie, id, { name: 'Mistral Updated', model: 'mistral-small-latest' });
		assert.equal(res.status, 200, 'PUT /llm-providers/{id} muss 200 liefern');

		const list = await (await getProviders(cookie)).json();
		const updated = list.find((p: { id: number }) => p.id === id);
		assert.equal(updated.name, 'Mistral Updated', 'Name muss aktualisiert sein');
		assert.equal(updated.model, 'mistral-small-latest', 'Modell muss aktualisiert sein');
	});

	// ── DELETE /llm-providers/{id} ───────────────────────────────────
	it('DELETE /llm-providers/{id} löscht Provider', async () => {
		const cookie = await register('delete@example.com');
		const id = await createProviderAndGetId(cookie, providerPayload);

		const res = await deleteProvider(cookie, id);
		assert.equal(res.status, 204, 'DELETE /llm-providers/{id} muss 204 liefern');

		const list = await (await getProviders(cookie)).json();
		assert.equal(list.length, 0, 'Gelöschter Provider darf nicht mehr gelistet sein');
	});

	// ── Migration — bestehende LlmConfig-Daten werden migriert ────────
	it('Migration: bestehende Mistral/OpenRouter Keys werden in Provider-Einträge konvertiert', async () => {
		await resetDb();
		await LlmConfig.create({
			mistralApiKey: 'legacy-mistral-key',
			openrouterApiKey: 'legacy-openrouter-key',
		});

		// Eigener Server-Start nach dem Seeding: Die Migration läuft beim Boot bzw.
		// lazy — der frische Server muss die Legacy-Keys vorfinden.
		const migrationServer = await startTestServer();
		try {
			const cookie = await registerOn(migrationServer, 'migration@example.com', 'password');
			const res = await fetch(`${migrationServer.baseUrl}/llm-providers`, { headers: { Cookie: cookie } });
			assert.equal(res.status, 200, 'GET /llm-providers muss 200 liefern');
			const body = await res.json();

			const mistral = body.find((p: { name: string }) => p.name === 'Mistral');
			const openrouter = body.find((p: { name: string }) => p.name === 'OpenRouter');
			assert.ok(mistral, 'Mistral-Provider muss aus Legacy-Key migriert sein');
			assert.ok(openrouter, 'OpenRouter-Provider muss aus Legacy-Key migriert sein');
			assert.equal(mistral.isActive, true, 'Mistral muss laut Default aktiv sein');
			assert.equal(openrouter.isActive, false, 'OpenRouter muss inaktiv sein');
			assert.equal(
				JSON.stringify(body).includes('legacy-'),
				false,
				'Migrierte Key-Werte dürfen nie serialisiert werden',
			);
		} finally {
			await migrationServer.close();
		}
	});
});
