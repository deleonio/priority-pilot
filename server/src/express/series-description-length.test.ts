import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-tests');

let server: TestServer;

/**
 * Beschreibung-Längenbeschränkung (3000 Zeichen)
 * Tests für Backend-Validierung bei Series Create/Update. Die Beschreibung bleibt optional.
 */
describe('Series — Beschreibung-Länge', () => {
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

	const post = (path: string, body: unknown, cookie: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Cookie: cookie,
			},
			body: JSON.stringify(body),
		});

	const patch = (path: string, body: unknown, cookie: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Cookie: cookie,
			},
			body: JSON.stringify(body),
		});

	describe('POST /series — Beschreibung-Länge bei Create', () => {
		let cookie: string;

		it.beforeEach(async () => {
			cookie = await server.login('testuser@example.com', { displayName: 'Test User' });
		});

		it('Series mit 3000 Zeichen Beschreibung wird akzeptiert', async () => {
			const description3000 = 'a'.repeat(3000);
			const res = await post(
				'/series',
				{
					title: 'Serie mit langer Beschreibung',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date().toISOString(),
					description: description3000,
				},
				cookie,
			);

			assert.equal(res.status, 201, '3000-Zeichen-Beschreibung sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.description as string).length, 3000);
		});

		it('Series mit 3001 Zeichen Beschreibung wird mit ValidationError abgelehnt', async () => {
			const description3001 = 'b'.repeat(3001);
			const res = await post(
				'/series',
				{
					title: 'Serie mit zu langer Beschreibung',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date().toISOString(),
					description: description3001,
				},
				cookie,
			);

			assert.equal(res.status, 400, '3001-Zeichen-Beschreibung sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok(body.message, 'Fehler sollte eine message enthalten');
		});

		it('Series ohne Beschreibung wird weiterhin akzeptiert (optional)', async () => {
			const res = await post(
				'/series',
				{
					title: 'Serie ohne Beschreibung',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date().toISOString(),
				},
				cookie,
			);

			assert.equal(res.status, 201, 'Serie ohne Beschreibung sollte akzeptiert werden');
		});
	});

	describe('PATCH /series/:id — Beschreibung-Länge bei Update', () => {
		let seriesId: number;
		let cookie: string;

		it.beforeEach(async () => {
			cookie = await server.login('testuser@example.com', { displayName: 'Test User' });
			const res = await post(
				'/series',
				{
					title: 'Original-Serie',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date().toISOString(),
				},
				cookie,
			);
			const body = (await res.json()) as { id: number };
			seriesId = body.id;
		});

		it('Update auf 3000 Zeichen Beschreibung wird akzeptiert', async () => {
			const description3000 = 'c'.repeat(3000);
			const res = await patch(`/series/${seriesId}`, { description: description3000 }, cookie);

			assert.equal(res.status, 200, 'Update auf 3000 Zeichen sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.description as string).length, 3000);
		});

		it('Update auf 3001 Zeichen Beschreibung wird mit ValidationError abgelehnt', async () => {
			const description3001 = 'd'.repeat(3001);
			const res = await patch(`/series/${seriesId}`, { description: description3001 }, cookie);

			assert.equal(res.status, 400, 'Update auf 3001 Zeichen sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok(body.message, 'Fehler sollte eine message enthalten');
		});
	});
});
