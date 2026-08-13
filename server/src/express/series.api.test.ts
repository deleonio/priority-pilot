import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Pillar } from '../models/index.js';

let server: TestServer;

// Rote Spec-Tests für #158 — erweiterte API-Verträge der Serienaufgaben.
// Deckt CRUD-Operationen, Validierung, und Fehlerbehandlung ab.
// KEIN Produktivcode — die Tests werden grün, sobald die entsprechenden
// Endpunkte und Validierungen implementiert sind.

// Hilfsfunktion: Erstellt ein Datum, das `offsetDays` Tage in der Zukunft liegt (UTC).
const futureDate = (offsetDays: number): string => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offsetDays);
	result.setUTCHours(0, 0, 0, 0);
	return result.toISOString().replace(/\.\d{3}Z$/, '.000Z');
};

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
		startDate: futureDate(1),
	});

	// 🔴🔴 CRUD-Vertrag des Templates 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
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

		// Wochentag-Konsistenz (#469): rhythm "mon"…"sun" erfordert ein startDate auf dem
		// benannten Wochentag — sonst läge der Anker (und damit alle Termine) auf dem falschen Tag.
		it('400 bei rhythm "wed" mit startDate an einem anderen Wochentag', async () => {
			// Ein Datum finden, das garantiert NICHT Mittwoch ist (0=So … 6=Sa).
			const wrong = new Date();
			wrong.setUTCDate(wrong.getUTCDate() + 1);
			wrong.setUTCHours(0, 0, 0, 0);
			if (wrong.getUTCDay() === 3) {
				wrong.setUTCDate(wrong.getUTCDate() + 1);
			}
			const res = await post('/series', {
				...validSeries(),
				rhythm: 'wed',
				startDate: wrong.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
			});
			assert.equal(res.status, 400);
		});

		it('201 bei rhythm "wed" mit startDate an einem Mittwoch', async () => {
			// Nächsten Mittwoch ab morgen finden (0=So … 6=Sa, Mi=3).
			const wed = new Date();
			wed.setUTCDate(wed.getUTCDate() + 1);
			wed.setUTCHours(0, 0, 0, 0);
			while (wed.getUTCDay() !== 3) {
				wed.setUTCDate(wed.getUTCDate() + 1);
			}
			const res = await post('/series', {
				...validSeries(),
				rhythm: 'wed',
				startDate: wed.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
			});
			assert.equal(res.status, 201);
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
	});

	// 🔴🔴 AK 1: Generierung erzeugt eigenständige Task-Instanzen mit seriesId 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	describe('POST /series/:id/generate', () => {
		it('materialisiert Instanzen als Tasks mit seriesId', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await post(`/series/${created.id}/generate`, {
				until: futureDate(20),
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

	// 🔴🔴 AK 2: Instanz-Änderung setzt isException; Template bleibt unverändert 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	describe('PATCH einer generierten Instanz', () => {
		it('Statusänderung an Instanz setzt isException, ohne das Template zu berühren', async () => {
			const series = (await (await post('/series', validSeries())).json()) as { id: number; priority: number };
			const instances = (await (
				await post(`/series/${series.id}/generate`, { until: futureDate(20) })
			).json()) as Array<{ id: number }>;
			const target = instances[0];

			const res = await patch(`/tasks/${target.id}`, {
				status: 'Done',
				deadline: futureDate(60),
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

	// 🔴🔴 AK-6: PATCH /series/:id mit title → 200 + aktualisiertes Objekt
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

		it('400 bei ungültigem rhythm', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, {
				rhythm: 'invalid-rhythm',
			});
			assert.equal(res.status, 400);
		});

		// Wochentag-Konsistenz (#469): rhythm+startDate gemeinsam in einem PATCH müssen
		// zusammenpassen (Anker liegt sonst auf dem falschen Tag).
		it('400 bei PATCH rhythm "wed" + startDate an anderem Wochentag', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const wrong = new Date();
			wrong.setUTCDate(wrong.getUTCDate() + 1);
			wrong.setUTCHours(0, 0, 0, 0);
			if (wrong.getUTCDay() === 3) {
				wrong.setUTCDate(wrong.getUTCDate() + 1);
			}
			const res = await patch(`/series/${created.id}`, {
				rhythm: 'wed',
				startDate: wrong.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
			});
			assert.equal(res.status, 400);
		});

		// Wochentag-Konsistenz bei Teil-PATCH (Review Runde 2): wird nur einer der beiden
		// Werte gesendet, muss der bestehende DB-Wert des jeweils anderen zum Abgleich dienen —
		// sonst ließe sich eine inkonsistente Kombination (rhythm≠startDate-Wochentag) durch
		// einen Teil-PATCH einschleusen, und `nextOccurrence` (+7 Tage) legte alle Termine
		// stillschweigend auf den falschen Wochentag.
		it('400 bei PATCH nur rhythm "wed" auf Serie mit startDate an anderem Wochentag', async () => {
			// Serie mit startDate an einem garantiert nicht-mittwochschen Wochentag anlegen.
			const nonWed = new Date();
			nonWed.setUTCDate(nonWed.getUTCDate() + 1);
			nonWed.setUTCHours(0, 0, 0, 0);
			while (nonWed.getUTCDay() === 3) {
				nonWed.setUTCDate(nonWed.getUTCDate() + 1);
			}
			const created = (await (
				await post('/series', {
					...validSeries(),
					startDate: nonWed.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
				})
			).json()) as { id: number };
			// Nur rhythm senden — startDate kommt aus der DB (nicht-Mittwoch) → muss 400 sein.
			const res = await patch(`/series/${created.id}`, { rhythm: 'wed' });
			assert.equal(res.status, 400);
		});

		it('400 bei PATCH nur startDate an anderem Wochentag auf mon-Rhythmus-Serie', async () => {
			// Serie mit rhythm "mon" und startDate an einem Montag anlegen (valide).
			const mon = new Date();
			mon.setUTCDate(mon.getUTCDate() + 1);
			mon.setUTCHours(0, 0, 0, 0);
			while (mon.getUTCDay() !== 1) {
				mon.setUTCDate(mon.getUTCDate() + 1);
			}
			const created = (await (
				await post('/series', {
					...validSeries(),
					rhythm: 'mon',
					startDate: mon.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
				})
			).json()) as { id: number };
			// Nur startDate auf einen garantiert nicht-montagischen Tag senden → muss 400 sein.
			const nonMon = new Date();
			nonMon.setUTCDate(nonMon.getUTCDate() + 7);
			nonMon.setUTCHours(0, 0, 0, 0);
			while (nonMon.getUTCDay() === 1) {
				nonMon.setUTCDate(nonMon.getUTCDate() + 1);
			}
			const res = await patch(`/series/${created.id}`, {
				startDate: nonMon.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
			});
			assert.equal(res.status, 400);
		});
	});

	// 🔴🔴 AK-7: DELETE /series/:id → 204; danach GET /series zeigt leere Liste
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
	});

	// 🔴🔴 Rote Spec-Tests für #301 — AK-A2.1: description im API-Vertrag 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	//
	// description ist optional (nullable): POST ohne description → null; ungültiger Typ → 400.
	// PATCH kann description setzen und auf null zurücksetzen.
	// KEIN Produktivcode — die Tests werden grün, sobald Modell, Route und serializeSeries
	// das Feld unterstützen.
	describe('AK-A2.1 — description im API-Vertrag', () => {
		it('POST /series mit description → 201 und Response trägt description', async () => {
			const res = await post('/series', { ...validSeries(), description: 'Notiz zur Serie' });
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.description, 'Notiz zur Serie', 'description wird persistiert und zurückgegeben');
		});

		it('POST /series ohne description → 201 und description === null', async () => {
			const res = await post('/series', validSeries());
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.description, null, 'description ist ohne Angabe null (optional/nullable)');
		});

		it('PATCH /series/:id mit description → 200 und Response trägt neue description', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, { description: 'geänderte Beschreibung' });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.description, 'geänderte Beschreibung', 'description wurde aktualisiert');
		});

		it('PATCH /series/:id mit description: null → 200 und description === null (löschbar)', async () => {
			const created = (await (
				await post('/series', { ...validSeries(), description: 'vorherige Beschreibung' })
			).json()) as { id: number };
			const res = await patch(`/series/${created.id}`, { description: null });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.description, null, 'description kann auf null gesetzt werden');
		});

		it('GET /series/:id → Response enthält das description-Feld', async () => {
			const created = (await (await post('/series', { ...validSeries(), description: 'GET-Verifikation' })).json()) as {
				id: number;
			};
			const res = await get(`/series/${created.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok('description' in body, 'Response enthält das description-Feld');
			assert.equal(body.description, 'GET-Verifikation', 'serializeSeries liefert description zurück');
		});

		it('POST /series mit description: 123 (falscher Typ) → 400', async () => {
			const res = await post('/series', { ...validSeries(), description: 123 });
			assert.equal(res.status, 400, 'ungültiger Typ für description → 400');
		});
	});

	// 🔴🔴 #244: serverseitige Serien-Materialisierung per Sammel-Endpunkt 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
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
			startDate: futureDate(1),
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

	// 🔴🔴 Rote Spec-Tests für #300 — AK-A1.2: API-Kontrakt mit umbenannten Feldern 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
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
			startDate: futureDate(1),
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

	// 🔴🔴 Rote Spec-Tests für #302 — AK1: series_pillars-Vorlage 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	//
	// Serien tragen eine Pillar-Vorlage (Beiträge {pillarId, share, confidence}). Sie wird in
	// series_pillars persistiert, in POST/PATCH validiert (Summe share = 100, keine Duplikate,
	// bekannte + ganzzahlige pillarId) und in POST/PATCH/GET-Responses als nach pillarId
	// sortiertes pillars-Array zurückgegeben. Fehlt pillars, gilt Rückwärtskompatibilität
	// (pillars: []). Die Vorlage teilt sich die Validierung mit den Task-Beiträgen (#294 A3).
	// KEIN Produktivcode — die Tests werden grün, sobald Modell, Route und Serialisierung das Feld
	// unterstützen.
	describe('AK1/#302 — series_pillars: Pillar-Vorlage in Series', () => {
		const seedTwoPillars = async (): Promise<[number, number]> => {
			const koerper = await Pillar.create({ name: 'Körper', weight: 20 });
			const sinn = await Pillar.create({ name: 'Sinn', weight: 20 });
			return [koerper.id, sinn.id];
		};

		it('POST /series mit gültigen pillars → 201, persistiert und nach pillarId sortiert', async () => {
			const [koerper, sinn] = await seedTwoPillars();
			const res = await post('/series', {
				...validSeries(),
				pillars: [
					// bewusst unsortiert übergeben, um die Sortierung nach pillarId zu prüfen
					{ pillarId: sinn, share: 40 },
					{ pillarId: koerper, share: 60, confidence: 80 },
				],
			});
			assert.equal(res.status, 201);
			const body = (await res.json()) as {
				id: number;
				pillars: { pillarId: number; share: number; confidence: number }[];
			};
			// Response enthält die Beiträge, nach pillarId sortiert; confidence defaultet auf 100.
			assert.deepEqual(body.pillars, [
				{ pillarId: koerper, share: 60, confidence: 80 },
				{ pillarId: sinn, share: 40, confidence: 100 },
			]);

			// Die Beiträge sind persistiert und werden per GET erneut geliefert.
			const fetched = (await (await get(`/series/${body.id}`)).json()) as {
				pillars: { pillarId: number; share: number; confidence: number }[];
			};
			assert.deepEqual(fetched.pillars, [
				{ pillarId: koerper, share: 60, confidence: 80 },
				{ pillarId: sinn, share: 40, confidence: 100 },
			]);
		});

		it('POST /series ohne pillars → 201 mit pillars: [] (Rückwärtskompatibilität)', async () => {
			const res = await post('/series', validSeries());
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.deepEqual(body.pillars, [], 'ohne Angabe ist pillars ein leeres Array');
		});

		it('POST /series mit Summe share ≠ 100 → 400', async () => {
			const [koerper, sinn] = await seedTwoPillars();
			const res = await post('/series', {
				...validSeries(),
				pillars: [
					{ pillarId: koerper, share: 30 },
					{ pillarId: sinn, share: 30 },
				],
			});
			assert.equal(res.status, 400);
		});

		it('POST /series mit unbekannter pillarId → 400', async () => {
			await seedTwoPillars();
			const res = await post('/series', {
				...validSeries(),
				pillars: [{ pillarId: 99999, share: 100 }],
			});
			assert.equal(res.status, 400);
		});

		it('POST /series mit doppelter pillarId → 400', async () => {
			const [koerper] = await seedTwoPillars();
			const res = await post('/series', {
				...validSeries(),
				pillars: [
					{ pillarId: koerper, share: 50 },
					{ pillarId: koerper, share: 50 },
				],
			});
			assert.equal(res.status, 400);
		});

		it('POST /series mit nicht-ganzzahliger pillarId (1.5) → 400', async () => {
			await seedTwoPillars();
			const res = await post('/series', {
				...validSeries(),
				pillars: [{ pillarId: 1.5, share: 100 }],
			});
			assert.equal(res.status, 400);
		});

		it('GET /series/:id → Response enthält pillars-Array', async () => {
			const [koerper] = await seedTwoPillars();
			const created = (await (
				await post('/series', { ...validSeries(), pillars: [{ pillarId: koerper, share: 100 }] })
			).json()) as { id: number };
			const res = await get(`/series/${created.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok('pillars' in body, 'Response enthält das pillars-Feld');
			assert.deepEqual(body.pillars, [{ pillarId: koerper, share: 100, confidence: 100 }]);
		});

		it('PATCH /series/:id mit pillars → ersetzt die Vorlage vollständig', async () => {
			const [koerper, sinn] = await seedTwoPillars();
			const created = (await (
				await post('/series', { ...validSeries(), pillars: [{ pillarId: koerper, share: 100 }] })
			).json()) as { id: number };

			const res = await patch(`/series/${created.id}`, {
				pillars: [{ pillarId: sinn, share: 100, confidence: 50 }],
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as {
				pillars: { pillarId: number; share: number; confidence: number }[];
			};
			// Der alte Beitrag (koerper) ist ersetzt, nicht ergänzt.
			assert.deepEqual(body.pillars, [{ pillarId: sinn, share: 100, confidence: 50 }]);
		});

		it('PATCH /series/:id mit pillars: [] → leert die Vorlage', async () => {
			const [koerper] = await seedTwoPillars();
			const created = (await (
				await post('/series', { ...validSeries(), pillars: [{ pillarId: koerper, share: 100 }] })
			).json()) as { id: number };

			const res = await patch(`/series/${created.id}`, { pillars: [] });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.deepEqual(body.pillars, [], 'pillars: [] leert die Vorlage');
		});

		it('PATCH /series/:id ohne pillars → lässt die Vorlage unverändert', async () => {
			const [koerper] = await seedTwoPillars();
			const created = (await (
				await post('/series', { ...validSeries(), pillars: [{ pillarId: koerper, share: 100 }] })
			).json()) as { id: number };

			// Ein PATCH, der pillars NICHT enthält, darf die bestehende Vorlage nicht antasten.
			const res = await patch(`/series/${created.id}`, { title: 'Neuer Titel' });
			assert.equal(res.status, 200);
			const body = (await res.json()) as {
				title: string;
				pillars: { pillarId: number; share: number; confidence: number }[];
			};
			assert.equal(body.title, 'Neuer Titel');
			assert.deepEqual(body.pillars, [{ pillarId: koerper, share: 100, confidence: 100 }]);
		});
	});
});
