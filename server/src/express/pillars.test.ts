import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

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
	const put = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

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
	});
});
