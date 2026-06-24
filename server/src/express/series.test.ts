import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Series } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

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
	const del = (path: string) => fetch(`${server.baseUrl}${path}`, { method: 'DELETE' });

	const validTemplate = {
		frequency: 'WEEKLY',
		interval: 1,
		startDate: '2026-06-01',
		defaultPriority: 3,
		active: true,
	};

	// ── Series-CRUD-Vertrag ───────────────────────────────────────────────────

	describe('POST /series', () => {
		it('201 und Series-Objekt bei gültigem Body', async () => {
			const res = await post('/series', validTemplate);
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(typeof body.id, 'number');
			assert.equal(body.frequency, 'WEEKLY');
			assert.equal(body.interval, 1);
			assert.equal(body.defaultPriority, 3);
			assert.equal(body.active, true);
		});

		it('serializeSeries liefert alle Pflichtfelder', async () => {
			const res = await post('/series', validTemplate);
			const body = (await res.json()) as Record<string, unknown>;
			for (const field of ['id', 'frequency', 'interval', 'byWeekday', 'startDate', 'defaultPriority', 'active']) {
				assert.ok(field in body, `Fehlendes Feld: ${field}`);
			}
		});

		it('400 wenn frequency fehlt', async () => {
			const res = await post('/series', { interval: 1, startDate: '2026-06-01', defaultPriority: 3, active: true });
			assert.equal(res.status, 400);
		});

		it('400 wenn frequency ungültig', async () => {
			const res = await post('/series', { ...validTemplate, frequency: 'YEARLY' });
			assert.equal(res.status, 400);
		});

		it('400 wenn interval < 1', async () => {
			const res = await post('/series', { ...validTemplate, interval: 0 });
			assert.equal(res.status, 400);
		});

		it('400 wenn startDate ungültig', async () => {
			const res = await post('/series', { ...validTemplate, startDate: 'not-a-date' });
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
			await Series.create(validTemplate);
			const res = await get('/series');
			assert.equal(res.status, 200);
			const body = (await res.json()) as unknown[];
			assert.equal(body.length, 1);
		});
	});

	describe('GET /series/:id', () => {
		it('200 mit korrektem Template', async () => {
			const series = await Series.create(validTemplate);
			const res = await get(`/series/${series.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.id, series.id);
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await get('/series/99999');
			assert.equal(res.status, 404);
		});
	});

	describe('PATCH /series/:id', () => {
		it('200 und aktualisiertes Template', async () => {
			const series = await Series.create(validTemplate);
			const res = await patch(`/series/${series.id}`, { defaultPriority: 5, active: false });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.defaultPriority, 5);
			assert.equal(body.active, false);
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await patch('/series/99999', { active: false });
			assert.equal(res.status, 404);
		});
	});

	describe('DELETE /series/:id', () => {
		it('204 bei erfolgreichem Löschen', async () => {
			const series = await Series.create(validTemplate);
			const res = await del(`/series/${series.id}`);
			assert.equal(res.status, 204);
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await del('/series/99999');
			assert.equal(res.status, 404);
		});
	});

	// ── POST /series/:id/generate ─────────────────────────────────────────────

	describe('POST /series/:id/generate', () => {
		// Tägliche Serie mit Anker in der Vergangenheit ⇒ im 14-Tage-Horizont sind unabhängig
		// vom realen „now" fällige Termine vorhanden.
		const dailyTemplate = {
			frequency: 'DAILY',
			interval: 1,
			startDate: '2020-01-01',
			defaultPriority: 2,
			active: true,
		};

		it('erzeugt fällige Instanzen mit seriesId-Verknüpfung', async () => {
			const series = await Series.create(dailyTemplate);
			const res = await post(`/series/${series.id}/generate`, {});
			assert.ok(res.status === 200 || res.status === 201, `unerwarteter Status ${res.status}`);
			const instanzen = await Task.findAll({ where: { seriesId: series.id } });
			assert.ok(instanzen.length > 0, 'es müssen fällige Instanzen entstehen');
		});

		it('ist idempotent: zweiter Aufruf erzeugt keine Dubletten', async () => {
			const series = await Series.create(dailyTemplate);
			await post(`/series/${series.id}/generate`, {});
			const ersteAnzahl = (await Task.findAll({ where: { seriesId: series.id } })).length;
			await post(`/series/${series.id}/generate`, {});
			const zweiteAnzahl = (await Task.findAll({ where: { seriesId: series.id } })).length;
			assert.equal(zweiteAnzahl, ersteAnzahl);
		});

		it('404 wenn Series nicht existiert', async () => {
			const res = await post('/series/99999/generate', {});
			assert.equal(res.status, 404);
		});
	});

	// ── AC2: Instanz-Override (isException) ────────────────────────────────────

	describe('Instanz-Override (AC2)', () => {
		// Legt eine bereits materialisierte Serien-Instanz an (wie sie generateDueInstances erzeugt).
		const seedInstance = async () => {
			const series = await Series.create(validTemplate);
			const instanz = await Task.create({
				title: 'Wöchentliche Aufgabe',
				priority: 3,
				estimatedEffort: 0.5,
				seriesId: series.id,
				seriesOccurrence: '2026-06-29',
				deadline: '2026-06-29T00:00:00.000Z',
			});
			return { series, instanz };
		};

		it('serializeTask einer Instanz liefert seriesId, isException und seriesOccurrence', async () => {
			const { instanz } = await seedInstance();
			const res = await get(`/tasks/${instanz.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			for (const field of ['seriesId', 'isException', 'seriesOccurrence']) {
				assert.ok(field in body, `Fehlendes Feld: ${field}`);
			}
		});

		it('Status/Deadline-Änderung markiert die Instanz als isException und lässt seriesOccurrence unverändert', async () => {
			const { instanz } = await seedInstance();
			const res = await patch(`/tasks/${instanz.id}`, {
				status: 'Done',
				deadline: '2026-07-01T00:00:00.000Z',
			});
			assert.equal(res.status, 200);

			const reloaded = await Task.findByPk(instanz.id);
			assert.equal(reloaded?.status, 'Done');
			assert.equal(reloaded?.isException, true, 'geänderte Instanz muss isException=true sein');
			// Der Idempotenz-Anker darf sich durch die Verschiebung NICHT ändern.
			assert.equal(
				new Date(reloaded!.seriesOccurrence as Date).toISOString().slice(0, 10),
				'2026-06-29',
				'seriesOccurrence darf sich bei Override nicht ändern',
			);
		});

		it('Instanz-Override lässt die Template-Zeile unverändert', async () => {
			const { series, instanz } = await seedInstance();
			await patch(`/tasks/${instanz.id}`, { status: 'Done', deadline: '2026-07-01T00:00:00.000Z' });

			const template = await Series.findByPk(series.id);
			assert.equal(template?.defaultPriority, 3);
			assert.equal(template?.active, true);
			assert.equal(template?.frequency, 'WEEKLY');
		});
	});
});
