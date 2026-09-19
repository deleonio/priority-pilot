import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	registerOn,
	applyTestAuthEnv,
	type TestServer,
} from '../../test/helpers.js';

/**
 * Rote Spec-Tests für #1577 — `POST /llm-providers/test-dry` (Spec docs/spec/issue-1577.md).
 *
 * Der Dry-Test prüft eine Verbindung mit den Formulardaten aus dem Request-Body (statt aus
 * einer DB-Zeile): Erfolg inkl. Latenz, Misserfolg mit konkreter Ursache, Key-Fallback über
 * `providerId` im Bearbeiten-Modus, 401 ohne Session, 404 auf fremde providerId — und nie
 * Persistenz. Der Test-Runner ist injiziert (kein echter Provider-Call) und zeichnet die
 * gesehenen Runtimes auf, damit Key-Fallback und Formular-Durchreichung assertierbar sind.
 */

applyTestAuthEnv('test-secret-llm-test-dry');

/** Runtimes, die der injizierte Runner gesehen hat (Key-Fallback/Durchreichung-Asserts). */
const seenRuntimes: Array<{ chatEndpoint: string; apiKey: string; model: string; label: string }> = [];

let server: TestServer;

/**POST /llm-providers/test-dry — rohe Response. */
const postDry = (cookie: string | undefined, body: unknown) =>
	fetch(`${server.baseUrl}/llm-providers/test-dry`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie !== undefined ? { Cookie: cookie } : {}) },
		body: JSON.stringify(body),
	});

const draftPayload = {
	endpoint: 'https://api.draft.example.com/v1',
	apiKey: 'draft-key-1577',
	model: 'glm-4.7',
};

describe('POST /llm-providers/test-dry (#1577)', () => {
	before(async () => {
		server = await startTestServer({
			runProviderTest: async (runtime) => {
				seenRuntimes.push({
					chatEndpoint: runtime.chatEndpoint,
					apiKey: runtime.apiKey,
					model: runtime.model,
					label: runtime.label,
				});
				if (runtime.apiKey === 'invalid-key-1577') {
					return { ok: false, message: 'Ungültiger API-Key (401 vom Anbieter).' };
				}
				return { ok: true, model: runtime.model, latencyMs: 37, sample: '{"ok": true}' };
			},
		});
	});

	beforeEach(async () => {
		seenRuntimes.length = 0;
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('TF1a (AK3): gültige Formulardaten → ok:true mit Modell und Latenz; Runner erhält exactly diese Daten', async () => {
		const { LlmProvider } = await import('../../models/index.js');
		const cookie = await registerOn(server, 'dry-ok@example.com');
		const before = await LlmProvider.count();

		const res = await postDry(cookie, draftPayload);
		assert.equal(res.status, 200, 'test-dry muss 200 liefern');
		const body = (await res.json()) as { ok: boolean; model?: string; latencyMs?: number };
		assert.equal(body.ok, true, 'Injizierter Runner meldet Erfolg');
		assert.equal(body.model, 'glm-4.7', 'Getestetes Modell wird genannt');
		assert.equal(typeof body.latencyMs, 'number', 'Latenz in ms ist Teil des Ergebnisses');

		assert.equal(seenRuntimes.length, 1, 'Genau ein Upstream-Test-Call');
		assert.equal(seenRuntimes[0]?.apiKey, 'draft-key-1577', 'API-Key aus dem Body erreicht den Runner');
		assert.equal(seenRuntimes[0]?.model, 'glm-4.7', 'Modell aus dem Body erreicht den Runner');
		assert.match(
			seenRuntimes[0]?.chatEndpoint ?? '',
			/^https:\/\/api\.draft\.example\.com\/v1\/chat\/completions$/,
			'Endpoint aus dem Body wird zur Chat-URL des Runners',
		);

		assert.equal(await LlmProvider.count(), before, 'Kein Provider wurde angelegt (AK3)');
	});

	it('TF1b (AK4): ungültiger Key → ok:false mit verständlicher Ursache, trotzdem 200', async () => {
		const cookie = await registerOn(server, 'dry-invalid@example.com');

		const res = await postDry(cookie, { ...draftPayload, apiKey: 'invalid-key-1577' });
		assert.equal(res.status, 200, 'Misserfolg ist ein Ergebnis, kein HTTP-Fehler');
		const body = (await res.json()) as { ok: boolean; message?: string };
		assert.equal(body.ok, false);
		assert.match(body.message ?? '', /Ungültiger API-Key/, 'Konkrete Ursache wird gemeldet');
	});

	it('TF1c: ohne Session → 401 (kein Upstream-Call auf fremde Kosten)', async () => {
		const res = await postDry(undefined, draftPayload);
		assert.equal(res.status, 401);
		assert.equal(seenRuntimes.length, 0, 'Ohne Session wird der Runner nie gefragt');
	});

	it('TF1d (AK2): leerer apiKey + eigene providerId → gespeicherter Key des Providers wird genutzt', async () => {
		const cookie = await registerOn(server, 'dry-fallback@example.com');
		const create = await fetch(`${server.baseUrl}/llm-providers`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ ...draftPayload, name: 'Fallback-Provider', apiKey: 'stored-key-1577' }),
		});
		assert.equal(create.status, 201, 'Testprovider muss angelegt sein');
		const { id } = (await create.json()) as { id: number };

		const res = await postDry(cookie, {
			endpoint: draftPayload.endpoint,
			apiKey: '',
			model: 'glm-4.7',
			providerId: id,
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { ok: boolean };
		assert.equal(body.ok, true);
		assert.equal(
			seenRuntimes[seenRuntimes.length - 1]?.apiKey,
			'stored-key-1577',
			'Leeres Key-Feld im Edit-Modus fällt auf den gespeicherten Key zurück (AK2)',
		);
	});

	it('TF1e (AK2): providerId eines fremden Providers → 404', async () => {
		const cookieOwner = await registerOn(server, 'dry-owner@example.com');
		const cookieIntruder = await registerOn(server, 'dry-intruder@example.com');
		const create = await fetch(`${server.baseUrl}/llm-providers`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookieOwner },
			body: JSON.stringify({ ...draftPayload, name: 'Fremd-Provider' }),
		});
		const { id } = (await create.json()) as { id: number };

		assert.equal(
			(await postDry(cookieIntruder, { ...draftPayload, apiKey: '', providerId: id })).status,
			404,
			'Fremde providerId verhält sich wie eine unbekannte (Besitzprüfung, AK2)',
		);
	});

	it('TF1f: ungültiger endpoint → 400 mit verständlicher Meldung, ohne Upstream-Call', async () => {
		const cookie = await registerOn(server, 'dry-validation@example.com');

		const res = await postDry(cookie, { ...draftPayload, endpoint: 'ftp://nope' });
		assert.equal(res.status, 400, 'Validierung wie beim Anlegen');
		const body = (await res.json()) as { message?: string };
		assert.match(body.message ?? '', /endpoint/, 'Meldung nennt das fehlerhafte Feld');
		assert.equal(seenRuntimes.length, 0, 'Kein Upstream-Call bei ungültigem Body');
	});
});
