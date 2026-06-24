import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTER Spec-Test (#121): Gamification-Scoring über die HTTP-API (Black-Box-Vertrag).
 *
 * Beim Statuswechsel eines Tasks auf `Done` vergibt das Backend einen `ScoreEntry`
 * (`taskId`, `punkte`, `pünktlich`, `zeitpunkt`). `GET /scores` listet die Einträge,
 * `GET /scores/by-pillar` aggregiert die Punkte anteilig (über `share`) pro Säule.
 *
 * Diese Endpunkte/das Modell existieren noch nicht — die Tests sind rot, bis die Umsetzung sie
 * bereitstellt. Bewusst rein über HTTP formuliert, damit der Vertrag implementierungsunabhängig ist.
 */
describe('Scoring API', () => {
	let server: TestServer;

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

	const createTask = async (body: Record<string, unknown>): Promise<number> => {
		const res = await post('/tasks', body);
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	const future = new Date('2026-12-31T00:00:00.000Z').toISOString();
	const past = new Date('2026-01-01T00:00:00.000Z').toISOString();

	it('AK1: Statuswechsel auf Done erzeugt genau einen ScoreEntry (pünktlich bei Deadline in Zukunft)', async () => {
		const id = await createTask({ title: 'Pünktlich', priority: 3, estimatedEffort: 1, deadline: future });

		const res = await patch(`/tasks/${id}`, { status: 'Done' });
		assert.equal(res.status, 200);

		const scoresRes = await get('/scores');
		assert.equal(scoresRes.status, 200);
		const scores = (await scoresRes.json()) as Array<{ taskId: number; punkte: number; pünktlich: boolean }>;
		assert.equal(scores.length, 1, 'genau ein ScoreEntry nach Done');
		assert.equal(scores[0].taskId, id);
		assert.equal(scores[0].pünktlich, true);
		assert.ok(scores[0].punkte > 0, 'volle Punktzahl muss positiv sein');
	});

	it('AK2: überschrittene Deadline ⇒ ScoreEntry pünktlich=false mit reduzierten Punkten', async () => {
		const puenktlichId = await createTask({ title: 'Voll', priority: 3, estimatedEffort: 1, deadline: future });
		await patch(`/tasks/${puenktlichId}`, { status: 'Done' });
		const vollRes = await get('/scores');
		const vollScores = (await vollRes.json()) as Array<{ taskId: number; punkte: number }>;
		const vollePunkte = vollScores[0].punkte;

		await resetDb();
		const spaetId = await createTask({ title: 'Spät', priority: 3, estimatedEffort: 1, deadline: past });
		const res = await patch(`/tasks/${spaetId}`, { status: 'Done' });
		assert.equal(res.status, 200);

		const scoresRes = await get('/scores');
		const scores = (await scoresRes.json()) as Array<{ taskId: number; punkte: number; pünktlich: boolean }>;
		assert.equal(scores.length, 1);
		assert.equal(scores[0].pünktlich, false);
		assert.ok(scores[0].punkte < vollePunkte, 'verspätet muss echt weniger Punkte geben als pünktlich');
		assert.ok(scores[0].punkte >= 0);
	});

	it('AK5: erneuter Statuswechsel auf Done erzeugt keinen doppelten ScoreEntry', async () => {
		const id = await createTask({ title: 'Idempotent', priority: 3, estimatedEffort: 1, deadline: future });

		await patch(`/tasks/${id}`, { status: 'Done' });
		await patch(`/tasks/${id}`, { status: 'Done' });

		const scoresRes = await get('/scores');
		assert.equal(scoresRes.status, 200);
		const scores = (await scoresRes.json()) as unknown[];
		assert.equal(scores.length, 1, 'kein doppelter ScoreEntry bei erneutem Done');
	});

	it('AK4: Punkte verteilen sich anteilig (share) und werden pro Säule aggregiert', async () => {
		const koerper = await Pillar.create({ name: 'Körper', weight: 20 });
		const sinn = await Pillar.create({ name: 'Sinn', weight: 20 });

		const id = await createTask({
			title: 'Mehrsäulig',
			priority: 3,
			estimatedEffort: 1,
			deadline: future,
			pillars: [
				{ pillarId: koerper.id, share: 60 },
				{ pillarId: sinn.id, share: 40 },
			],
		});
		await patch(`/tasks/${id}`, { status: 'Done' });

		// Gesamtpunkte des Tasks aus dem ScoreEntry.
		const scoresRes = await get('/scores');
		const scores = (await scoresRes.json()) as Array<{ taskId: number; punkte: number }>;
		const gesamtPunkte = scores[0].punkte;

		const aggRes = await get('/scores/by-pillar');
		assert.equal(aggRes.status, 200);
		const perPillar = (await aggRes.json()) as Array<{ pillarId: number; punkte: number }>;

		const koerperPunkte = perPillar.find((entry) => entry.pillarId === koerper.id)?.punkte ?? 0;
		const sinnPunkte = perPillar.find((entry) => entry.pillarId === sinn.id)?.punkte ?? 0;

		const EPSILON = 1e-6;
		assert.ok(Math.abs(koerperPunkte - gesamtPunkte * 0.6) < EPSILON, '60 % der Punkte auf Körper');
		assert.ok(Math.abs(sinnPunkte - gesamtPunkte * 0.4) < EPSILON, '40 % der Punkte auf Sinn');
	});
});
