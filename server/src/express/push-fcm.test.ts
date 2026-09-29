import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { FcmToken } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/** FCM-Token der Android-App (#1670): registrieren, abmelden, Besitzwechsel zwischen Konten. */
applyTestAuthEnv('push-fcm');

let server: TestServer;

const post = (path: string, cookie: string, token: unknown) =>
	server.json(path, { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ token }) });

const tokensOf = async () =>
	(await FcmToken.findAll({ order: [['id', 'ASC']] })).map((row) => row.get({ plain: true }));

describe('FCM-Token der Android-App (#1670)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('speichert das Token für den Nutzer, doppeltes Registrieren legt keinen zweiten Eintrag an', async () => {
		const cookie = await server.login('a@example.com');
		assert.equal((await post('/push/fcm/register', cookie, 'fcm-1')).status, 204);
		assert.equal((await post('/push/fcm/register', cookie, 'fcm-1')).status, 204);
		const rows = await tokensOf();
		assert.equal(rows.length, 1);
		assert.equal(rows[0].token, 'fcm-1');
		assert.ok(rows[0].userId);
	});

	it('Abmelden entfernt das eigene Token, ein fremdes bleibt', async () => {
		const a = await server.login('a@example.com');
		const b = await server.login('b@example.com');
		await post('/push/fcm/register', a, 'fcm-a');
		await post('/push/fcm/register', b, 'fcm-b');

		assert.equal((await post('/push/fcm/unregister', a, 'fcm-b')).status, 204);
		assert.equal((await post('/push/fcm/unregister', a, 'fcm-a')).status, 204);
		assert.deepEqual(
			(await tokensOf()).map((row) => row.token),
			['fcm-b'],
		);
	});

	it('registriert Nutzer B ein Token von Nutzer A, gehört es danach nur noch B', async () => {
		const a = await server.login('a@example.com');
		const b = await server.login('b@example.com');
		await post('/push/fcm/register', a, 'geraet');
		const ownerA = (await tokensOf())[0].userId;

		await post('/push/fcm/register', b, 'geraet');
		const rows = await tokensOf();
		assert.equal(rows.length, 1);
		assert.notEqual(rows[0].userId, ownerA);
	});

	it('lehnt fehlende oder leere Tokens mit 400 ab', async () => {
		const cookie = await server.login('a@example.com');
		assert.equal((await post('/push/fcm/register', cookie, '')).status, 400);
		assert.equal((await post('/push/fcm/register', cookie, undefined)).status, 400);
		assert.equal((await post('/push/fcm/unregister', cookie, 42)).status, 400);
	});
});
