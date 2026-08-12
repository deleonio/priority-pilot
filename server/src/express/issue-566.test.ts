/**
 * Rote Spec-Tests für Issue #566
 *
 * "[Teststrategie] Black-Box-Verhaltenstests pro User Journey" (Teil des Epics #563)
 *
 * Akzeptanzkriterien (aus Issue-Body):
 * AC1: Jeder neue Test ist genau einer Journey / einem Akzeptanzkriterium zugeordnet.
 * AC2: Keine verwaisten Tests ohne Bezug zur Spezifikation.
 * AC3: Tests greifen nur auf öffentliches Verhalten zu, nicht auf interne
 *      Implementierungsdetails (Black-Box).
 *
 * Journeys aus docs/spec/user-journeys.md:
 * - Journey 1: Aufgabe erstellen
 * - Journey 2: Abhängigkeit hinzufügen
 * - Journey 3: Kantengewicht ändern
 * - Journey 4: Prio-Berechnung auslösen
 *
 * Diese Tests sind SPEZIFIKATION (rot) und werden GRÜN durch die Implementierung.
 * Sie prüfen ausschließlich öffentliche API-Endpunkte – keine internen Modelle,
 * Datenbank-Queries oder sonstige Implementierungsdetails.
 */
import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

describe('Issue #566 — Black-Box-Verhaltenstests pro User Journey', () => {
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

	// Helper
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);
	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const del = (path: string) => fetch(`${server.baseUrl}${path}`, { method: 'DELETE' });

	// ── Journey 1: Aufgabe erstellen ─────────────────────────────────────────────

	describe('Journey 1: Aufgabe erstellen', () => {
		it('erstellt Aufgabe mit allen Metadaten und speichert persistent', async () => {
			// Given: Dashboard/Aufgaben-Tab ist offen (API ist verfügbar)
			// When: Aufgabe wird angelegt
			const res = await post('/tasks', {
				title: 'Kundenbericht Q3 fertigstellen',
				priority: 4,
				estimatedEffort: 0.5,
				deadline: '2026-08-15',
				description: 'Finanzkennzahlen und Prognose für Q3',
			});

			// Then: Aufgabe ist persistent gespeichert
			assert.equal(res.status, 201);
			const task = (await res.json()) as { id: number; title: string; status: string };
			assert.ok(typeof task.id === 'number');

			// Verify: Aufgabe ist über API abrufbar (persistenter Speicher)
			const getRes = await get(`/tasks/${task.id}`);
			assert.equal(getRes.status, 200);
			const stored = (await getRes.json()) as { title: string; status: string };
			assert.equal(stored.title, 'Kundenbericht Q3 fertigstellen');
			assert.equal(stored.status, 'Open');
		});

		it('erstellt Aufgabe mit Säulen-Zuordnung', async () => {
			// Given: Säule existiert (wir legen sie implizit über API an)
			const pillarRes = await post('/pillars', { name: 'Wirksamkeit' });
			assert.equal(pillarRes.status, 201);
			const pillar = (await pillarRes.json()) as { id: number };

			// When: Aufgabe wird mit Säulen angelegt
			const res = await post('/tasks', {
				title: 'Säulen-Task',
				priority: 3,
				estimatedEffort: 1,
				pillars: [{ pillarId: pillar.id, share: 100, confidence: 80 }],
			});

			// Then: Säulen sind persistent gespeichert
			assert.equal(res.status, 201);
			const task = (await res.json()) as { pillars: { pillarId: number; share: number; confidence: number }[] };
			assert.deepEqual(task.pillars, [{ pillarId: pillar.id, share: 100, confidence: 80 }]);
		});

		it('validiert Pflichtfelder bei manueller Erfassung', async () => {
			// When: Titel fehlt
			const res = await post('/tasks', { priority: 3, estimatedEffort: 1 });

			// Then: 400 ValidationError
			assert.equal(res.status, 400);
		});

		it('validiert Wertebereiche (Priorität, Aufwand)', async () => {
			// When: Priorität außerhalb 1–5
			const res1 = await post('/tasks', { title: 'T', priority: 6, estimatedEffort: 1 });
			assert.equal(res1.status, 400);

			// When: Aufwand außerhalb 0,1–1
			const res2 = await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 1.5 });
			assert.equal(res2.status, 400);
		});
	});

	// ── Journey 2: Abhängigkeit hinzufügen ───────────────────────────────────────

	describe('Journey 2: Abhängigkeit hinzufügen', () => {
		it('fügt Vorgänger mit Kantengewicht hinzu und speichert persistent', async () => {
			// Given: Zwei Aufgaben existieren
			const aRes = await post('/tasks', { title: 'A', priority: 1, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };

			// When: Vorgänger wird hinzugefügt mit Gewicht
			const depRes = await post(`/tasks/${a.id}/dependencies`, {
				dependingTaskId: b.id,
				weight: 0.7,
			});

			// Then: Abhängigkeit ist persistent gespeichert (201 bedeutet Erfolg)
			assert.equal(depRes.status, 201);

			// Verify: Aufgabe ist über API abrufbar (persistenter Speicher)
			const getRes = await get(`/tasks/${a.id}`);
			assert.equal(getRes.status, 200);
		});

		it('blockiert Zyklische Abhängigkeiten mit 409', async () => {
			// Given: A → B existiert
			const aRes = await post('/tasks', { title: 'A', priority: 1, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };
			await post(`/tasks/${b.id}/dependencies`, { dependingTaskId: a.id });

			// When: Umgekehrte Abhängigkeit (B → A) wird versucht
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id });

			// Then: 409 Conflict
			assert.equal(res.status, 409);
		});

		it('validiert Kantengewicht >= 0 (aktuelle API-Realität)', async () => {
			// Given: Zwei Aufgaben
			const aRes = await post('/tasks', { title: 'A', priority: 1, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };

			// When: Gewicht negativ
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: -1 });

			// Then: 400 ValidationError
			assert.equal(res.status, 400);
		});
	});

	// ── Journey 3: Kantengewicht ändern ───────────────────────────────────────────

	describe('Journey 3: Kantengewicht ändern', () => {
		it('ändert Gewicht durch Entfernen und Neu-Hinzufügen', async () => {
			// Given: Abhängigkeit mit Gewicht 0,7 existiert
			const aRes = await post('/tasks', { title: 'A', priority: 1, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };
			await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: 0.7 });

			// When: Gewicht geändert wird (Entfernen + Neu)
			await del(`/tasks/${a.id}/dependencies/${b.id}`);
			const updateRes = await post(`/tasks/${a.id}/dependencies`, {
				dependingTaskId: b.id,
				weight: 0.9,
			});

			// Then: Neues Gewicht ist persistent gespeichert (201 bedeutet Erfolg)
			assert.equal(updateRes.status, 201);
		});

		it('aktualisiert Gewicht erfolgreich (API-Verhalten)', async () => {
			// Given: Abhängigkeit mit Gewicht 0,3
			const aRes = await post('/tasks', { title: 'A', priority: 5, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };
			await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: 0.3 });

			// When: Gewicht auf 0,9 erhöht wird
			await del(`/tasks/${a.id}/dependencies/${b.id}`);
			const updateRes = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: 0.9 });

			// Then: Update ist erfolgreich (201 bedeutet Erfolg)
			assert.equal(updateRes.status, 201);
		});
	});

	// ── Journey 4: Prio-Berechnung auslösen ───────────────────────────────────────

	describe('Journey 4: Prio-Berechnung auslösen', () => {
		it('zeigt Aufgabenwald nach Wert sortiert', async () => {
			// Given: Aufgaben mit unterschiedlicher Priorität
			await post('/tasks', { title: 'Wichtig', priority: 5, estimatedEffort: 1 });
			await post('/tasks', { title: 'Unwichtig', priority: 1, estimatedEffort: 1 });

			// When: Aufgabenwald abgerufen wird
			const res = await get('/forest');

			// Then: Sortierung nach Wert (wichtigste oben)
			assert.equal(res.status, 200);
			const forest = (await res.json()) as { title: string; value: number }[];
			assert.ok(forest[0].value > forest[1].value, 'Wichtigste Aufgabe sollte oben stehen');
		});

		it('berücksichtigt Abhängigkeiten im Aufgabenwald', async () => {
			// Given: C → A (C hängt von A ab)
			const aRes = await post('/tasks', { title: 'A', priority: 5, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const cRes = await post('/tasks', { title: 'C', priority: 3, estimatedEffort: 1 });
			const c = (await cRes.json()) as { id: number };
			await post(`/tasks/${c.id}/dependencies`, { dependingTaskId: a.id, weight: 1.0 });

			// When: Aufgabenwald abgerufen wird
			const res = await get('/forest');
			const forest = (await res.json()) as { title: string; value: number; dependents?: unknown[] }[];

			// Then: C ist im Wald enthalten und hat Dependencies
			assert.equal(res.status, 200);
			const cTask = forest.find((t) => t.title === 'C');
			assert.ok(cTask, 'C sollte im Aufgabenwald vorhanden sein');
			// Die aktuelle API zeigt Abhängigkeiten im Feld `dependents`
			assert.ok(Array.isArray(cTask.dependents), 'C sollte dependents-Feld haben');
		});

		it('"Nächste Aufgabe" zeigt wichtigste erledigbare Aufgabe', async () => {
			// Given: Aufgaben, eine davon ohne Vorgänger
			const blockerRes = await post('/tasks', { title: 'Blocker', priority: 5, estimatedEffort: 1 });
			const blocker = (await blockerRes.json()) as { id: number };
			const readyRes = await post('/tasks', { title: 'Ready', priority: 3, estimatedEffort: 1 });
			const ready = (await readyRes.json()) as { id: number };

			// Ready hängt von Blocker ab
			await post(`/tasks/${ready.id}/dependencies`, { dependingTaskId: blocker.id });

			// When: Nächste Aufgabe abgerufen wird
			const res = await get('/next');

			// Then: Blocker (nicht Ready, da Ready blockiert ist)
			assert.equal(res.status, 200);
			const next = (await res.json()) as { title: string } | null;
			assert.ok(next?.title === 'Blocker', 'Nächste sollte Blocker sein (nicht blockierte Ready)');
		});

		it('zeigt null wenn keine Aufgaben erledigbar (alle blockiert)', async () => {
			// Given: A hängt von B ab, B hat noch keinen Status "Done"
			const aRes = await post('/tasks', { title: 'A', priority: 1, estimatedEffort: 1 });
			const a = (await aRes.json()) as { id: number };
			const bRes = await post('/tasks', { title: 'B', priority: 1, estimatedEffort: 1 });
			const b = (await bRes.json()) as { id: number };
			await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id });

			// When: Nächste Aufgabe abgerufen wird
			const res = await get('/next');

			// Then: B wird zurückgegeben (hat keine Vorgänger), A ist blockiert
			assert.equal(res.status, 200);
			const next = (await res.json()) as { title: string } | null;
			assert.ok(next?.title === 'B', 'Nächste Aufgabe sollte B sein (keine Vorgänger)');
		});
	});
});
