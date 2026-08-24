import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für Issue #640 — LLM-Provider-Konfiguration: Backend-Config-API.
 * Spec: docs/spec/issue-640.md (Journey 1–3).
 *
 * Diese Tests sind rot, bis `GET/PUT /llm-config` existiert (aktuell nicht geroutet → 404 statt
 * 200/400) und die Werte in SQLite persistiert werden.
 *
 * Journey 4 (Zugriffsschutz, „ohne Session → 401") ist als eigener Test enthalten: der Schutz hängt
 * allein daran, dass `llmConfigRouter` in `server/src/express/index.ts` NACH `app.use(requireAuth)`
 * registriert wird. Das ist eine reine Reihenfolge-Invariante (der `transitRouter` liegt bewusst
 * davor) — verschiebt jemand die Registrierung nach oben, wird `/llm-config` still öffentlich.
 */

process.env.SESSION_SECRET = 'test-secret-issue-640';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/** Registriert einen neuen Nutzer und gibt den Session-Cookie zurück (Muster: api-auth-protection.test.ts). */
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

describe('LLM-Config API (#640)', () => {
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

	const getConfig = (cookie: string) => fetch(`${server.baseUrl}/llm-config`, { headers: { Cookie: cookie } });
	const putConfig = (cookie: string, body: unknown) =>
		fetch(`${server.baseUrl}/llm-config`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	// ── Journey 1 — Defaults ohne persistierte Config ────────────────────────────
	it('Journey 1: GET ohne gespeicherte Config liefert Defaults (beide Keys nicht gesetzt, openrouter/free)', async () => {
		const cookie = await register('journey1@example.com', 'sicheres-passwort-1');

		const res = await getConfig(cookie);
		assert.equal(res.status, 200);
		const body = await res.json();
		assert.deepEqual(body, { hasMistralApiKey: false, hasOpenrouterApiKey: false, openrouterModel: 'openrouter/free' });
	});

	// ── Journey 2 — Persistenz + SECURITY: Keys werden gespeichert, aber nie zurückgegeben ──
	it('Journey 2: PUT persistiert Werte; GET/PUT-Antwort signalisieren nur „gesetzt", nie den Key-Wert', async () => {
		const cookie = await register('journey2@example.com', 'sicheres-passwort-1');

		const putRes = await putConfig(cookie, {
			mistralApiKey: 'm-key-123',
			openrouterApiKey: 'or-key-456',
			openrouterModel: 'custom/model',
		});
		assert.equal(putRes.status, 200);
		const putBody = await putRes.json();
		// PUT-Antwort ist der Status (Booleans + Modell), nicht die Key-Werte.
		assert.deepEqual(putBody, { hasMistralApiKey: true, hasOpenrouterApiKey: true, openrouterModel: 'custom/model' });
		// SECURITY-Regression: der Secret-Wert darf in keiner Antwort auftauchen.
		assert.ok(!JSON.stringify(putBody).includes('m-key-123'), 'PUT-Antwort darf den Mistral-Key nicht enthalten');
		assert.ok(!JSON.stringify(putBody).includes('or-key-456'), 'PUT-Antwort darf den OpenRouter-Key nicht enthalten');

		const getRes = await getConfig(cookie);
		assert.equal(getRes.status, 200);
		const body = await getRes.json();
		assert.deepEqual(body, { hasMistralApiKey: true, hasOpenrouterApiKey: true, openrouterModel: 'custom/model' });
		// SECURITY-Regression: auch GET liefert nur den Status, nie die gespeicherten Keys.
		assert.ok(!JSON.stringify(body).includes('m-key-123'), 'GET-Antwort darf den Mistral-Key nicht enthalten');
		assert.ok(!JSON.stringify(body).includes('or-key-456'), 'GET-Antwort darf den OpenRouter-Key nicht enthalten');
	});

	// ── Löschen — leerer String entfernt den persistierten Wert (Env-Fallback greift wieder) ──
	it('Leerer String löscht Key und Modell → Status „nicht gesetzt", Anzeige-Default zurück', async () => {
		const cookie = await register('clear@example.com', 'sicheres-passwort-1');
		await putConfig(cookie, { mistralApiKey: 'm-key-123', openrouterModel: 'custom/model' });

		const res = await putConfig(cookie, { mistralApiKey: '', openrouterModel: '' });
		assert.equal(res.status, 200);
		const body = await res.json();
		// `''` muss die Validierung passieren und den DB-Wert wirklich leeren — sonst bliebe der
		// „Key löschen"-Button der UI still wirkungslos, ohne dass ein Test rot wird.
		assert.equal(body.hasMistralApiKey, false);
		// Ohne DB-Wert zeigt GET wieder den Anzeige-Default (Legacy-Endpoint, reine Statusanzeige).
		assert.equal(body.openrouterModel, 'openrouter/free');

		const after = await (await getConfig(cookie)).json();
		assert.deepEqual(after, {
			hasMistralApiKey: false,
			hasOpenrouterApiKey: false,
			openrouterModel: 'openrouter/free',
		});
	});

	// ── Journey 3 — Validierung ───────────────────────────────────────────────
	it('Journey 3: PUT mit nur-Whitespace mistralApiKey → 400, keine Persistenz', async () => {
		const cookie = await register('journey3a@example.com', 'sicheres-passwort-1');

		const putRes = await putConfig(cookie, { mistralApiKey: '   ' });
		assert.equal(putRes.status, 400);

		// Keine Seiteneffekte: GET liefert weiterhin die Defaults.
		const getRes = await getConfig(cookie);
		const body = await getRes.json();
		assert.equal(body.hasMistralApiKey, false);
	});

	it('Journey 3: PUT mit openrouterModel als Zahl statt String → 400', async () => {
		const cookie = await register('journey3b@example.com', 'sicheres-passwort-1');

		const putRes = await putConfig(cookie, { openrouterModel: 12345 });
		assert.equal(putRes.status, 400);
	});

	// ── Journey 4 — Zugriffsschutz ────────────────────────────────────────────
	it('Journey 4: GET/PUT ohne Session → 401 (die Route muss hinter requireAuth registriert bleiben)', async () => {
		assert.equal((await getConfig('')).status, 401);
		assert.equal((await putConfig('', { openrouterModel: 'custom/model' })).status, 401);
	});
});
