import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Task, Pillar } from '../models/index.js';

let server: TestServer;

// Rote Spec-Tests für #553 — Serien-Kaskade: Bearbeiten & Löschen mit Übertragung auf alle
// generierten Instanzen. KEIN Produktivcode — die Tests werden grün, sobald
//   • DELETE /series/:id den Query-Parameter `cascade` versteht (true ⇒ Instanzen mitlöschen),
//   • PATCH /series/:id das Flag `applyToInstances` versteht (true ⇒ geänderte kaskadierbare
//     Felder auf alle Instanzen mit seriesId = :id übertragen, incl. isException=true),
//   • rhythm / startDate / active NIEMALS auf bestehende Instanzen übertragen werden.
//
// Instanzen werden hier direkt über das Task-Modell gesät (kontrollierte Feldwerte + seriesId),
// damit die Kaskade deterministisch geprüft werden kann.

describe('Series API — Kaskade (#553)', () => {
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

	const futureDate = (offsetDays: number): string => {
		const result = new Date();
		result.setUTCDate(result.getUTCDate() + offsetDays);
		result.setUTCHours(0, 0, 0, 0);
		return result.toISOString().replace(/\.\d{3}Z$/, '.000Z');
	};

	const validSeries = () => ({
		title: 'Wöchentlich kochen',
		rhythm: 'weekly',
		priority: 4,
		estimatedEffort: 0.5,
		active: true,
		startDate: futureDate(1),
	});

	/** Sät `n` generierte Instanzen (Tasks) mit aufsteigendem seriesOccurrence direkt am Modell. */
	const seedInstances = async (seriesId: number, n: number): Promise<Task[]> => {
		const base = new Date();
		base.setUTCHours(0, 0, 0, 0);
		const instances: Task[] = [];
		for (let i = 0; i < n; i++) {
			const occurrence = new Date(base);
			occurrence.setUTCDate(occurrence.getUTCDate() + i * 7);
			instances.push(
				await Task.create({
					title: `Instanz ${i}`,
					priority: 1,
					estimatedEffort: 0.1,
					seriesId,
					seriesOccurrence: occurrence,
					isException: false,
				}),
			);
		}
		return instances;
	};

	// 🔴 AK3: DELETE ?cascade=true löscht die Serie UND alle Instanzen 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	describe('DELETE /series/:id?cascade=true', () => {
		it('204 und entfernt Serie sowie alle 5 Instanzen', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await seedInstances(created.id, 5);

			const res = await del(`/series/${created.id}?cascade=true`);
			assert.equal(res.status, 204);

			const remaining = await Task.count({ where: { seriesId: created.id } });
			assert.equal(remaining, 0, 'alle Instanzen wurden kaskadierend mitgelöscht');

			// Die Serie selbst ist ebenfalls weg.
			const seriesRes = await get(`/series/${created.id}`);
			assert.equal(seriesRes.status, 404);
		});
	});

	// AK4: DELETE ohne cascade lässt die Instanzen UNANGETASTET (seriesId bleibt → Wiederherstellung).
	// Guard-Test: sichert den sicheren Default gegen Regression während der Umsetzung.
	describe('DELETE /series/:id (Default: keine Kaskade)', () => {
		it('lässt alle Instanzen mit unverändertem seriesId bestehen', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await seedInstances(created.id, 5);

			const res = await del(`/series/${created.id}`);
			assert.equal(res.status, 204);

			const remaining = await Task.findAll({ where: { seriesId: created.id } });
			assert.equal(remaining.length, 5, 'Instanzen bleiben erhalten (nur Serie gelöscht)');
			assert.ok(
				remaining.every((t) => t.seriesId === created.id),
				'seriesId ist unverändert (FK verweist weiter auf die Serie — spätere Wiederherstellung)',
			);
		});
	});

	// 🔴 AK2: PATCH applyToInstances=true kaskadiert NUR die geänderten kaskadierbaren Felder 🔴🔴🔴
	describe('PATCH /series/:id mit applyToInstances=true', () => {
		it('überträgt den geänderten Titel auf alle Instanzen (inkl. isException)', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, 5);
			// Eine Instanz manuell abweichend gemacht → isException=true (AK2 verlangt: trotzdem überschreiben).
			await instances[2].update({ isException: true });

			const res = await patch(`/series/${created.id}`, { title: 'Neuer Serientitel', applyToInstances: true });
			assert.equal(res.status, 200);

			const reloaded = await Task.findAll({ where: { seriesId: created.id } });
			assert.equal(reloaded.length, 5);
			for (const inst of reloaded) {
				assert.equal(inst.title, 'Neuer Serientitel', 'jede Instanz erhält den neuen Titel');
			}
			assert.equal(reloaded[2].isException, true, 'isException bleibt true (die Instanz bleibt eine Ausnahme)');
		});

		// AK2 (Präzisierung): pro Instanz werden NUR die geänderten Felder überschrieben.
		it('überschreibt pro Instanz nur geänderte Felder (priority/description bleiben, wenn nicht im PATCH)', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, 3);
			// isException-Instanz mit individuellen Werten für NICHT kaskadierte (im PATCH fehlende) Felder.
			await instances[1].update({
				isException: true,
				priority: 5,
				description: 'Individuelle Notiz',
			});

			// Nur title wird geändert → priority/description dürfen in der Instanz NICHT überschrieben werden.
			await patch(`/series/${created.id}`, { title: 'Nur Titel geändert', applyToInstances: true });

			const exception = await Task.findByPk(instances[1].id);
			assert.equal(exception?.title, 'Nur Titel geändert', 'geändertes kaskadierbares Feld wird übernommen');
			assert.equal(exception?.priority, 5, 'priority bleibt — war nicht im PATCH-Body');
			assert.equal(exception?.description, 'Individuelle Notiz', 'description bleibt — war nicht im PATCH-Body');
		});

		// 🔴 AK2 (pillars): kaskadierte Säulen-Vorlage wird auf die Instanzen übertragen (TaskPillar).
		it('kaskadiert pillars als TaskPillar-Beiträge auf alle Instanzen', async () => {
			const koerper = await Pillar.create({ name: 'Körper', weight: 20 });
			const created = (await (
				await post('/series', { ...validSeries(), pillars: [{ pillarId: koerper.id, share: 100 }] })
			).json()) as { id: number };
			const instances = await seedInstances(created.id, 3);

			// Vorab: Instanzen haben noch keine Säulen-Beiträge.
			assert.equal((await Task.findByPk(instances[0].id, { include: [Pillar] }))?.Pillars?.length ?? 0, 0);

			await patch(`/series/${created.id}`, {
				pillars: [{ pillarId: koerper.id, share: 100 }],
				applyToInstances: true,
			});

			for (const inst of instances) {
				const reloaded = await Task.findByPk(inst.id, { include: [Pillar] });
				const pillarIds = (reloaded?.Pillars ?? []).map((p) => p.id);
				assert.ok(pillarIds.includes(koerper.id), 'Instanz übernimmt die kaskadierte Säule als TaskPillar-Beitrag');
			}
		});

		// AK5: rhythm / startDate / active werden NIEMALS auf bestehende Instanzen übertragen.
		// Guard: eine rhythm-only-Änderung mit applyToInstances=true tastet die Instanzen nicht an.
		it('kaskadiert rhythm/startDate/active NICHT (Instanzen bleiben unangetastet)', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, 3);
			const titlesBefore = instances.map((t) => t.title);
			const occBefore = instances.map((t) => t.seriesOccurrence?.getTime());

			const res = await patch(`/series/${created.id}`, { rhythm: 'daily', active: false, applyToInstances: true });
			assert.equal(res.status, 200);

			const after = await Task.findAll({ where: { seriesId: created.id }, order: [['id', 'ASC']] });
			after.forEach((t, i) => {
				assert.equal(t.title, titlesBefore[i], 'rhythm-Änderung kaskadiert nicht auf den Titel');
				assert.equal(
					t.seriesOccurrence?.getTime(),
					occBefore[i],
					'seriesOccurrence (Termin-Anker) bleibt von rhythm/startDate unberührt',
				);
			});
		});
	});

	// AK1: PATCH ohne applyToInstances (Default) lässt die Instanzen UNANGETASTET.
	// Guard: sichert den sicheren Default (keine Kaskade) gegen Regression.
	describe('PATCH /series/:id (Default: keine Kaskade)', () => {
		it('lässt alle Instanzen mit ihren bisherigen Werten unangetastet', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, 5);
			const titlesBefore = instances.map((t) => t.title);

			const res = await patch(`/series/${created.id}`, { title: 'Neuer Serientitel' });
			assert.equal(res.status, 200);

			// Template bekommt den neuen Titel …
			const template = (await (await get(`/series/${created.id}`)).json()) as Record<string, unknown>;
			assert.equal(template.title, 'Neuer Serientitel');

			// … die Instanzen aber NICHT (Default = nur Template, künftige Instanzen).
			const after = await Task.findAll({ where: { seriesId: created.id }, order: [['id', 'ASC']] });
			after.forEach((t, i) => assert.equal(t.title, titlesBefore[i], 'Instanz behält ihren Wert'));
		});
	});
});
