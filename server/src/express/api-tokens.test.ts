import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import sequelize from '../database.js';

/**
 * Rote Spec-Tests für #1352 (Spec docs/spec/issue-1352.md) — persönliche API-Tokens.
 *
 * AK1/AK2/AK4: `POST /api-tokens` legt einen Token an und liefert den Klartext genau einmal;
 * `GET /api-tokens` liefert nie Klartext/Hash; die DB-Zeile enthält ausschließlich einen Hash;
 * `DELETE /api-tokens/:id` zieht den Token zurück.
 *
 * Rot, bis das Modell `ApiToken` und der Router existieren (heute: 404/SPA-Fallback bzw. Modul
 * fehlt — legitimer roter Ausgangszustand für neue Funktionalität). KEIN Produktivcode.
 * Muster: geo-config.test.ts (Pro-User-Ressource hinter requireAuth).
 */

applyTestAuthEnv('api-tokens-test');

type CreatedToken = { id: number; name: string; token: string; createdAt: string; lastUsedAt: null };
type ListedToken = { id: number; name: string; createdAt: string; lastUsedAt: string | null };

let server: TestServer;

const createToken = (cookie: string, name: string): Promise<Response> =>
	server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name }),
	});

const listTokens = (cookie: string): Promise<Response> => server.json('/api-tokens', { headers: { Cookie: cookie } });

const revokeToken = (cookie: string, id: number): Promise<Response> =>
	server.json(`/api-tokens/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });

describe('Persönliche API-Tokens — Verwaltung (#1352 AK1/AK2/AK4)', () => {
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

	it('ohne Session → 401 (POST/GET/DELETE)', async () => {
		assert.equal((await createToken('cookie=none', 'Skript')).status, 401);
		assert.equal((await listTokens('cookie=none')).status, 401);
		assert.equal((await revokeToken('cookie=none', 1)).status, 401);
	});

	it('AK1: POST /api-tokens liefert den Klartext genau einmal, GET nie', async () => {
		const cookie = await server.register('token-owner@example.com', 'password123');

		const created = await createToken(cookie, 'Mein Skript');
		assert.equal(created.status, 201, 'Anlegen muss 201 liefern');
		const body = (await created.json()) as CreatedToken;
		assert.equal(body.name, 'Mein Skript');
		assert.equal(typeof body.token, 'string', 'Antwort muss den Klartext enthalten');
		assert.ok(body.token.length > 0, 'Klartext darf nicht leer sein');
		assert.equal(body.lastUsedAt, null);

		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		assert.equal(list.length, 1);
		assert.equal(list[0]!.id, body.id);
		assert.equal(list[0]!.name, 'Mein Skript');
		assert.equal(
			(list[0] as unknown as Record<string, unknown>).token,
			undefined,
			'Liste darf keinen Klartext enthalten',
		);
		assert.equal(
			(list[0] as unknown as Record<string, unknown>).tokenHash,
			undefined,
			'Liste darf keinen Hash enthalten',
		);
	});

	it('AK1: leerer Name wird mit 400 abgelehnt, ohne einen Token anzulegen', async () => {
		const cookie = await server.register('token-invalid@example.com', 'password123');
		const res = await createToken(cookie, '');
		assert.equal(res.status, 400);
		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		assert.equal(list.length, 0, 'ein 400 darf keine Zeile hinterlassen');
	});

	it('AK2: in der Datenbank steht ausschließlich ein Hash — der Klartext ist in keiner Spalte auffindbar', async () => {
		const cookie = await server.register('token-hash@example.com', 'password123');
		const created = (await (await createToken(cookie, 'DB-Check')).json()) as CreatedToken;

		const [rows] = await sequelize.query('SELECT * FROM api_tokens WHERE id = ?', {
			replacements: [created.id],
		});
		const row = (rows as Record<string, unknown>[])[0];
		assert.ok(row, 'die Token-Zeile muss existieren');
		const serialized = JSON.stringify(row);
		assert.ok(!serialized.includes(created.token), 'der Klartext darf in keiner Spalte der Zeile stehen');
		assert.equal(typeof row!.tokenHash, 'string', 'es muss eine tokenHash-Spalte mit Wert geben');
		assert.notEqual(row!.tokenHash, created.token, 'tokenHash darf nicht der Klartext sein');
	});

	it('AK4: DELETE /api-tokens/:id zieht den Token zurück, danach 401 mit diesem Token', async () => {
		const cookie = await server.register('token-revoke@example.com', 'password123');
		const created = (await (await createToken(cookie, 'Wird zurückgezogen')).json()) as CreatedToken;

		const del = await revokeToken(cookie, created.id);
		assert.equal(del.status, 204);

		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		assert.ok(
			!list.some((entry) => entry.id === created.id),
			'zurückgezogener Token darf nicht mehr in der Liste stehen',
		);

		const authed = await fetch(`${server.baseUrl}/tasks`, { headers: { Authorization: `Bearer ${created.token}` } });
		assert.equal(authed.status, 401, 'ein zurückgezogener Token darf keinen Zugriff mehr gewähren');
	});

	it('AK4: DELETE auf einen fremden Token liefert 404, der Token bleibt gültig', async () => {
		const ownerCookie = await server.register('token-owner-2@example.com', 'password123');
		const otherCookie = await server.register('token-other@example.com', 'password123');
		const created = (await (await createToken(ownerCookie, 'Nur meiner')).json()) as CreatedToken;

		const del = await revokeToken(otherCookie, created.id);
		assert.equal(del.status, 404, 'fremder Token darf nicht zurückziehbar sein');

		const list = (await (await listTokens(ownerCookie)).json()) as ListedToken[];
		assert.ok(
			list.some((entry) => entry.id === created.id),
			'eigener Token muss unangetastet bleiben',
		);
	});
});
