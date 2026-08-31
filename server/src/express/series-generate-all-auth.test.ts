import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Rote Spec-Tests für #244 (AK4) — User-Isolation des Sammel-Endpunkts POST /series/generate-all.
// Der Auth-Kontext muss VOR dem Server-Start feststehen: createApp() liest diese Werte beim Aufbau
// der Session-/Passport-Middleware. KEIN Produktivcode.
process.env.GOOGLE_ALLOWED_EMAILS = 'user1@example.com,user2@example.com';
applyTestAuthEnv('test-secret-244');

let server: TestServer;

describe('POST /series/generate-all — User-Isolation (AK4 #244)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const dueSeries = (title: string) => ({
		title,
		rhythm: 'weekly',
		priority: 3,
		estimatedEffort: 0.5,
		active: true,
		startDate: '2026-01-01T00:00:00.000Z',
	});

	const postAs = (cookie: string, path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const getAs = (cookie: string, path: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

	it('generate-all von User1 berücksichtigt nur die Serien von User1 (userId-Scope)', async () => {
		const cookie1 = await server.login('user1@example.com', { displayName: 'User Eins' });
		const cookie2 = await server.login('user2@example.com', { displayName: 'User Zwei' });

		// Jede/r User legt eine eigene aktive, fällige Serie an.
		const created1 = await postAs(cookie1, '/series', dueSeries('Serie von User1'));
		assert.equal(created1.status, 201, 'User1 kann seine Serie anlegen');
		const created2 = await postAs(cookie2, '/series', dueSeries('Serie von User2'));
		assert.equal(created2.status, 201, 'User2 kann seine Serie anlegen');

		// User1 stößt den Sammel-Lauf an → nur die eigene Serie darf materialisiert werden.
		const genRes = await postAs(cookie1, '/series/generate-all', {});
		assert.equal(genRes.status, 200);
		const body = (await genRes.json()) as { created: number };
		assert.ok(body.created > 0, 'User1s aktive Serie erzeugt fällige Instanzen');

		// User1 sieht ausschließlich Tasks aus seiner eigenen Serie.
		const tasks1 = (await (await getAs(cookie1, '/tasks')).json()) as Array<{ seriesId: number | null }>;
		assert.equal(tasks1.length, body.created, 'User1 sieht genau die von seiner Serie erzeugten Tasks');
		assert.ok(tasks1.length > 0, 'es gibt Tasks für User1');

		// Gegenprobe: User2 hat durch User1s Lauf KEINE Tasks bekommen.
		const tasks2 = (await (await getAs(cookie2, '/tasks')).json()) as unknown[];
		assert.equal(tasks2.length, 0, 'User2 bleibt vom Lauf von User1 unberührt');
	});
});
