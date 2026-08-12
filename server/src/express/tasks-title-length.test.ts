import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Task } from '../models/index.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
process.env.SESSION_SECRET = 'test-secret-for-tests';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/**
 * Issue #582: Titel-Längenbeschränkung (30 Zeichen)
 * Rote Tests für Backend-Validierung bei Task Create/Update.
 * Die Tests FAILED, solange die 30-Zeichen-Beschränkung nicht implementiert ist.
 */
describe('Task — Titel-Länge (Issue #582)', () => {
	let cookie: string;

	/** Extrahiert das erste `name=value`-Paar aus einem Set-Cookie-Header (ohne Attribute). */
	const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

	/** Loggt über den Test-Only-Endpunkt ein und gibt den Cookie-Header für Folgeanfragen zurück. */
	const testLogin = async (email: string, displayName: string): Promise<string> => {
		const res = await fetch(`${server.baseUrl}/auth/test-login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, displayName }),
		});
		assert.equal(res.status, 200, `Test-Login für ${email} sollte 200 liefern`);
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie, 'Test-Login sollte einen Set-Cookie-Header setzen');
		return cookieFromSetCookie(setCookie);
	};

	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
		cookie = await testLogin('testuser@example.com', 'Test User');
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

	describe('POST /tasks — Titel-Länge bei Create', () => {
		it('Task mit 30 Zeichen Titel wird akzeptiert', async () => {
			const title30 = 'a'.repeat(30); // exakt 30 Zeichen
			const res = await post(
				'/tasks',
				{
					title: title30,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 201, '30-Zeichen-Titel sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 30);
		});

		it('Task mit 31 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title31 = 'b'.repeat(31); // 31 Zeichen > Limit
			const res = await post(
				'/tasks',
				{
					title: title31,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 400, '31-Zeichen-Titel sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok((body.error as string)?.includes('title'), 'Fehler sollte auf title verweisen');
		});

		it('Task mit exakt 30 Zeichen UTF-8 (Emoji) wird korrekt gezählt', async () => {
			const titleEmoji = '😀'.repeat(10); // 10 Emojis = 30 Zeichen (UTF-8 code units)
			const res = await post(
				'/tasks',
				{
					title: titleEmoji,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 201, '30-Zeichen-Emoji-Titel sollte akzeptiert werden');
		});

		it('Task mit leerem Titel wird abgelehnt (minimum 1 Zeichen)', async () => {
			const res = await post(
				'/tasks',
				{
					title: '',
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 400, 'Leerer Titel sollte abgelehnt werden');
		});
	});

	describe('PATCH /tasks/:id — Titel-Länge bei Update', () => {
		let taskId: number;

		it.beforeEach(async () => {
			const task = await Task.create({
				title: 'Original',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
			});
			taskId = task.id;
		});

		it('Update auf 30 Zeichen Titel wird akzeptiert', async () => {
			const title30 = 'c'.repeat(30);
			const res = await patch(`/tasks/${taskId}`, { title: title30 }, cookie);

			assert.equal(res.status, 200, 'Update auf 30 Zeichen sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 30);
		});

		it('Update auf 31 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title31 = 'd'.repeat(31);
			const res = await patch(`/tasks/${taskId}`, { title: title31 }, cookie);

			assert.equal(res.status, 400, 'Update auf 31 Zeichen sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok((body.error as string)?.includes('title'), 'Fehler sollte auf title verweisen');
		});
	});
});
