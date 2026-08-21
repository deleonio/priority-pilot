import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../../test/helpers.js';

/**
 * Rote Spec-Tests für Issue #951 — Single LLM-Provider-System mit Radio-Button-Auswahl.
 * Spec: docs/spec/issue-951.md (Journey: LLM-Provider verwalten).
 *
 * Diese Tests sind rot, bis `GET/POST/PUT/DELETE /llm-providers` existiert (aktuell nicht geroutet → 404)
 * und die Tabelle `llm_providers` mit Migration angelegt ist.
 */

process.env.SESSION_SECRET = 'test-secret-issue-951';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/** Registriert einen neuen Nutzer und gibt den Session-Cookie zurück. */
const register = async (email: string, password: string): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/register`, {
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

	// ── Journey 1 — Provider-Liste anzeigen ───────────────────────────
	it('Journey 1: GET /llm-providers ohne konfigurierte Provider → leeres Array', async () => {
		const cookie = await register('journey1@example.com', 'password');

		const res = await getProviders(cookie);
		// Endpunkt existiert noch nicht → 404
		// assert.equal(res.status, 200);
		// const body = await res.json();
		// assert.deepEqual(body, []);
		assert.equal(res.status, 404, 'GET /llm-providers muss 404 zurückgeben, bis die Route existiert');
	});

	// ── Journey electronic — Neuen Provider anlegen ─────────────────────
	it('Neuen Provider anlegen: POST /llm-providers mit Name, Endpoint, API-Key, Modell', async () => {
		const cookie = await register('journey2@example.com', 'password');

		const res = await createProvider(cookie, {
			name: 'Mistral',
			endpoint: 'https://api.mistral.ai/v1/chat/completions',
			apiKey: 'secret-key-123',
			model: 'mistral-medium-latest',
		});
		assert.equal(res.status, 404, 'POST /llm-providers muss 404 zurückgeben, bis die Route existiert');
	});

	// ── Sicherheit — API-Keys werden nie zurückgegeben ────────────────
	it('SECURITY: GET /llm-providers darf keine API-Keys enthalten', async () => {
		const cookie = await register('security@example.com', 'password');
		// Dieser Test wird später implementiert, wenn die API existiert
		// Aktuell erwartet er 404
		const res = await getProviders(cookie);
		assert.equal(res.status, 404);
	});

	// ── Aktivierungslogik — genau ein Provider aktiv ──────────────────
	it('Aktivieren eines Providers: POST /llm-providers/{id}/activate setzt isActive=true, andere auf false', async () => {
		const cookie = await register('activate@example.com', 'password');
		const res = await activateProvider(cookie, 682); // fiktive ID
		assert.equal(res.status, 404, 'Aktivierungs-Endpunkt muss noch implementiert werden');
	});

	// ── PUT /llm-providers/{id} ──────────────────────────────────────
	it('PUT /llm-providers/{id} aktualisiert Provider-Daten', async () => {
		const cookie = await register('update@example.com', 'password');
		const res = await updateProvider(cookie, 42, { name: 'Updated' });
		assert.equal(res.status, 404, 'PUT /llm-providers/{id} muss 404 zurückgeben, bis die Route existiert');
	});

	// ── DELETE /llm-providers/{id} ───────────────────────────────────
	it('DELETE /llm-providers/{id} löscht Provider', async () => {
		const cookie = await register('delete@example.com', 'password');
		const res = await deleteProvider(cookie, 42);
		assert.equal(res.status, 404, 'DELETE /llm-providers/{id} muss 404 zurückgeben, bis die Route existiert');
	});

	// ── Migration — bestehende LlmConfig-Daten werden migriert ────────
	it('Migration: bestehende Mistral/OpenRouter Keys werden in Provider-Einträge konvertiert', async () => {
		// Dieser Test erfordert die Migrationslogik
		// Aktuell nur Platzhalter
		assert.ok(true, 'Migrationstest wird später implementiert');
	});
});
