import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Series } from '../models/index.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
process.env.SESSION_SECRET = 'test-secret-for-tests';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/**
 * Issue #582: Titel-Längenbeschränkung (30 Zeichen)
 * Rote Tests für Backend-Validierung bei Series Create/Update.
 */
describe('Series — Titel-Länge (Issue #582)', () => {
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

	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	const patch = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	describe('POST /series — Titel-Länge bei Create', () => {
		it('Series mit 30 Zeichen Titel wird akzeptiert', async () => {
			const title30 = 'x'.repeat(30); // exakt 30 Zeichen
			const res = await post('/api/series', {
				title: title30,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date().toISOString(),
			});

			assert.equal(res.status, 201, '30-Zeichen-Titel sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 30);
		});

		it('Series mit 31 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title31 = 'y'.repeat(31); // 31 Zeichen > Limit
			const res = await post('/api/series', {
				title: title31,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date().toISOString(),
			});

			assert.equal(res.status, 400, '31-Zeichen-Titel sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok((body.error as string)?.includes('title'), 'Fehler sollte auf title verweisen');
		});

		it('Series mit exakt 30 Zeichen UTF-8 (Emoji) wird korrekt gezählt', async () => {
			const titleEmoji = '🎯'.repeat(10); // 10 Emojis = 30 Zeichen
			const res = await post('/api/series', {
				title: titleEmoji,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date().toISOString(),
			});

			assert.equal(res.status, 201, '30-Zeichen-Emoji-Titel sollte akzeptiert werden');
		});

		it('Series mit leerem Titel wird abgelehnt (minimum 1 Zeichen)', async () => {
			const res = await post('/api/series', {
				title: '',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date().toISOString(),
			});

			assert.equal(res.status, 400, 'Leerer Titel sollte abgelehnt werden');
		});
	});

	describe('PATCH /series/:id — Titel-Länge bei Update', () => {
		let seriesId: number;

		it.beforeEach(async () => {
			const series = await Series.create({
				title: 'Original-Serie',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date(),
			});
			seriesId = series.id;
		});

		it('Update auf 30 Zeichen Titel wird akzeptiert', async () => {
			const title30 = 'z'.repeat(30);
			const res = await patch(`/api/series/${seriesId}`, { title: title30 });

			assert.equal(res.status, 200, 'Update auf 30 Zeichen sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 30);
		});

		it('Update auf 31 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title31 = 'ü'.repeat(31);
			const res = await patch(`/api/series/${seriesId}`, { title: title31 });

			assert.equal(res.status, 400, 'Update auf 31 Zeichen sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok((body.error as string)?.includes('title'), 'Fehler sollte auf title verweisen');
		});
	});
});
