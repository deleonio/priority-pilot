import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Category, Series, Task } from '../models/index.js';
import { CATEGORY_COLORS } from '../models/categoryColors.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Auth-Env für Nutzer-Scoping (Muster pillars.test.ts). Per test-login mit Allowlist.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('categories-test');

let server: TestServer;

const RED = CATEGORY_COLORS[0];
const BLUE = CATEGORY_COLORS[5];

describe('Categories API', () => {
	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const get = (path: string, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, { headers: { ...(cookie ? { cookie } : {}) } });
	const post = (path: string, body: unknown, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
			body: JSON.stringify(body),
		});
	const patch = (path: string, body: unknown, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
			body: JSON.stringify(body),
		});
	const del = (path: string, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, { method: 'DELETE', headers: { ...(cookie ? { cookie } : {}) } });

	describe('GET /categories', () => {
		it('200 mit leerer Liste — neue Konten starten ohne Kategorien (kein Seed)', async () => {
			const cookie = await server.login('alice@example.com');
			const res = await get('/categories', cookie);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it('200 mit den eigenen Kategorien, alphabetisch sortiert', async () => {
			const cookie = await server.login('alice@example.com');
			await Category.bulkCreate([
				{ name: 'Steuer', color: BLUE, userId: 1 },
				{ name: 'Hausbau', color: RED, userId: 1 },
			]);

			const res = await get('/categories', cookie);
			assert.equal(res.status, 200);
			const body = (await res.json()) as { name: string; color: string }[];
			assert.deepEqual(
				body.map((entry) => entry.name),
				['Hausbau', 'Steuer'],
			);
			assert.equal(body[0].color, RED);
		});
	});

	describe('POST /categories', () => {
		it('201 legt eine Kategorie an', async () => {
			const cookie = await server.login('alice@example.com');
			const res = await post('/categories', { name: '  Hausbau  ', color: RED }, cookie);
			assert.equal(res.status, 201);
			const body = (await res.json()) as { id: number; name: string; color: string };
			assert.equal(body.name, 'Hausbau', 'Name wird getrimmt');
			assert.equal(body.color, RED);
			assert.equal(await Category.count({ where: { userId: 1 } }), 1);
		});

		it('400 bei leerem Namen und bei einer Farbe außerhalb der Palette', async () => {
			const cookie = await server.login('alice@example.com');
			assert.equal((await post('/categories', { name: '   ', color: RED }, cookie)).status, 400);
			assert.equal((await post('/categories', { name: 'Hausbau', color: '#123456' }, cookie)).status, 400);
			assert.equal(await Category.count(), 0, 'kein Datensatz bei ungültiger Eingabe');
		});

		it('409 bei doppeltem Namen desselben Nutzers, 201 für einen anderen Nutzer', async () => {
			const aliceCookie = await server.login('alice@example.com');
			assert.equal((await post('/categories', { name: 'Hausbau', color: RED }, aliceCookie)).status, 201);
			assert.equal((await post('/categories', { name: 'Hausbau', color: BLUE }, aliceCookie)).status, 409);

			const bobCookie = await server.login('bob@example.com');
			assert.equal(
				(await post('/categories', { name: 'Hausbau', color: RED }, bobCookie)).status,
				201,
				'derselbe Name ist für einen anderen Nutzer erlaubt',
			);
		});
	});

	describe('PATCH /categories/:id', () => {
		it('200 ändert Name und Farbe', async () => {
			const cookie = await server.login('alice@example.com');
			const category = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });

			const res = await patch(`/categories/${category.id}`, { name: 'Umbau', color: BLUE }, cookie);
			assert.equal(res.status, 200);
			await category.reload();
			assert.equal(category.name, 'Umbau');
			assert.equal(category.color, BLUE);
		});

		it('400 ohne Feld, 409 bei Namenskonflikt, 404 bei fremder Kategorie', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const bobCookie = await server.login('bob@example.com');
			const hausbau = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });
			await Category.create({ name: 'Steuer', color: BLUE, userId: 1 });
			const fremd = await Category.create({ name: 'Verein', color: RED, userId: 2 });

			assert.equal((await patch(`/categories/${hausbau.id}`, {}, aliceCookie)).status, 400);
			assert.equal((await patch(`/categories/${hausbau.id}`, { name: 'Steuer' }, aliceCookie)).status, 409);
			assert.equal(
				(await patch(`/categories/${fremd.id}`, { name: 'Fremd' }, aliceCookie)).status,
				404,
				'fremde Kategorie ist nicht auffindbar',
			);
			assert.equal((await patch(`/categories/${hausbau.id}`, { name: 'Eigen' }, bobCookie)).status, 404);
		});
	});

	describe('DELETE /categories/:id', () => {
		it('204 löscht die Kategorie und löst die Zuordnung an Aufgaben und Serien', async () => {
			const cookie = await server.login('alice@example.com');
			const category = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });
			const task = await Task.create({ title: 'Fliesen bestellen', userId: 1, categoryId: category.id });
			const series = await Series.create({
				title: 'Baustelle aufräumen',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date('2026-01-05T00:00:00.000Z'),
				userId: 1,
				categoryId: category.id,
			});

			const res = await del(`/categories/${category.id}`, cookie);
			assert.equal(res.status, 204);

			assert.equal(await Category.count(), 0, 'Kategorie ist gelöscht');
			await task.reload();
			await series.reload();
			assert.equal(task.categoryId ?? null, null, 'Aufgabe bleibt bestehen, nur ohne Zuordnung');
			assert.equal(series.categoryId ?? null, null, 'Serie bleibt bestehen, nur ohne Zuordnung');
		});

		it('404 bei fremder Kategorie — sie bleibt unangetastet', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const fremd = await Category.create({ name: 'Verein', color: RED, userId: 2 });

			assert.equal((await del(`/categories/${fremd.id}`, aliceCookie)).status, 404);
			assert.equal(await Category.count({ where: { userId: 2 } }), 1);
		});
	});

	describe('Kategorie an Aufgaben und Serien', () => {
		it('POST /tasks übernimmt eine eigene categoryId und lehnt eine fremde mit 400 ab', async () => {
			const cookie = await server.login('alice@example.com');
			const eigen = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });
			const fremd = await Category.create({ name: 'Verein', color: BLUE, userId: 2 });

			const ok = await post('/tasks', { title: 'Fliesen bestellen', categoryId: eigen.id }, cookie);
			assert.equal(ok.status, 201);
			assert.equal(((await ok.json()) as { categoryId: number | null }).categoryId, eigen.id);

			const abgelehnt = await post('/tasks', { title: 'Fremd', categoryId: fremd.id }, cookie);
			assert.equal(abgelehnt.status, 400);
			assert.equal(await Task.count({ where: { title: 'Fremd' } }), 0, 'kein Task bei ungültiger Kategorie');
		});

		it('PATCH /tasks/:id entfernt die Zuordnung mit null', async () => {
			const cookie = await server.login('alice@example.com');
			const category = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });
			const task = await Task.create({ title: 'Fliesen bestellen', userId: 1, categoryId: category.id });

			const res = await patch(`/tasks/${task.id}`, { categoryId: null }, cookie);
			assert.equal(res.status, 200);
			await task.reload();
			assert.equal(task.categoryId ?? null, null);
		});

		it('POST /series übernimmt die Kategorie ins Template', async () => {
			const cookie = await server.login('alice@example.com');
			const category = await Category.create({ name: 'Hausbau', color: RED, userId: 1 });

			const res = await post(
				'/series',
				{
					title: 'Baustelle aufräumen',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: '2026-01-05T00:00:00.000Z',
					categoryId: category.id,
				},
				cookie,
			);
			assert.equal(res.status, 201);
			assert.equal(((await res.json()) as { categoryId: number | null }).categoryId, category.id);
		});
	});
});
