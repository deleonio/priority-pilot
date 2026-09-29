import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-tests');

let server: TestServer;

/**
 * Titel-Längenbeschränkung (65 Zeichen)
 * Tests für Backend-Validierung bei Task Create/Update.
 */
describe('Task — Titel-Länge', () => {
	let cookie: string;

	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
		cookie = await server.login('testuser@example.com', { displayName: 'Test User' });
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	/** #1818 AK1/AK2: deutsche Meldung mit dem Limit, ohne sequelize-Standardtext. */
	const assertTooLongMessage = (message: unknown): void => {
		assert.equal(typeof message, 'string');
		assert.match(message as string, /65/, 'Meldung nennt das Limit 65');
		assert.match(message as string, /zu lang/i, 'Meldung ist deutsch und nennt „zu lang"');
		assert.doesNotMatch(message as string, /Validation len/, 'kein sequelize-Standardtext');
	};

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
		it('Task mit 65 Zeichen Titel wird akzeptiert', async () => {
			const title65 = 'a'.repeat(65); // exakt 65 Zeichen
			const res = await post(
				'/tasks',
				{
					title: title65,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 201, '65-Zeichen-Titel sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 65);
		});

		it('Task mit 66 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title66 = 'b'.repeat(66); // 66 Zeichen > Limit
			const res = await post(
				'/tasks',
				{
					title: title66,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				},
				cookie,
			);

			assert.equal(res.status, 400, '66-Zeichen-Titel sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			// #1818 AK1: deutsche Klartext-Meldung mit Limit statt sequelize-Standard "Validation len on title failed".
			assertTooLongMessage(body.message);
		});

		it('Task mit exakt 65 Zeichen UTF-8 (Emoji) wird korrekt gezählt', async () => {
			const titleEmoji = '😀'.repeat(10) + 'x'.repeat(45); // 10 Emojis (20 UTF-16 code units) + 45 Zeichen = 65
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

			assert.equal(res.status, 201, '65-Zeichen-Emoji-Titel sollte akzeptiert werden');
		});

		it('#1818 AK3: 10 Emojis + 55 Zeichen = 65 Codepoints (130 → 75 UTF-16-Einheiten) werden angenommen', async () => {
			const title = '😀'.repeat(10) + 'x'.repeat(55);
			const res = await post('/tasks', { title, status: 'Open', priority: 3, estimatedEffort: 0.5 }, cookie);
			assert.equal(res.status, 201);
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
			// #1818 AK3: leer ist nicht „zu lang".
			const body = (await res.json()) as Record<string, unknown>;
			assert.doesNotMatch(String(body.message), /zu lang/i);
		});
	});

	describe('PATCH /tasks/:id — Titel-Länge bei Update', () => {
		let taskId: number;

		// Task via API (mit Cookie) anlegen, damit er dem Test-User gehört — findOwnTask
		// scope-t nach ownerScope(userId), sonst antwortet PATCH /tasks/:id mit 404.
		it.beforeEach(async () => {
			const res = await post(
				'/tasks',
				{ title: 'Original', status: 'Open', priority: 3, estimatedEffort: 0.5 },
				cookie,
			);
			const body = (await res.json()) as { id: number };
			taskId = body.id;
		});

		it('Update auf 65 Zeichen Titel wird akzeptiert', async () => {
			const title65 = 'c'.repeat(65);
			const res = await patch(`/tasks/${taskId}`, { title: title65 }, cookie);

			assert.equal(res.status, 200, 'Update auf 65 Zeichen sollte akzeptiert werden');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal((body.title as string).length, 65);
		});

		it('Update auf 66 Zeichen Titel wird mit ValidationError abgelehnt', async () => {
			const title66 = 'd'.repeat(66);
			const res = await patch(`/tasks/${taskId}`, { title: title66 }, cookie);

			assert.equal(res.status, 400, 'Update auf 66 Zeichen sollte abgelehnt werden');
			const body = (await res.json()) as Record<string, unknown>;
			assertTooLongMessage(body.message);
		});
	});
	describe('Serien — Titel-Länge (#1818 AK2)', () => {
		const futureStart = (): string => {
			const d = new Date();
			d.setUTCDate(d.getUTCDate() + 1);
			d.setUTCHours(0, 0, 0, 0);
			return d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
		};
		const validSeries = (title: string) => ({
			title,
			rhythm: 'weekly',
			priority: 4,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureStart(),
		});

		it('POST /series mit 66 Zeichen → 400 mit deutscher Meldung und Limit 65', async () => {
			const res = await post('/series', validSeries('s'.repeat(66)), cookie);
			assert.equal(res.status, 400);
			assertTooLongMessage(((await res.json()) as Record<string, unknown>).message);
		});

		it('PATCH /series/:id auf 66 Zeichen → 400 mit deutscher Meldung und Limit 65', async () => {
			const created = await post('/series', validSeries('Original'), cookie);
			assert.equal(created.status, 201);
			const { id } = (await created.json()) as { id: number };
			const res = await patch(`/series/${id}`, { title: 's'.repeat(66) }, cookie);
			assert.equal(res.status, 400);
			assertTooLongMessage(((await res.json()) as Record<string, unknown>).message);
		});

		it('POST /series mit 65 Codepoints inkl. Emoji wird angenommen', async () => {
			const res = await post('/series', validSeries('😀'.repeat(10) + 'x'.repeat(55)), cookie);
			assert.equal(res.status, 201);
		});
	});
});
