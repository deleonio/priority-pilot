import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, TaskPillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Auth-Env für Nutzer-Scoping (Teil 2, #428). Per test-login mit allowlist.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
process.env.SESSION_SECRET = 'pillars-test-secret';
process.env.GOOGLE_CLIENT_ID = 'pillars-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'pillars-test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

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
	const login = async (email: string): Promise<string> => {
		const res = await fetch(`${server.baseUrl}/auth/test-login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, displayName: email.split('@')[0] }),
		});
		assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie, 'Test-Login sollte Set-Cookie setzen');
		return setCookie!.split(';')[0];
	};

	/** Legt die fünf Standard-Säulen für einen Nutzer an (userId-scoped). */
	const seedPillarsForUser = async (userId: number): Promise<Pillar[]> =>
		Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight, userId })));

	// ── GET /pillars ─────────────────────────────────────────────────────────

	describe('GET /pillars', () => {
		it('200 mit leerer Liste ohne Säulen', async () => {
			const aliceCookie = await login('alice@example.com');
			const res = await get('/pillars', aliceCookie);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it('200 mit allen Säulen inkl. weight und description, nach id sortiert', async () => {
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			weights[0] = { id: 99999, weight: 20 };
			const res = await put('/pillars/weights', { weights }, aliceCookie);
			assert.equal(res.status, 400);
		});

		it('400 bei fremder (nicht zu Nutzer gehörender) Säulen-id', async () => {
			const bobCookie = await login('bob@example.com');

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
			const aliceCookie = await login('alice@example.com');
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
			const aliceCookie = await login('alice@example.com');
			const userId = 1;
			await seedPillarsForUser(userId);
			assert.equal((await put('/pillars/weights', {}, aliceCookie)).status, 400);
			assert.equal((await put('/pillars/weights', { weights: 'nope' }, aliceCookie)).status, 400);
			assert.equal((await put('/pillars/weights', { weights: [] }, aliceCookie)).status, 400);
		});

		it('400 wenn weight kein Number ist', async () => {
			const aliceCookie = await login('alice@example.com');
			const userId = 1;
			const pillars = await seedPillarsForUser(userId);
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			(weights[0] as { id: number; weight: unknown }).weight = 'viel';
			const res = await put('/pillars/weights', { weights }, aliceCookie);
			assert.equal(res.status, 400);
		});

		it('400 wenn Body kein Objekt ist', async () => {
			const aliceCookie = await login('alice@example.com');
			const userId = 1;
			await seedPillarsForUser(userId);
			const res = await fetch(`${server.baseUrl}/pillars/weights`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify(null),
			});
			assert.equal(res.status, 400);
		});

		// ── POST /pillars (AK1) ─────────────────────────────────────────────────────

		describe('POST /pillars', () => {
			it('201 legt Säule mit name+description, weight=0 beim Nutzer an (AK1)', async () => {
				const aliceCookie = await login('alice@example.com');

				const res = await post('/pillars', { name: 'Meditation', description: 'Innere Ruhe' }, aliceCookie);
				assert.equal(res.status, 201, 'Säule wird angelegt');

				const created = (await res.json()) as { id: number; name: string; description: string; weight: number };
				assert.equal(created.name, 'Meditation');
				assert.equal(created.description, 'Innere Ruhe');
				assert.equal(created.weight, 0, 'neue Säule startet mit Gewicht 0');

				const alicePillars = await Pillar.findAll({ where: { name: 'Meditation' } });
				assert.equal(alicePillars.length, 1, 'genau eine Meditation-Säule existiert');
			});

			it('400 bei leerem Namen (AK1)', async () => {
				const aliceCookie = await login('alice@example.com');

				const res = await post('/pillars', { name: '', description: 'Leer' }, aliceCookie);
				assert.equal(res.status, 400, 'leerer Name wird abgewiesen');
			});

			it('409 bei Dublette (name, userId) (AK2)', async () => {
				const aliceCookie = await login('alice@example.com');
				await post('/pillars', { name: 'Meditation', description: 'Erste' }, aliceCookie);

				const res = await post('/pillars', { name: 'Meditation', description: 'Zweite' }, aliceCookie);
				assert.equal(res.status, 409, 'Dublette für denselben Nutzer wird mit 409 abgewiesen (AK2)');
			});

			it('401 ohne Auth (nicht eingeloggt)', async () => {
				const res = await post('/pillars', { name: 'NoAuth', description: 'Sollte nicht gehen' });
				assert.equal(res.status, 401, 'ohne Cookie wird 401 verlangt');
			});
		});

		// ── PATCH /pillars/:id (AK2) ────────────────────────────────────────────────

		describe('PATCH /pillars/:id', () => {
			it('200 benennt um und ändert Beschreibung nur beim Besitzer (AK2)', async () => {
				const aliceCookie = await login('alice@example.com');
				const aliceId = (await (await post('/pillars', { name: 'Sport', description: 'Bewegung' }, aliceCookie)).json())
					.id as number;

				const res = await patch(`/pillars/${aliceId}`, { name: 'Fitness', description: 'Workouts' }, aliceCookie);
				assert.equal(res.status, 200, 'Umbenennung funktioniert');

				const updated = (await res.json()) as { name: string; description: string };
				assert.equal(updated.name, 'Fitness');
				assert.equal(updated.description, 'Workouts');
			});

			it('404 bei fremder ID (AK2)', async () => {
				const aliceCookie = await login('alice@example.com');
				const aliceId = (await (await post('/pillars', { name: 'AlicePillar', description: '' }, aliceCookie)).json())
					.id as number;

				const bobCookie = await login('bob@example.com');
				const res = await patch(`/pillars/${aliceId}`, { name: 'Geklaut', description: '' }, bobCookie);
				assert.equal(res.status, 404, 'Bob darf Alices Säule nicht sehen/ändern');
			});

			it('400 bei leerem Namen', async () => {
				const aliceCookie = await login('alice@example.com');
				const aliceId = (await (await post('/pillars', { name: 'Kultur', description: '' }, aliceCookie)).json())
					.id as number;

				const res = await patch(`/pillars/${aliceId}`, { name: '' }, aliceCookie);
				assert.equal(res.status, 400, 'leerer Name wird abgewiesen');
			});

			it('409 bei Umbenennung auf bereits vergebenen Namen (AK2)', async () => {
				const aliceCookie = await login('alice@example.com');

				await post('/pillars', { name: 'Sport', description: 'Erste' }, aliceCookie);
				await post('/pillars', { name: 'Büro', description: 'Zweite' }, aliceCookie);

				// 'Büro' auf 'Sport' umbenennen → 409 (Name bereits vergeben)
				const bisRes = await Pillar.findAll({ where: { name: 'Büro' } });
				const bueroId = bisRes[0]!.id;
				const res = await patch(`/pillars/${bueroId}`, { name: 'Sport' }, aliceCookie);
				assert.equal(res.status, 409, 'Umbenennung auf bereits existierenden Namen wird mit 409 abgewiesen (AK2)');
			});

			it('200 bei Umbenennung auf denselben Namen (idempotent, kein Konflikt)', async () => {
				const aliceCookie = await login('alice@example.com');
				const created = (await (await post('/pillars', { name: 'Yoga', description: '' }, aliceCookie)).json()) as {
					id: number;
				};

				// Gleicher Name → kein Konflikt (es ist dieselbe Säule)
				const res = await patch(`/pillars/${created.id}`, { name: 'Yoga' }, aliceCookie);
				assert.equal(res.status, 200, 'Umbenennung auf denselben Namen ist idempotent');
			});

			it('401 ohne Auth', async () => {
				const res = await patch('/pillars/1', { name: 'NoAuth' });
				assert.equal(res.status, 401);
			});
		});

		// ── DELETE /pillars/:id (AK3) ────────────────────────────────────────────────

		describe('DELETE /pillars/:id', () => {
			it('204 entfernt Säule + Beiträge; renormiert verbleibende share je Task auf 100 (AK3)', async () => {
				const aliceCookie = await login('alice@example.com');
				const userId = 1;

				await seedPillarsForUser(userId);
				const pillars = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const toDelete = pillars[0]!;
				const toKeep = pillars[1]!;

				const taskRes = await fetch(`${server.baseUrl}/tasks`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
					body: JSON.stringify({
						title: 'Test-Task',
						status: 'Open',
						priority: 3,
						estimatedEffort: 1,
						pillars: [
							{ pillarId: toDelete.id, share: 50, confidence: 100 },
							{ pillarId: toKeep.id, share: 50, confidence: 100 },
						],
					}),
				});
				assert.equal(taskRes.status, 201);
				const taskId = (await taskRes.json()).id as number;

				const deleteRes = await del(`/pillars/${toDelete.id}`, aliceCookie);
				assert.equal(deleteRes.status, 204, 'Löschen liefert 204');

				assert.equal(await Pillar.count({ where: { id: toDelete.id } }), 0, 'gelöschte Säule existiert nicht mehr');
				assert.equal(await Pillar.count({ where: { id: toKeep.id } }), 1, 'andere Säule existiert noch');

				const deletedContributions = await TaskPillar.findAll({ where: { pillarId: toDelete.id } });
				assert.equal(deletedContributions.length, 0, 'Beiträge der gelöschten Säule sind entfernt');

				const remaining = await TaskPillar.findAll({ where: { taskId, pillarId: toKeep.id } });
				assert.equal(remaining.length, 1, 'genau ein Beitrag verbleibt');
				assert.equal(remaining[0]!.share, 100, 'verbleibender Beitrag wurde auf 100 renormiert');
			});

			it('204 renormiert Rest-Gewichte der übrigen Säulen auf 100 (AK3)', async () => {
				const aliceCookie = await login('alice@example.com');
				const userId = 1;

				await Pillar.bulkCreate([
					{ name: 'A', weight: 30, userId },
					{ name: 'B', weight: 40, userId },
					{ name: 'C', weight: 30, userId },
				]);
				const pillars = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const toDelete = pillars[1]!;

				const deleteRes = await del(`/pillars/${toDelete.id}`, aliceCookie);
				assert.equal(deleteRes.status, 204);

				const remaining = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const weights = remaining.map((p) => p.weight).sort((a, b) => a - b);
				assert.deepEqual(weights, [50, 50], 'Rest-Gewichte wurden proportional auf 100 renormiert (30+30→60, je 50%)');
			});

			it('404 bei fremder ID', async () => {
				const aliceCookie = await login('alice@example.com');
				const aliceId = (await (await post('/pillars', { name: 'AliceDelete', description: '' }, aliceCookie)).json())
					.id as number;

				const bobCookie = await login('bob@example.com');
				const res = await del(`/pillars/${aliceId}`, bobCookie);
				assert.equal(res.status, 404, 'Bob darf Alices Säule nicht löschen');
			});

			it('204 ermöglicht Löschen der letzten Säule (Task wird neutral)', async () => {
				const aliceCookie = await login('alice@example.com');

				// Nur eine Säule anlegen
				const created = (await (await post('/pillars', { name: 'Einzige', description: '' }, aliceCookie)).json()) as {
					id: number;
				};
				const taskRes = await fetch(`${server.baseUrl}/tasks`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
					body: JSON.stringify({
						title: 'Task mit einziger Säule',
						status: 'Open',
						priority: 3,
						estimatedEffort: 1,
						pillars: [{ pillarId: created.id, share: 100, confidence: 100 }],
					}),
				});
				assert.equal(taskRes.status, 201);
				const taskId = (await taskRes.json()).id as number;

				// Letzte Säule löschen
				const deleteRes = await del(`/pillars/${created.id}`, aliceCookie);
				assert.equal(deleteRes.status, 204, 'letzte Säule kann gelöscht werden');

				// Task hat keine Beiträge mehr → neutral
				const { TaskPillar } = await import('../models/index.js');
				const contributions = await TaskPillar.findAll({ where: { taskId } });
				assert.equal(contributions.length, 0, 'Task hat nach Löschen der letzten Säule keine Beiträge mehr');
			});

			it('401 ohne Auth', async () => {
				const res = await del('/pillars/1');
				assert.equal(res.status, 401);
			});
		});
	});
});
