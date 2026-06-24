import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

// Rote Spec-Tests für #120 — API-Vertrag der Serienaufgaben (Habits).
// Deckt den CRUD-Vertrag des Serien-Templates und die Instanz-Override-Semantik (AK 2) ab.
// KEIN Produktivcode — die Tests werden grün, sobald die `/series`-Endpunkte und die
// `seriesId`/`isException`-Felder am Task existieren.

describe('Series API', () => {
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

	const validSeries = () => ({
		title: 'Wöchentlich kochen',
		rhythm: 'weekly',
		defaultPriority: 4,
		defaultEstimatedEffort: 0.5,
		active: true,
		startDate: '2026-01-01T00:00:00.000Z',
	});

	// ── CRUD-Vertrag des Templates ────────────────────────────────────────────────────────────
	describe('POST /series', () => {
		it('201 und Template-Objekt bei gültigem Body', async () => {
			const res = await post('/series', validSeries());
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(typeof body.id, 'number');
			assert.equal(body.title, 'Wöchentlich kochen');
			assert.equal(body.rhythm, 'weekly');
			assert.equal(body.defaultPriority, 4);
			assert.equal(body.active, true);
		});

		it('400 bei fehlendem Titel', async () => {
			const { title: _omit, ...withoutTitle } = validSeries();
			const res = await post('/series', withoutTitle);
			assert.equal(res.status, 400);
		});
	});

	describe('GET /series', () => {
		it('200 mit leerer Liste', async () => {
			const res = await get('/series');
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it('200 mit erstelltem Template', async () => {
			await post('/series', validSeries());
			const res = await get('/series');
			assert.equal(res.status, 200);
			const body = (await res.json()) as unknown[];
			assert.equal(body.length, 1);
		});
	});

	// ── AK 1: Generierung erzeugt eigenständige Task-Instanzen mit seriesId ─────────────────────
	describe('POST /series/:id/generate', () => {
		it('materialisiert Instanzen als Tasks mit seriesId', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await post(`/series/${created.id}/generate`, {
				until: '2026-01-20T00:00:00.000Z',
			});
			assert.equal(res.status, 201);
			const instances = (await res.json()) as Array<Record<string, unknown>>;
			assert.equal(instances.length, 3);
			for (const inst of instances) {
				assert.equal(inst.seriesId, created.id);
				assert.equal(inst.isException, false);
				assert.ok(inst.deadline);
			}

			// Die Instanzen erscheinen auch in der regulären Task-Liste.
			const tasks = (await (await get('/tasks')).json()) as unknown[];
			assert.equal(tasks.length, 3);
		});
	});

	// ── AK 2: Instanz-Änderung setzt isException; Template bleibt unverändert ───────────────────
	describe('PATCH einer generierten Instanz', () => {
		it('Statusänderung an Instanz setzt isException, ohne das Template zu berühren', async () => {
			const series = (await (await post('/series', validSeries())).json()) as {
				id: number;
				defaultPriority: number;
			};
			const instances = (await (
				await post(`/series/${series.id}/generate`, { until: '2026-01-20T00:00:00.000Z' })
			).json()) as Array<{ id: number }>;
			const target = instances[0];

			const res = await patch(`/tasks/${target.id}`, {
				status: 'Done',
				deadline: '2026-03-01T00:00:00.000Z',
			});
			assert.equal(res.status, 200);
			const updated = (await res.json()) as Record<string, unknown>;
			assert.equal(updated.status, 'Done');
			assert.equal(updated.isException, true, 'geänderte Instanz ist eine Ausnahme');
			assert.equal(updated.seriesId, series.id);

			// Das Template bleibt unverändert.
			const template = (await (await get(`/series/${series.id}`)).json()) as Record<
				string,
				unknown
			>;
			assert.equal(template.defaultPriority, series.defaultPriority);
			assert.equal(template.title, 'Wöchentlich kochen');
		});
	});
});
