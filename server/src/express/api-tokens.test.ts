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
 *
 * Ergänzung #1357 (Spec docs/spec/issue-1357.md, Pflicht-Ablaufdatum): `createToken()` schickt ab
 * hier immer ein gültiges `expiresInDays` mit (Test-Pflege — nach AK1 lehnt der Server einen Request
 * ohne dieses Feld ab, die bestehenden #1352/#1356-Tests wollen aber weiterhin erfolgreich anlegen).
 * Die neuen AK1–AK3-Fälle unten prüfen die Validierung/Berechnung selbst.
 */

applyTestAuthEnv('api-tokens-test');

type CreatedToken = {
	id: number;
	name: string;
	token: string;
	createdAt: string;
	lastUsedAt: null;
	expiresAt: string;
};
type ListedToken = { id: number; name: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null };

let server: TestServer;

/** Gültige Standard-Laufzeit für Tests, die sich nicht selbst mit `expiresInDays` befassen (#1357). */
const DEFAULT_EXPIRES_IN_DAYS = 365;

const createToken = (
	cookie: string,
	name: string,
	expiresInDays: unknown = DEFAULT_EXPIRES_IN_DAYS,
): Promise<Response> =>
	server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name, expiresInDays }),
	});

const listTokens = (cookie: string): Promise<Response> => server.json('/api-tokens', { headers: { Cookie: cookie } });

const revokeToken = (cookie: string, id: number): Promise<Response> =>
	server.json(`/api-tokens/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });

const patchTokenScope = (cookie: string, id: number, scope: unknown): Promise<Response> =>
	server.json(`/api-tokens/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ scope }),
	});

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

	it('AK2: POST liefert scope: "read", GET listet den Token mit scope: "read"', async () => {
		const cookie = await server.register('token-scope-create@example.com', 'password123');

		const created = (await (await createToken(cookie, 'Neuer Token')).json()) as CreatedToken & {
			scope: string;
		};
		assert.equal(created.scope, 'read', 'ein neu angelegter Token trägt immer scope read');

		const list = (await (await listTokens(cookie)).json()) as (ListedToken & { scope: string })[];
		assert.equal(list.length, 1);
		assert.equal(list[0]!.scope, 'read', 'GET muss scope je Token mitliefern');
	});

	it('AK3: PATCH auf readwrite antwortet 200 mit aktualisiertem DTO, GET bestätigt danach denselben Wert', async () => {
		const cookie = await server.register('token-scope-patch@example.com', 'password123');
		const created = (await (await createToken(cookie, 'Wird hochgestuft')).json()) as CreatedToken;

		const patched = await patchTokenScope(cookie, created.id, 'readwrite');
		assert.equal(patched.status, 200);
		const patchedBody = (await patched.json()) as { id: number; scope: string };
		assert.equal(patchedBody.id, created.id);
		assert.equal(patchedBody.scope, 'readwrite');

		const list = (await (await listTokens(cookie)).json()) as (ListedToken & { scope: string })[];
		assert.equal(
			list.find((entry) => entry.id === created.id)?.scope,
			'readwrite',
			'der neue Wert muss über die DB persistiert sein, nicht nur in der PATCH-Antwort',
		);
	});

	it('AK3: PATCH mit unbekanntem scope-Wert liefert 400, der Token bleibt unverändert', async () => {
		const cookie = await server.register('token-scope-invalid@example.com', 'password123');
		const created = (await (await createToken(cookie, 'Bleibt read')).json()) as CreatedToken;

		const res = await patchTokenScope(cookie, created.id, 'admin');
		assert.equal(res.status, 400);

		const list = (await (await listTokens(cookie)).json()) as (ListedToken & { scope: string })[];
		assert.equal(list.find((entry) => entry.id === created.id)?.scope, 'read', 'ungültiger Wert darf nicht greifen');
	});

	it('AK3: PATCH auf einen fremden oder unbekannten Token liefert 404, dessen Wert bleibt read', async () => {
		const ownerCookie = await server.register('token-scope-owner@example.com', 'password123');
		const otherCookie = await server.register('token-scope-other@example.com', 'password123');
		const created = (await (await createToken(ownerCookie, 'Nur meiner')).json()) as CreatedToken;

		const foreign = await patchTokenScope(otherCookie, created.id, 'readwrite');
		assert.equal(foreign.status, 404, 'ein fremder Token darf nicht umschaltbar sein');

		const unknown = await patchTokenScope(ownerCookie, 999_999, 'readwrite');
		assert.equal(unknown.status, 404, 'ein unbekannter Token liefert 404');

		const list = (await (await listTokens(ownerCookie)).json()) as (ListedToken & { scope: string })[];
		assert.equal(
			list.find((entry) => entry.id === created.id)?.scope,
			'read',
			'der PATCH-Versuch eines fremden Nutzers darf den Wert nicht ändern',
		);
	});
});

describe('Persönliche API-Tokens — Pflicht-Ablaufdatum (#1357 AK1/AK2/AK3)', () => {
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

	it('AK1: POST ohne expiresInDays liefert 400, es wird kein Token angelegt', async () => {
		const cookie = await server.register('token-expiry-missing@example.com', 'password123');
		const res = await server.json('/api-tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'Ohne Laufzeit' }),
		});
		assert.equal(res.status, 400);
		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		assert.equal(list.length, 0, 'ein 400 wegen fehlender Laufzeit darf keine Zeile hinterlassen');
	});

	it('AK1: POST mit expiresInDays außerhalb der Whitelist (400) liefert 400, es wird kein Token angelegt', async () => {
		const cookie = await server.register('token-expiry-oob@example.com', 'password123');
		const res = await createToken(cookie, 'Zu lange Laufzeit', 400);
		assert.equal(res.status, 400, 'Höchstlaufzeit ist 365 Tage (12 Monate)');
		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		assert.equal(list.length, 0);
	});

	it('AK2: POST mit expiresInDays: 365 legt einen Token an, dessen expiresAt ~365 Tage in der Zukunft liegt', async () => {
		const cookie = await server.register('token-expiry-365@example.com', 'password123');
		const before = Date.now();
		const created = (await (await createToken(cookie, 'Ein Jahr gültig', 365)).json()) as CreatedToken;

		assert.equal(typeof created.expiresAt, 'string', 'Antwort muss expiresAt enthalten');
		const expiresAtMs = new Date(created.expiresAt).getTime();
		const expectedMs = before + 365 * 24 * 60 * 60 * 1000;
		const oneDayMs = 24 * 60 * 60 * 1000;
		assert.ok(
			Math.abs(expiresAtMs - expectedMs) <= oneDayMs,
			`expiresAt (${created.expiresAt}) muss tagesgenau ~365 Tage in der Zukunft liegen`,
		);
	});

	it('AK3: GET /api-tokens liefert je Token expiresAt (ISO-8601)', async () => {
		const cookie = await server.register('token-expiry-get@example.com', 'password123');
		const created = (await (await createToken(cookie, 'Mit Ablaufdatum', 90)).json()) as CreatedToken;

		const list = (await (await listTokens(cookie)).json()) as ListedToken[];
		const listed = list.find((entry) => entry.id === created.id);
		assert.ok(listed, 'Token muss in der Liste stehen');
		assert.equal(typeof listed!.expiresAt, 'string', 'GET muss expiresAt je Token mitliefern');
		assert.equal(listed!.expiresAt, created.expiresAt, 'GET muss denselben Wert wie POST liefern');
	});
});
