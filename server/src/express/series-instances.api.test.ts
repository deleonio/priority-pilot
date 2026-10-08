import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Category, Pillar, Series, SeriesPillar, Task, TaskPillar, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #2357 — `POST /series/:id/instances` legt genau eine Aufgabe aus einer Serie
 * auf Abruf an (Vertrag: docs/spec/issue-2357.md, AK1–AK4 und AK7). Rot, bis die Route existiert.
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('series-instances-api-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

let server: TestServer;

/** UTC-Mitternacht `offsetDays` Tage relativ zu heute. */
const futureDate = (offsetDays: number): Date => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offsetDays);
	result.setUTCHours(0, 0, 0, 0);
	return result;
};

describe('POST /series/:id/instances (#2357)', () => {
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

	const userIdOf = async (email: string): Promise<number> => {
		const user = await User.findOne({ where: { email } });
		assert.ok(user, `Setup: Konto ${email} muss existieren`);
		return user.id;
	};

	const postInstance = (cookie: string, seriesId: number, body?: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}/series/${seriesId}/instances`, {
			method: 'POST',
			headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
			body: body === undefined ? undefined : JSON.stringify(body),
		});

	const seedSeries = async (userId: number, overrides: Partial<Parameters<typeof Series.create>[0]> = {}) =>
		Series.create({
			title: 'Wochenputz',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 1,
			active: true,
			startDate: futureDate(29),
			userId,
			createdById: userId,
			...overrides,
		});

	const login = async (): Promise<{ cookie: string; userId: number }> => {
		const cookie = await server.login(ALICE);
		return { cookie, userId: await userIdOf(ALICE) };
	};

	// ── AK1: Serien-Snapshot ohne Overrides, unabhängig von autoCreate ───────────────

	for (const autoCreate of [true, false]) {
		it(`ohne Body → 201, Serien-Snapshot, Link und kein Anker, autoCreate=${autoCreate} (AK1)`, async () => {
			const { cookie, userId } = await login();
			const category = await Category.create({ name: 'Haushalt', color: '#1064d0', userId });
			const pillar = await Pillar.create({ name: 'Körper', weight: 20, userId });
			const series = await seedSeries(userId, { autoCreate, categoryId: category.id });
			await SeriesPillar.create({ seriesId: series.id, pillarId: pillar.id, share: 100, confidence: 80 });

			const res = await postInstance(cookie, series.id);
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.title, 'Wochenputz');
			assert.equal(body.categoryId, category.id);
			assert.equal(body.seriesId, series.id);
			assert.equal(body.isException, false);

			const tasks = await Task.findAll({ where: { seriesId: series.id } });
			assert.equal(tasks.length, 1, 'genau eine Aufgabe angelegt');
			assert.equal(tasks[0].originSeriesId, series.id);
			assert.equal(tasks[0].seriesOccurrence ?? null, null, 'kein Termin-Anker');
			assert.equal(tasks[0].userId, userId);
			const pillars = await TaskPillar.findAll({ where: { taskId: tasks[0].id } });
			assert.equal(pillars.length, 1, 'Säulen als Snapshot kopiert');
			assert.equal(pillars[0].pillarId, pillar.id);
			assert.equal(pillars[0].share, 100);
		});
	}

	it('leeres Objekt {} verhält sich wie kein Body (AK1)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId);
		const res = await postInstance(cookie, series.id, {});
		assert.equal(res.status, 201);
		assert.equal(((await res.json()) as { isException: boolean }).isException, false);
	});

	// ── AK2: Overrides und isException ────────────────────────────────────────────────

	it('abweichender title + deadline → beide Werte übernommen, isException=true (AK2)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId);
		const deadline = futureDate(3).toISOString();

		const res = await postInstance(cookie, series.id, { title: 'Fensterputz', deadline });
		assert.equal(res.status, 201);
		const body = (await res.json()) as { title: string; deadline: string; isException: boolean };
		assert.equal(body.title, 'Fensterputz');
		assert.equal(new Date(body.deadline).getTime(), new Date(deadline).getTime());
		assert.equal(body.isException, true);
	});

	it('Wert gleich der Serie (priority) → isException=false (AK2)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId, { priority: 4 });
		const res = await postInstance(cookie, series.id, { priority: 4 });
		assert.equal(res.status, 201);
		const body = (await res.json()) as { priority: number; isException: boolean };
		assert.equal(body.priority, 4);
		assert.equal(body.isException, false);
	});

	it('nur deadline mitgegeben → isException=false (AK2, Annahme)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId);
		const res = await postInstance(cookie, series.id, { deadline: futureDate(5).toISOString() });
		assert.equal(res.status, 201);
		assert.equal(((await res.json()) as { isException: boolean }).isException, false);
	});

	// ── AK3: Fehlerfälle ──────────────────────────────────────────────────────────────

	it('ruhende Serie → 409, keine Aufgabe angelegt (AK3)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId, { active: false });
		const res = await postInstance(cookie, series.id);
		assert.equal(res.status, 409);
		assert.equal(await Task.count({ where: { seriesId: series.id } }), 0);
	});

	it('unbekannte und fremde Serie → 404 (AK3)', async () => {
		const { cookie, userId } = await login();
		assert.equal((await postInstance(cookie, (await seedSeries(userId)).id)).status, 201, 'Setup: eigene Serie geht');
		await server.login(BOB);
		const foreign = await seedSeries(await userIdOf(BOB));

		assert.equal((await postInstance(cookie, 999999)).status, 404);
		assert.equal((await postInstance(cookie, foreign.id)).status, 404);
		assert.equal(await Task.count({ where: { seriesId: foreign.id } }), 0);
	});

	for (const [label, overrides] of [
		['leerer Titel', { title: '' }],
		['ungültige Deadline', { deadline: 'kein-datum' }],
	] as const) {
		it(`${label} → 400, keine Aufgabe angelegt (AK3)`, async () => {
			const { cookie, userId } = await login();
			const series = await seedSeries(userId);
			const res = await postInstance(cookie, series.id, overrides);
			assert.equal(res.status, 400);
			assert.equal(await Task.count({ where: { seriesId: series.id } }), 0);
		});
	}

	// ── AK4: Fünfer-Grenze greift nicht ───────────────────────────────────────────────

	it('bei 5 offenen Instanzen wird trotzdem eine weitere angelegt (AK4)', async () => {
		const { cookie, userId } = await login();
		const series = await seedSeries(userId);
		for (let i = 0; i < 5; i++) {
			await Task.create({
				title: `Instanz ${i}`,
				priority: 3,
				estimatedEffort: 1,
				seriesId: series.id,
				originSeriesId: series.id,
				seriesOccurrence: futureDate(i * 7),
				deadline: futureDate(i * 7),
				userId,
			});
		}
		const res = await postInstance(cookie, series.id);
		assert.equal(res.status, 201);
		assert.equal(await Task.count({ where: { seriesId: series.id } }), 6);
	});

	// ── AK7: Abruf-Aufgabe stört die automatische Generierung nicht ───────────────────

	it('Abruf-Aufgabe ohne Anker verhindert den regulären Termin bei autoCreate nicht (AK7)', async () => {
		const { cookie, userId } = await login();
		// Termin heute: liegt im 30-Tage-Horizont von generate-all.
		const series = await seedSeries(userId, { autoCreate: true, startDate: futureDate(0) });

		assert.equal((await postInstance(cookie, series.id)).status, 201);

		const gen = await fetch(`${server.baseUrl}/series/generate-all`, { method: 'POST', headers: { Cookie: cookie } });
		assert.equal(gen.status, 200);

		const tasks = await Task.findAll({ where: { seriesId: series.id } });
		const anchored = tasks.filter((task) => task.seriesOccurrence != null);
		assert.ok(anchored.length >= 1, 'der reguläre Termin entsteht trotz Abruf-Aufgabe');
		assert.equal(anchored[0].seriesOccurrence?.getTime(), futureDate(0).getTime());
		assert.equal(
			tasks.filter((task) => task.seriesOccurrence == null).length,
			1,
			'die Abruf-Aufgabe bleibt unverändert',
		);
	});
});
