import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, TaskPillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Auth-Env für Nutzer-Scoping (Teil 2, #428). Per test-login mit allowlist.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('pillars-test');

let server: TestServer;

describe('Pillars API', () => {
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
		fetch(`${server.baseUrl}${path}`, {
			headers: { ...(cookie ? { cookie } : {}) },
		});
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
		fetch(`${server.baseUrl}${path}`, {
			method: 'DELETE',
			headers: { ...(cookie ? { cookie } : {}) },
		});
	const put = (path: string, body: unknown, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
			body: JSON.stringify(body),
		});

	/** Test-Only-Login liefert einen Cookie für den Nutzer (test-login). */
	/** Legt die fünf Standard-Säulen für einen Nutzer an (userId-scoped). */
	const seedPillarsForUser = async (userId: number): Promise<Pillar[]> =>
		Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight, userId })));

	// ── GET /pillars ─────────────────────────────────────────────────────────

	describe('GET /pillars', () => {
		it('200 mit leerer Liste ohne Säulen', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const res = await get('/pillars', aliceCookie);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it('200 mit allen Säulen inkl. weight und description, nach id sortiert', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1; // test-login legt Nutzer mit id=1 an (alice@example.com)
			const pillars = await seedPillarsForUser(userId);

			const res = await get('/pillars', aliceCookie);
			assert.equal(res.status, 200);
			const body = (await res.json()) as { id: number; name: string; description: string; weight: number }[];
			assert.equal(body.length, 5);
			assert.deepEqual(
				body.map((p) => p.id),
				pillars.map((p) => p.id),
			);
			for (const pillar of body) {
				assert.equal(pillar.weight, 20);
				assert.ok(typeof pillar.name === 'string');
				assert.ok(typeof pillar.description === 'string' && pillar.description.length > 0);
			}
			assert.deepEqual(
				body.map((p) => p.name),
				SEED_PILLARS.map((p) => p.name),
			);
		});
	});

	// ── PUT /pillars/weights ───────────────────────────────────────────────────

	describe('PUT /pillars/weights', () => {
		it('200 setzt eine gültige Verteilung (Summe 100) und persistiert sie', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const weights = [
				{ id: pillars[0].id, weight: 40 },
				{ id: pillars[1].id, weight: 30 },
				{ id: pillars[2].id, weight: 10 },
				{ id: pillars[3].id, weight: 10 },
				{ id: pillars[4].id, weight: 10 },
			];
			const res = await put('/pillars/weights', { weights }, aliceCookie);
			assert.equal(res.status, 200);
			const body = (await res.json()) as { id: number; weight: number }[];
			assert.deepEqual(
				body.map((p) => p.weight),
				[40, 30, 10, 10, 10],
			);
			const reloaded = await Pillar.findByPk(pillars[0].id);
			assert.equal(reloaded?.weight, 40);
		});

		it('200 akzeptiert Float-Verteilung innerhalb der Toleranz (33,33 + 33,33 + 33,34)', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			await Pillar.bulkCreate([
				{ name: 'A', weight: 50, userId },
				{ name: 'B', weight: 30, userId },
				{ name: 'C', weight: 20, userId },
			]);
			const pillars = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
			const res = await put(
				'/pillars/weights',
				{
					weights: [
						{ id: pillars[0].id, weight: 33.33 },
						{ id: pillars[1].id, weight: 33.33 },
						{ id: pillars[2].id, weight: 33.34 },
					],
				},
				aliceCookie,
			);
			assert.equal(res.status, 200);
		});

		it('400 wenn die Summe nicht 100 ergibt', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const res = await put(
				'/pillars/weights',
				{
					weights: pillars.map((p) => ({ id: p.id, weight: 10 })),
				},
				aliceCookie,
			);
			assert.equal(res.status, 400);
		});

		it('400 wenn ein Gewicht negativ ist', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const res = await put(
				'/pillars/weights',
				{
					weights: [
						{ id: pillars[0].id, weight: -10 },
						{ id: pillars[1].id, weight: 40 },
						{ id: pillars[2].id, weight: 30 },
						{ id: pillars[3].id, weight: 20 },
						{ id: pillars[4].id, weight: 20 },
					],
				},
				aliceCookie,
			);
			assert.equal(res.status, 400);
		});

		it('400 wenn nicht alle Säulen abgedeckt sind', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const res = await put(
				'/pillars/weights',
				{
					weights: [
						{ id: pillars[0].id, weight: 50 },
						{ id: pillars[1].id, weight: 50 },
					],
				},
				aliceCookie,
			);
			assert.equal(res.status, 400);
		});

		it('400 bei unbekannter Säulen-id', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			weights[0] = { id: 99999, weight: 20 };
			const res = await put('/pillars/weights', { weights }, aliceCookie);
			assert.equal(res.status, 400);
		});

		it('400 bei fremder (nicht zu Nutzer gehörender) Säulen-id', async () => {
			const bobCookie = await server.login('bob@example.com');

			// Alice hat Säulen
			await seedPillarsForUser(1);
			// Bob hat Säulen
			await seedPillarsForUser(2);

			const alicePillars = await Pillar.findAll({ where: { userId: 1 }, order: [['id', 'ASC']] });
			const bobPillars = await Pillar.findAll({ where: { userId: 2 }, order: [['id', 'ASC']] });

			// Bob versucht, eine von Alices Säulen in seiner Gewichtung zu verwenden
			const weights = bobPillars.map((p) => ({ id: p.id, weight: 20 }));
			weights[0] = { id: alicePillars[0]!.id, weight: 20 };
			const res = await put('/pillars/weights', { weights }, bobCookie);
			assert.equal(res.status, 400, 'fremde Säulen-id in weights wird abgewiesen');
		});

		it('400 bei doppelter id', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const res = await put(
				'/pillars/weights',
				{
					weights: [
						{ id: pillars[0].id, weight: 20 },
						{ id: pillars[0].id, weight: 20 },
						{ id: pillars[2].id, weight: 20 },
						{ id: pillars[3].id, weight: 20 },
						{ id: pillars[4].id, weight: 20 },
					],
				},
				aliceCookie,
			);
			assert.equal(res.status, 400);
		});

		it('400 wenn weights fehlt oder keine Liste ist', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			await seedPillarsForUser(userId);
			assert.equal((await put('/pillars/weights', {}, aliceCookie)).status, 400);
			assert.equal((await put('/pillars/weights', { weights: 'nope' }, aliceCookie)).status, 400);
			assert.equal((await put('/pillars/weights', { weights: [] }, aliceCookie)).status, 400);
		});

		it('400 wenn weight kein Number ist', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			(weights[0] as { id: number; weight: unknown }).weight = 'viel';
			const res = await put('/pillars/weights', { weights }, aliceCookie);
			assert.equal(res.status, 400);
		});

		it('400 wenn Body kein Objekt ist', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			await seedPillarsForUser(userId);
			const res = await fetch(`${server.baseUrl}/pillars/weights`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify(null),
			});
			assert.equal(res.status, 400);
		});
	});

	// ── CRUD-Sperre (#1573, AK1) ─────────────────────────────────────────────────────────────
	// Die fünf Säulen sind fest: Anlegen/Umbenennen/Löschen ist serverseitig gesperrt. Die früheren
	// POST/PATCH/DELETE-Erfolgs- und Validierungstests (#428) beschreiben seither verbotenes
	// Verhalten und wurden ersatzlos entfernt (Spec: docs/spec/issue-1573.md, AK1).

	describe('CRUD-Sperre (#1573)', () => {
		/** Sperr-Antwort: 4xx mit erklärendem Hinweistext („fest"/„gesperrt"), kein Nebeneffekt. */
		const assertLocked = async (res: Response, context: string): Promise<void> => {
			assert.ok(res.status >= 400 && res.status < 500, `${context}: erwartet 4xx, erhalten ${res.status}`);
			const body = (await res.json()) as { message?: string };
			assert.ok(typeof body.message === 'string' && body.message.length > 0, `${context}: Fehlermeldung vorhanden`);
			assert.match(body.message, /fest|gesperrt/i, `${context}: Hinweistext erklärt die Sperre`);
			assert.notEqual(res.status, 401, `${context}: gesperrt ≠ nicht angemeldet`);
			assert.notEqual(res.status, 500, `${context}: Sperre ist kein Serverfehler`);
		};

		it('POST /pillars antwortet mit 4xx + Hinweis und legt nichts an', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1; // test-login legt Nutzer mit id=1 an (alice@example.com)
			await seedPillarsForUser(userId);
			const before = await Pillar.count({ where: { userId } });

			const res = await post('/pillars', { name: 'Neue Säule', description: 'sollte nicht gehen' }, aliceCookie);
			await assertLocked(res, 'POST /pillars');

			assert.equal(await Pillar.count({ where: { userId } }), before, 'es wurde keine Säule angelegt');
			assert.equal(await Pillar.count({ where: { name: 'Neue Säule' } }), 0, 'keine Zeile mit dem Namen existiert');
		});

		it('PATCH /pillars/:id antwortet mit 4xx + Hinweis und ändert nichts', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			await seedPillarsForUser(userId);
			const pillar = (await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] }))[0]!;
			const nameBefore = pillar.name;

			const res = await patch(`/pillars/${pillar.id}`, { name: 'Umbenannt' }, aliceCookie);
			await assertLocked(res, 'PATCH /pillars/:id');

			const reloaded = await Pillar.findByPk(pillar.id);
			assert.equal(reloaded?.name, nameBefore, 'der Name wurde nicht geändert');
			assert.equal(reloaded?.description, pillar.description, 'die Beschreibung wurde nicht geändert');
		});

		it('DELETE /pillars/:id antwortet mit 4xx + Hinweis und entfernt nichts (inkl. Beiträge)', async () => {
			const aliceCookie = await server.login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const victim = pillars[0]!;
			const keep = pillars[1]!;
			const taskRes = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify({
					title: 'Sperr-Task',
					status: 'Open',
					priority: 3,
					estimatedEffort: 1,
					pillars: [
						{ pillarId: victim.id, share: 50, confidence: 100 },
						{ pillarId: keep.id, share: 50, confidence: 100 },
					],
				}),
			});
			assert.equal(taskRes.status, 201);
			const taskId = (await taskRes.json()).id as number;

			const res = await del(`/pillars/${victim.id}`, aliceCookie);
			await assertLocked(res, 'DELETE /pillars/:id');

			assert.equal(await Pillar.count({ where: { id: victim.id } }), 1, 'die Säule existiert weiterhin');
			assert.equal(await TaskPillar.count({ where: { taskId } }), 2, 'beide Beiträge sind unverändert erhalten');
		});

		it('401 ohne Auth bleibt für die gesperrten Endpunkte bestehen', async () => {
			const res = await post('/pillars', { name: 'NoAuth', description: '' });
			assert.equal(res.status, 401, 'ohne Cookie wird weiterhin 401 verlangt (Auth vor Sperre)');
		});
	});
});
