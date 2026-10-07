import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1935 AK1 (Spec docs/spec/issue-1935.md) — `GET/PUT /mcp-instructions`.
 * Rot, bis die Route existiert (heute 404).
 */

process.env.GOOGLE_ALLOWED_EMAILS = 'mcpi-a@example.com,mcpi-b@example.com';
applyTestAuthEnv('mcp-instructions-test');

let server: TestServer;

const put = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/mcp-instructions', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const get = async (cookie: string): Promise<{ instructions: string }> => {
	const res = await server.json('/mcp-instructions', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200);
	return (await res.json()) as { instructions: string };
};

describe('/mcp-instructions (#1935 AK1)', () => {
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

	it('ohne Anmeldung 401', async () => {
		const res = await server.json('/mcp-instructions');
		assert.equal(res.status, 401);
	});

	it('GET liefert für neue Nutzer einen leeren Text', async () => {
		const cookie = await server.register('mcpi-a@example.com', 'password123');
		assert.deepEqual(await get(cookie), { instructions: '' });
	});

	it('PUT speichert den getrimmten Text, leer/Whitespace löscht', async () => {
		const cookie = await server.register('mcpi-a@example.com', 'password123');
		const res = await put(cookie, { instructions: '  Antworte kurz und knapp.  ' });
		assert.equal(res.status, 200);
		assert.equal((await get(cookie)).instructions, 'Antworte kurz und knapp.');

		assert.equal((await put(cookie, { instructions: '   ' })).status, 200);
		assert.equal((await get(cookie)).instructions, '');
	});

	it('PUT lehnt mehr als 2000 Zeichen und Nicht-Strings mit 400 ab; 2000 sind erlaubt', async () => {
		const cookie = await server.register('mcpi-a@example.com', 'password123');
		assert.equal((await put(cookie, { instructions: 'x'.repeat(2001) })).status, 400);
		assert.equal((await put(cookie, { instructions: 42 })).status, 400);
		assert.equal((await put(cookie, {})).status, 400);
		assert.equal((await put(cookie, { instructions: 'x'.repeat(2000) })).status, 200);
	});

	it('Nutzer A sieht nie die Vorgaben von Nutzer B', async () => {
		const a = await server.register('mcpi-a@example.com', 'password123');
		const b = await server.register('mcpi-b@example.com', 'password123');
		await put(a, { instructions: 'Nur für A' });
		assert.equal((await get(b)).instructions, '');
		assert.equal((await get(a)).instructions, 'Nur für A');
	});
});
