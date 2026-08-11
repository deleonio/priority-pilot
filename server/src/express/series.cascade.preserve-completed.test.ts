import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Task } from '../models/index.js';

// Rote Spec-Tests für #555 — Löschen und Bearbeiten einer Serie wirken NUR auf nicht-erledigte
// (offene / begonnene) Instanzen; erledigte ("Done") Instanzen bleiben unangetastet.
// KEIN Produktivcode — die Tests werden grün, sobald
//   • DELETE /series/:id?cascade=true ausschließlich Instanzen mit status != 'Done' entfernt
//     (erledigte Instanzen bleiben erhalten, die Serie-Definition wird dennoch gelöscht), und
//   • PATCH /series/:id mit applyToInstances=true geänderte Felder NUR auf Instanzen mit
//     status != 'Done' überträgt ('Done'-Instanzen werden bei der Kaskade übersprungen).
//
// Dedup-Hinweis: Die reine "alle offen löschen/ändern"-Kaskade (TF3) sowie die "nur geänderte
// Felder"-Semantik (AC4) und "Serie-Definition wird entfernt" (AC7) sind bereits in
// series.cascade.test.ts (#553) abgedeckt — daher hier Fokus auf die Done-Schonung.

let server: TestServer;

describe('Series API — Kaskade schont erledigte Instanzen (#555)', () => {
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

	/**
	 * Sät Instanzen direkt am Task-Modell mit vorgegebenem status.
	 * `statuses` ist eine Liste aus 'Open' | 'In process' | 'Done' — Reihenfolge = Anlege-Reihenfolge.
	 * Jede Instanz erhält einen am status erkennbaren Titel, sodass Bearbeiten-Unterschiede prüfbar sind.
	 */
	const seedInstances = async (seriesId: number, statuses: Array<'Open' | 'In process' | 'Done'>): Promise<Task[]> => {
		const base = new Date();
		base.setUTCHours(0, 0, 0, 0);
		const labelOf = (s: string, i: number) =>
			s === 'Done' ? `Erledigt ${i}` : s === 'In process' ? `Begonnen ${i}` : `Offen ${i}`;
		const instances: Task[] = [];
		for (let i = 0; i < statuses.length; i++) {
			const occurrence = new Date(base);
			occurrence.setUTCDate(occurrence.getUTCDate() + i * 7);
			instances.push(
				await Task.create({
					title: labelOf(statuses[i], i),
					priority: 1,
					estimatedEffort: 0.1,
					status: statuses[i],
					seriesId,
					seriesOccurrence: occurrence,
					isException: false,
					originSeriesId: seriesId,
				}),
			);
		}
		return instances;
	};

	// 🔴 AC1 + AC2 + AC7 / TF1: Löschen mit 3 offenen + 2 erledigten Instanzen.
	describe('DELETE /series/:id?cascade=true — erledigte Instanzen bleiben erhalten', () => {
		it('entfernt die 3 offenen Instanzen, belässt die 2 erledigten und löscht die Serie', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await seedInstances(created.id, ['Open', 'Open', 'Open', 'Done', 'Done']);

			const res = await del(`/series/${created.id}?cascade=true`);
			assert.equal(res.status, 204);

			// AC1: alle nicht-erledigten Instanzen wurden entfernt.
			const openRemaining = await Task.count({
				where: { originSeriesId: created.id, status: ['Open', 'In process'] },
			});
			assert.equal(openRemaining, 0, 'keine offene/begonnene Instanz bleibt zurück');

			// AC2: erledigte Instanzen bleiben unangetastet erhalten.
			const doneRemaining = await Task.count({
				where: { originSeriesId: created.id, status: 'Done' },
			});
			assert.equal(doneRemaining, 2, 'beide erledigten Instanzen überleben die Kaskade');

			// AC7: die Serie-Definition selbst ist dennoch entfernt.
			const seriesRes = await get(`/series/${created.id}`);
			assert.equal(seriesRes.status, 404);
		});
	});

	// 🔴 AC2 + AC7 / TF2: Löschen einer Serie, die NUR erledigte Instanzen besitzt.
	describe('DELETE /series/:id?cascade=true — nur erledigte Instanzen', () => {
		it('entfernt keine Instanz, löscht aber die Serie-Definition', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await seedInstances(created.id, ['Done', 'Done']);

			const res = await del(`/series/${created.id}?cascade=true`);
			assert.equal(res.status, 204);

			const doneRemaining = await Task.count({
				where: { originSeriesId: created.id, status: 'Done' },
			});
			assert.equal(doneRemaining, 2, 'keine erledigte Instanz wird angetastet');

			const seriesRes = await get(`/series/${created.id}`);
			assert.equal(seriesRes.status, 404, 'die Serie-Definition wird trotzdem entfernt');
		});
	});

	// 🔴 AC5 / TF6 (Löschen): eine begonnene ("In process"), nicht erledigte Instanz zählt als offen.
	describe('DELETE /series/:id?cascade=true — begonnene Instanz zählt als offen', () => {
		it('entfernt die "In process"-Instanz mit (sie ist nicht erledigt)', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			await seedInstances(created.id, ['In process', 'Done']);

			await del(`/series/${created.id}?cascade=true`);

			const inProcessRemaining = await Task.count({
				where: { originSeriesId: created.id, status: 'In process' },
			});
			assert.equal(inProcessRemaining, 0, 'begonnene Instanz wird als offen mitgelöscht');

			const doneRemaining = await Task.count({
				where: { originSeriesId: created.id, status: 'Done' },
			});
			assert.equal(doneRemaining, 1, 'erledigte Instanz bleibt auch hier erhalten');
		});
	});

	// 🔴 AC3 + AC6 / TF4: Bearbeiten wirkt nur auf nicht-erledigte Instanzen.
	describe('PATCH /series/:id mit applyToInstances=true — erledigte Instanzen unangetastet', () => {
		it('übernimmt den neuen Titel nur auf offene Instanzen; erledigte bleiben beim alten Titel', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, ['Open', 'In process', 'Done', 'Done']);
			const doneIds = instances.filter((t) => t.status === 'Done').map((t) => t.id);

			const res = await patch(`/series/${created.id}`, {
				title: 'Geänderter Serientitel',
				applyToInstances: true,
			});
			assert.equal(res.status, 200);

			// AC3 + AC5: nicht-erledigte Instanzen (Open UND In process) erhalten den neuen Titel.
			const reloaded = await Task.findAll({
				where: { originSeriesId: created.id },
				order: [['id', 'ASC']],
			});
			for (const inst of reloaded) {
				if (inst.status === 'Done') {
					// AC6: erledigte Instanzen bleiben beim alten Titel.
					assert.equal(inst.title.startsWith('Erledigt'), true, 'erledigte Instanz behält ihren Titel');
				} else {
					assert.equal(inst.title, 'Geänderter Serientitel', 'nicht-erledigte Instanz wird aktualisiert');
				}
			}

			// Explizit: keine der erledigten Instanzen wurde verändert.
			const doneReloaded = await Task.findAll({ where: { id: doneIds } });
			assert.ok(
				doneReloaded.every((t) => t.title.startsWith('Erledigt')),
				'keine erledigte Instanz erhält den neuen Titel',
			);
		});
	});

	// 🔴 AC6 / TF5: Bearbeiten, wenn ALLE Instanzen erledigt sind → nichts ändert sich.
	describe('PATCH /series/:id mit applyToInstances=true — alle Instanzen erledigt', () => {
		it('lässt alle Instanzen unverändert (keine einzige Übertragung)', async () => {
			const created = (await (await post('/series', validSeries())).json()) as { id: number };
			const instances = await seedInstances(created.id, ['Done', 'Done', 'Done']);
			const titlesBefore = instances.map((t) => t.title);

			const res = await patch(`/series/${created.id}`, {
				title: 'Sollte nicht kaskadieren',
				applyToInstances: true,
			});
			assert.equal(res.status, 200);

			const after = await Task.findAll({
				where: { originSeriesId: created.id },
				order: [['id', 'ASC']],
			});
			after.forEach((t, i) => assert.equal(t.title, titlesBefore[i], 'erledigte Instanz bleibt komplett unverändert'));
		});
	});
});
