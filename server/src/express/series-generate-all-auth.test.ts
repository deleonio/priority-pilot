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
		const created1Res = await postAs(cookie1, '/series', dueSeries('Serie von User1'));
		assert.equal(created1Res.status, 201, 'User1 kann seine Serie anlegen');
		const series1 = (await created1Res.json()) as { id: number };
		const created2Res = await postAs(cookie2, '/series', dueSeries('Serie von User2'));
		assert.equal(created2Res.status, 201, 'User2 kann seine Serie anlegen');
		const series2 = (await created2Res.json()) as { id: number };

		// #2404: POST erzeugt sofort Instanzen; verify User1 has tasks from his series
		const tasks1Initial = (await (await getAs(cookie1, '/tasks')).json()) as Array<{ seriesId: number | null }>;
		assert.ok(tasks1Initial.length > 0, 'User1s Serie erzeugt sofort Instanzen bei POST');
		assert.ok(
			tasks1Initial.some((t) => t.seriesId === series1.id),
			'User1 hat Tasks aus seiner Serie',
		);
		const user1TasksCount = tasks1Initial.length;

		// User2 hat ebenfalls Instanzen (von seiner eigenen Serie)
		const tasks2Initial = (await (await getAs(cookie2, '/tasks')).json()) as Array<{ seriesId: number | null }>;
		assert.ok(tasks2Initial.length > 0, 'User2s eigene Serie erzeugt sofort Instanzen bei POST');
		assert.ok(
			tasks2Initial.some((t) => t.seriesId === series2.id),
			'User2 hat Tasks aus seiner Serie',
		);
		assert.ok(!tasks2Initial.some((t) => t.seriesId === series1.id), 'User2 hat KEINE Tasks von User1s Serie');

		// User1 stößt den Sammel-Lauf an → generate-all ist idempotent, created: 0
		const genRes = await postAs(cookie1, '/series/generate-all', {});
		assert.equal(genRes.status, 200);
		const body = (await genRes.json()) as { created: number };
		assert.equal(body.created, 0, 'generate-all ist idempotent (POST hat bereits erzeugt)');

		// Aufgabenzahl bleibt gleich
		const tasks1Final = (await (await getAs(cookie1, '/tasks')).json()) as Array<{ seriesId: number | null }>;
		assert.equal(tasks1Final.length, user1TasksCount, 'Aufgabenzahl unverändert nach generate-all');
	});
});
