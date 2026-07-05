import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

// Rote Spec-Tests für #158 — erweiterte API-Verträge der Serienaufgaben.
// Deckt CRUD-Operationen, Validierung, und Fehlerbehandlung ab.
// KEIN Produktivcode — die Tests werden grün, sobald die entsprechenden
// Endpunkte und Validierungen implementiert sind.

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

	const validSeries = () => ({
		title: 'Wöchentlich kochen',
		rhythm: 'weekly',
		priority: 4,
		estimatedEffort: 0.5,
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
			assert.equal(body.priority, 4);
			assert.equal(body.active, true);
		});

		it('400 bei fehlendem Titel', async () => {
			const { title: _omit, ...withoutTitle } = validSeries();
			const res = await post('/series', withoutTitle);
			assert.equal(res.status, 400);
		});

		// AK-2: POST /series ohne startDate → 400
		it('400 bei fehlendem startDate', async () => {
			const { startDate: _omit, ...withoutStartDate } = validSeries();
			const res = await post('/series', withoutStartDate);
			assert.equal(res.status, 400);
		});

		// AK-3: POST /series mit startDate: "kein-datum" → 400
		it('400 bei ungültigem startDate-Format', async () => {
			const invalid = { ...validSeries(), startDate: 'kein-datum' };
			const res = await post('/series', invalid);
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

		// AK-4: GET /series/:id → 200 + korrektes Objekt (existierende Serie)
		it('200 mit korrektem Objekt für existierende Serie', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await get(`/series/${created.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.id, created.id);
			assert.equal(body.title, 'Wöchentlich kochen');
			assert.equal(body.rhythm, 'weekly');
			assert.equal(body.priority, 4);
		});

		// AK-5: GET /series/:id unbekannte ID → 404
		it('404 für unbekannte Serie', async () => {
			const res = await get('/series/9999');
			assert.equal(res.status, 404);
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
			const series = (await (await post('/series', validSeries())).json()) as { id: number; priority: number };
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
			const template = (await (await get(`/series/${series.id}`)).json()) as Record<string, unknown>;
			assert.equal(template.priority, series.priority);
			assert.equal(template.title, 'Wöchentlich kochen');
		});
	});

	// ── AK-6: PATCH /series/:id mit title → 200 + aktualisiertes Objekt
	describe('PATCH /series/:id', () => {
		it('200 mit aktualisiertem Objekt bei Titeländerung', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, {
				title: 'Täglich trainieren',
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.id, created.id);
			assert.equal(body.title, 'Täglich trainieren');
		});

		it('404 für unbekannte Serie', async () => {
			const res = await patch('/series/9999', {
				title: 'Neuer Titel',
			});
			assert.equal(res.status, 404);
		});

		it('400 bei ungültigem rhythm', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, {
				rhythm: 'invalid-rhythm',
			});
			assert.equal(res.status, 400);
		});
	});

	// ── AK-7: DELETE /series/:id → 204; danach GET /series zeigt leere Liste
	describe('DELETE /series/:id', () => {
		it('204 beim Löschen existierender Serie', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await del(`/series/${created.id}`);
			assert.equal(res.status, 204);
		});

		it('leere Liste nach Löschen der einzigen Serie', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await del(`/series/${created.id}`);
			const res = await get('/series');
			assert.equal(res.status, 200);
			const body = (await res.json()) as unknown[];
			assert.equal(body.length, 0);
		});

		// AK-8: DELETE /series/:id unbekannte ID → 404
		it('404 für unbekannte Serie', async () => {
			const res = await del('/series/9999');
			assert.equal(res.status, 404);
		});
	});

	// ── #244: serverseitige Serien-Materialisierung per Sammel-Endpunkt ─────────────────────────
	// POST /series/generate-all generiert die fälligen Instanzen ALLER aktiven Serien und gibt die
	// Anzahl der frisch erzeugten Tasks als { created: N } zurück. KEIN Produktivcode.
	describe('POST /series/generate-all', () => {
		// startDate deutlich in der Vergangenheit → im Fenster [start, now] liegen fällige Termine.
		const dueSeries = () => ({
			title: 'Fällige Wochenserie',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: '2026-01-01T00:00:00.000Z',
		});

		// AK2: erzeugt für die aktive Serie fällige Tasks und liefert { created: N } mit N > 0.
		it('200 mit { created: N > 0 } und materialisierten Tasks', async () => {
			await post('/series', dueSeries());

			const res = await post('/series/generate-all', {});
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(typeof body.created, 'number', 'Body enthält ein numerisches created-Feld');
			assert.ok((body.created as number) > 0, 'es werden fällige Instanzen erzeugt (created > 0)');

			// Die materialisierten Instanzen erscheinen in der regulären Task-Liste.
			const tasks = (await (await get('/tasks')).json()) as unknown[];
			assert.equal(tasks.length, body.created, 'jede erzeugte Instanz taucht als Task auf');
			assert.ok(tasks.length > 0, 'es existieren Tasks nach dem Sammel-Lauf');
		});

		// AK3: inaktive Serien werden übersprungen.
		it('inaktive Serien werden übersprungen (nur aktive erzeugen Tasks)', async () => {
			await post('/series', dueSeries());
			await post('/series', { ...dueSeries(), title: 'Inaktive Serie', active: false });

			const res = await post('/series/generate-all', {});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { created: number };
			assert.ok(body.created > 0, 'die aktive Serie erzeugt fällige Instanzen');

			// Nur die aktive Serie liefert Tasks; die inaktive Serie fügt keine hinzu.
			const tasks = (await (await get('/tasks')).json()) as Array<{ seriesId: number | null }>;
			assert.equal(tasks.length, body.created, 'genau die von der aktiven Serie erzeugten Tasks liegen vor');
			// Alle erzeugten Tasks tragen eine seriesId (stammen aus einer Serie), keiner aus der inaktiven.
			assert.ok(
				tasks.every((task) => typeof task.seriesId === 'number'),
				'alle erzeugten Tasks gehören zu einer Serie',
			);
		});

		// AK5: Idempotenz — der zweite Aufruf erzeugt keine Duplikate.
		it('wiederholtes Aufrufen erzeugt keine Duplikate (created === 0 beim zweiten Lauf)', async () => {
			await post('/series', dueSeries());

			const first = (await (await post('/series/generate-all', {})).json()) as { created: number };
			assert.ok(first.created > 0, 'der erste Lauf erzeugt Instanzen');

			const second = (await (await post('/series/generate-all', {})).json()) as { created: number };
			assert.equal(second.created, 0, 'der zweite Lauf erzeugt keine weiteren Instanzen (Idempotenz)');

			// Die Gesamtzahl der Tasks bleibt stabil (keine Dubletten).
			const tasks = (await (await get('/tasks')).json()) as unknown[];
			assert.equal(tasks.length, first.created, 'die Task-Anzahl bleibt nach dem zweiten Lauf unverändert');
		});
	});

	// ── Rote Spec-Tests für #300 — AK-A1.2: API-Kontrakt mit umbenannten Feldern ────────────────
	//
	// Nach dem Rename (defaultPriority → priority, defaultEstimatedEffort → estimatedEffort) muss
	// die API die neuen Feldnamen in Request-Body und Response verwenden. KEIN Produktivcode —
	// die Tests werden grün, sobald Routes, Modell und OpenAPI-Kontrakt umgestellt sind.
	describe('AK-A1.2 — umbenannte Felder priority / estimatedEffort', () => {
		const validSeriesRenamed = () => ({
			title: 'Täglich lesen',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: '2026-01-01T00:00:00.000Z',
		});

		// POST /series mit neuen Feldnamen → 201, Response enthält priority/estimatedEffort
		it('POST /series mit priority/estimatedEffort → 201 und Response trägt die neuen Feldnamen', async () => {
			const res = await post('/series', validSeriesRenamed());
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(typeof body.id, 'number', 'Response enthält eine numerische id');
			assert.equal(body.priority, 3, 'Response enthält priority mit korrektem Wert');
			assert.equal(body.estimatedEffort, 0.5, 'Response enthält estimatedEffort mit korrektem Wert');
			assert.ok(!('defaultPriority' in body), 'Response enthält KEIN defaultPriority mehr');
			assert.ok(!('defaultEstimatedEffort' in body), 'Response enthält KEIN defaultEstimatedEffort mehr');
		});

		// GET /series/:id → Response enthält priority/estimatedEffort, nicht die alten Namen
		it('GET /series/:id → Response trägt priority/estimatedEffort (kein defaultPriority/defaultEstimatedEffort)', async () => {
			const created = (await (
				await post('/series', { ...validSeriesRenamed(), priority: 5, estimatedEffort: 0.8 })
			).json()) as {
				id: number;
			};
			const res = await get(`/series/${created.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.priority, 5, 'priority wird mit dem gespeicherten Wert zurückgegeben');
			assert.equal(body.estimatedEffort, 0.8, 'estimatedEffort wird mit dem gespeicherten Wert zurückgegeben');
			assert.ok(!('defaultPriority' in body), 'GET-Response enthält KEIN defaultPriority');
			assert.ok(!('defaultEstimatedEffort' in body), 'GET-Response enthält KEIN defaultEstimatedEffort');
		});

		// PATCH /series/:id mit priority → 200 + aktualisiertes Objekt mit priority
		it('PATCH /series/:id mit priority → 200 und aktualisierter priority in Response', async () => {
			const created = (await (await post('/series', validSeriesRenamed())).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, { priority: 2 });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.priority, 2, 'priority wurde auf 2 aktualisiert');
			assert.ok(!('defaultPriority' in body), 'PATCH-Response enthält KEIN defaultPriority');
		});

		// POST /series ohne priority → 400 (Pflichtfeld)
		it('POST /series ohne priority → 400', async () => {
			const { priority: _omit, ...withoutPriority } = validSeriesRenamed();
			const res = await post('/series', withoutPriority);
			assert.equal(res.status, 400);
		});

		// POST /series ohne estimatedEffort → 400 (Pflichtfeld)
		it('POST /series ohne estimatedEffort → 400', async () => {
			const { estimatedEffort: _omit, ...withoutEffort } = validSeriesRenamed();
			const res = await post('/series', withoutEffort);
			assert.equal(res.status, 400);
		});
	});
});
