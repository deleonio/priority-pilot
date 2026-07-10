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

/** Legt die fünf gleichgewichteten Standard-Säulen (mit Kurzbeschreibung) an und gibt sie zurück. */
const seedPillars = async (): Promise<Pillar[]> => {
	await Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight })));
	return Pillar.findAll({ order: [['id', 'ASC']] });
};

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

	const get = (path: string) => fetch(`${server.baseUrl}${path}`);
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
	const put = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
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
			const res = await get('/pillars');
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it('200 mit allen Säulen inkl. weight und description, nach id sortiert', async () => {
			const pillars = await seedPillars();
			const res = await get('/pillars');
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
				// Die Kurzbeschreibung ist Pflichtfeld (globale Stammdaten) und wird mitgeliefert.
				assert.ok(typeof pillar.description === 'string' && pillar.description.length > 0);
			}
			// Säulen sind globale Stammdaten: Name↔Beschreibung passen zu den kanonischen Stammdaten.
			assert.deepEqual(
				body.map((p) => p.name),
				SEED_PILLARS.map((p) => p.name),
			);
		});
	});

	// ── PUT /pillars/weights ───────────────────────────────────────────────────

	describe('PUT /pillars/weights', () => {
		it('200 setzt eine gültige Verteilung (Summe 100) und persistiert sie', async () => {
			const pillars = await seedPillars();
			const weights = [
				{ id: pillars[0].id, weight: 40 },
				{ id: pillars[1].id, weight: 30 },
				{ id: pillars[2].id, weight: 10 },
				{ id: pillars[3].id, weight: 10 },
				{ id: pillars[4].id, weight: 10 },
			];
			const res = await put('/pillars/weights', { weights });
			assert.equal(res.status, 200);
			const body = (await res.json()) as { id: number; weight: number }[];
			assert.deepEqual(
				body.map((p) => p.weight),
				[40, 30, 10, 10, 10],
			);
			// Persistiert?
			const reloaded = await Pillar.findByPk(pillars[0].id);
			assert.equal(reloaded?.weight, 40);
		});

		it('200 akzeptiert Float-Verteilung innerhalb der Toleranz (33,33 + 33,33 + 33,34)', async () => {
			await Pillar.bulkCreate([
				{ name: 'A', weight: 50 },
				{ name: 'B', weight: 30 },
				{ name: 'C', weight: 20 },
			]);
			const pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
			const res = await put('/pillars/weights', {
				weights: [
					{ id: pillars[0].id, weight: 33.33 },
					{ id: pillars[1].id, weight: 33.33 },
					{ id: pillars[2].id, weight: 33.34 },
				],
			});
			assert.equal(res.status, 200);
		});

		it('400 wenn die Summe nicht 100 ergibt', async () => {
			const pillars = await seedPillars();
			const res = await put('/pillars/weights', {
				weights: pillars.map((p) => ({ id: p.id, weight: 10 })),
			});
			assert.equal(res.status, 400);
		});

		it('400 wenn ein Gewicht negativ ist', async () => {
			const pillars = await seedPillars();
			const res = await put('/pillars/weights', {
				weights: [
					{ id: pillars[0].id, weight: -10 },
					{ id: pillars[1].id, weight: 40 },
					{ id: pillars[2].id, weight: 30 },
					{ id: pillars[3].id, weight: 20 },
					{ id: pillars[4].id, weight: 20 },
				],
			});
			assert.equal(res.status, 400);
		});

		it('400 wenn nicht alle Säulen abgedeckt sind', async () => {
			const pillars = await seedPillars();
			const res = await put('/pillars/weights', {
				weights: [
					{ id: pillars[0].id, weight: 50 },
					{ id: pillars[1].id, weight: 50 },
				],
			});
			assert.equal(res.status, 400);
		});

		it('400 bei unbekannter Säulen-id', async () => {
			const pillars = await seedPillars();
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			weights[0] = { id: 99999, weight: 20 };
			const res = await put('/pillars/weights', { weights });
			assert.equal(res.status, 400);
		});

		it('400 bei doppelter id', async () => {
			const pillars = await seedPillars();
			const res = await put('/pillars/weights', {
				weights: [
					{ id: pillars[0].id, weight: 20 },
					{ id: pillars[0].id, weight: 20 },
					{ id: pillars[2].id, weight: 20 },
					{ id: pillars[3].id, weight: 20 },
					{ id: pillars[4].id, weight: 20 },
				],
			});
			assert.equal(res.status, 400);
		});

		it('400 wenn weights fehlt oder keine Liste ist', async () => {
			await seedPillars();
			assert.equal((await put('/pillars/weights', {})).status, 400);
			assert.equal((await put('/pillars/weights', { weights: 'nope' })).status, 400);
			assert.equal((await put('/pillars/weights', { weights: [] })).status, 400);
		});

		it('400 wenn weight kein Number ist', async () => {
			const pillars = await seedPillars();
			const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
			(weights[0] as { id: number; weight: unknown }).weight = 'viel';
			const res = await put('/pillars/weights', { weights });
			assert.equal(res.status, 400);
		});

		it('400 wenn Body kein Objekt ist', async () => {
			await seedPillars();
			const res = await fetch(`${server.baseUrl}/pillars/weights`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
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

				// Persistiert und nur für Alice sichtbar?
				const alicePillars = await Pillar.findAll({ where: { name: 'Meditation' } });
				assert.equal(alicePillars.length, 1, 'genau eine Meditation-Säule existiert');
			});

			it('400 bei leerem Namen (AK1)', async () => {
				const aliceCookie = await login('alice@example.com');

				const res = await post('/pillars', { name: '', description: 'Leer' }, aliceCookie);
				assert.equal(res.status, 400, 'leerer Name wird abgewiesen');
			});

			it('400 bei Dublette (name, userId) (AK1)', async () => {
				const aliceCookie = await login('alice@example.com');
				await post('/pillars', { name: 'Meditation', description: 'Erste' }, aliceCookie);

				const res = await post('/pillars', { name: 'Meditation', description: 'Zweite' }, aliceCookie);
				assert.equal(res.status, 400, 'Dublette für denselben Nutzer wird abgewiesen');
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

			it('401 ohne Auth', async () => {
				const res = await patch('/pillars/1', { name: 'NoAuth' });
				assert.equal(res.status, 401);
			});
		});

		// ── DELETE /pillars/:id (AK3) ────────────────────────────────────────────────

		describe('DELETE /pillars/:id', () => {
			it('204 entfernt Säule + Beiträge; renormiert verbleibende share je Task auf 100 (AK3)', async () => {
				const aliceCookie = await login('alice@example.com');
				const userId = 1; // test-login legt Nutzer mit id=1 an (alice@example.com)

				// Zwei Säulen für Alice anlegen
				await seedPillarsForUser(userId);
				const pillars = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const toDelete = pillars[0]!;
				const toKeep = pillars[1]!;

				// Task mit Beiträgen auf beide Säulen (50/50)
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

				// Löschen
				const deleteRes = await del(`/pillars/${toDelete.id}`, aliceCookie);
				assert.equal(deleteRes.status, 204, 'Löschen liefert 204');

				// Säule weg?
				assert.equal(await Pillar.count({ where: { id: toDelete.id } }), 0, 'gelöschte Säule existiert nicht mehr');
				assert.equal(await Pillar.count({ where: { id: toKeep.id } }), 1, 'andere Säule existiert noch');

				// Beiträge der gelöschten Säule weg?
				const deletedContributions = await TaskPillar.findAll({ where: { pillarId: toDelete.id } });
				assert.equal(deletedContributions.length, 0, 'Beiträge der gelöschten Säule sind entfernt');

				// Verbleibende Beiträge renormiert (nur noch toKeep mit share 100)?
				const remaining = await TaskPillar.findAll({ where: { taskId, pillarId: toKeep.id } });
				assert.equal(remaining.length, 1, 'genau ein Beitrag verbleibt');
				assert.equal(remaining[0]!.share, 100, 'verbleibender Beitrag wurde auf 100 renormiert');
			});

			it('204 renormiert Rest-Gewichte der übrigen Säulen auf 100 (AK3)', async () => {
				const aliceCookie = await login('alice@example.com');
				const userId = 1;

				// Drei Säulen: 30, 40, 30 (Summe 100)
				await Pillar.bulkCreate([
					{ name: 'A', weight: 30, userId },
					{ name: 'B', weight: 40, userId },
					{ name: 'C', weight: 30, userId },
				]);
				const pillars = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const toDelete = pillars[1]!; // B mit 40

				// Löschen
				const deleteRes = await del(`/pillars/${toDelete.id}`, aliceCookie);
				assert.equal(deleteRes.status, 204);

				// Rest-Gewichte renormiert: A (30) → 75%, C (30) → 25% (Total 100)
				const remaining = await Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });
				const weights = remaining.map((p) => p.weight).sort((a, b) => a - b);
				assert.deepEqual(weights, [25, 75], 'Rest-Gewichte wurden proportional auf 100 renormiert');
			});

			it('404 bei fremder ID', async () => {
				const aliceCookie = await login('alice@example.com');
				const aliceId = (await (await post('/pillars', { name: 'AliceDelete', description: '' }, aliceCookie)).json())
					.id as number;

				const bobCookie = await login('bob@example.com');
				const res = await del(`/pillars/${aliceId}`, bobCookie);
				assert.equal(res.status, 404, 'Bob darf Alices Säule nicht löschen');
			});

			it('401 ohne Auth', async () => {
				const res = await del('/pillars/1');
				assert.equal(res.status, 401);
			});
		});
	});
});
