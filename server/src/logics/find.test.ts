import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task, Pillar, ScoreEntry } from '../models/index.js';
import { findNextImportantTask, findSuggestedTasks } from './find.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

describe('findNextImportantTask', () => {
	it('Leerfall: keine Tasks → null', async () => {
		const result = await findNextImportantTask();
		assert.equal(result, null);
	});

	it('Gibt einzigen offenen Task zurück', async () => {
		const task = await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, task.id);
	});

	it('Ignoriert Done-Tasks', async () => {
		await Task.create({ title: 'Done task', priority: 5, estimatedEffort: 1, status: 'Done' });
		const open = await Task.create({ title: 'Open task', priority: 2, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, open.id);
	});

	it('Wählt Task mit höchster Priorität', async () => {
		await Task.create({ title: 'Low', priority: 2, estimatedEffort: 1 });
		const high = await Task.create({ title: 'High', priority: 5, estimatedEffort: 1 });
		await Task.create({ title: 'Mid', priority: 4, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, high.id);
	});

	it('Überspringt Tasks mit nicht-abgeschlossenen Abhängigkeiten', async () => {
		// b depends on a (a is not Done), so b should be excluded
		const a = await Task.create({ title: 'Blocker', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'Blocked', priority: 5, estimatedEffort: 1 });
		await b.addDependency(a); // b depends on a; a status = Open → blocks b
		const c = await Task.create({ title: 'Free', priority: 5, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, c.id);
	});

	it('Wählt Task wenn alle Abhängigkeiten Done sind', async () => {
		const done = await Task.create({ title: 'Done dep', priority: 1, estimatedEffort: 1, status: 'Done' });
		const b = await Task.create({ title: 'Unblocked', priority: 5, estimatedEffort: 1 });
		await b.addDependency(done); // b depends on done (status=Done) → b is free
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, b.id);
	});

	it('"In process"-Tasks werden berücksichtigt', async () => {
		const inProcess = await Task.create({
			title: 'In progress',
			priority: 5,
			estimatedEffort: 1,
			status: 'In process',
		});
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, inProcess.id);
	});
});

/**
 * Rote Spec-Tests für #122 — Vorschlags-Engine („Was ist jetzt dran?"-Liste). Vertrag gegen die im
 * Triage-/Owner-Kommentar festgelegten, deterministischen Defaults:
 *
 *   score     = W_PRIO·nPrio + W_DEADLINE·nDeadline + W_BALANCE·nBalance
 *   W_PRIO = 0.5   W_DEADLINE = 0.3   W_BALANCE = 0.2                  (Σ = 1)
 *   nPrio     = (priority − 1) / 4                                      // 1→0.0, 3→0.5, 5→1.0
 *   nDeadline = überfällig 1.0 · heute 0.8 · ≤7 Tage 0.5 · >7 Tage 0.2 · keine 0.0
 *   nBalance  = Σ (shareᵢ/100)·nDefizitᵢ,  nDefizit = soll>0 ? max(0, soll−ist)/soll : 0
 *               soll = weight/Σweights,  ist = punkteSäule/Σpunkte (aggregierePunkteProSaeule)
 *   MAX_PRO_SAEULE = 2   MAX_VORSCHLAEGE = 5                            // Post-Filter, ändert Ranking nicht
 *
 * `findSuggestedTasks()` liefert die sortierte, post-gefilterte Liste; der Abhängigkeitsfilter aus
 * `findNextImportantTask()` bleibt vorgeschaltet (AC3). Die Implementierung folgt durch die Umsetzung.
 */
describe('findSuggestedTasks (Vorschlags-Engine #122)', () => {
	const TAG = 24 * 60 * 60 * 1000;

	it('liefert eine sortierte Liste (Array), nicht nur einen einzelnen Task', async () => {
		await Task.create({ title: 'Niedrig', priority: 2, estimatedEffort: 1 });
		await Task.create({ title: 'Hoch', priority: 5, estimatedEffort: 1 });
		const liste = await findSuggestedTasks();
		assert.ok(Array.isArray(liste), 'Rückgabe ist eine Liste');
		assert.equal(liste.length, 2);
		// Ohne Deadline-/Balance-Einfluss entscheidet allein die Priorität: höchste zuerst.
		assert.equal(liste[0].priority, 5);
		assert.equal(liste[1].priority, 2);
	});

	it('Leerfall: keine Tasks → leere Liste', async () => {
		const liste = await findSuggestedTasks();
		assert.deepEqual(liste, []);
	});

	it('Done-Tasks erscheinen nicht in der Vorschlagsliste', async () => {
		await Task.create({ title: 'Erledigt', priority: 5, estimatedEffort: 1, status: 'Done' });
		const offen = await Task.create({ title: 'Offen', priority: 2, estimatedEffort: 1 });
		const liste = await findSuggestedTasks();
		assert.deepEqual(
			liste.map((t) => t.id),
			[offen.id],
		);
	});

	// ── AC1: Balance-Korrektur ────────────────────────────────────────────────
	it('AC1: Task der Rückstands-Säule wird höher gereiht (gleiche Priorität, keine Deadline)', async () => {
		// Zwei gleich gewichtete Säulen ⇒ gleicher Soll-Anteil (0.5 / 0.5).
		const rueckstand = await Pillar.create({ name: 'Rückstand', weight: 20 });
		const ausgeglichen = await Pillar.create({ name: 'Ausgeglichen', weight: 20 });

		// Säule "ausgeglichen" hat bereits Punkte gesammelt (ist > 0), "Rückstand" nicht (ist = 0 < soll).
		const erledigt = await Task.create({
			title: 'Erledigt (Säule B)',
			priority: 3,
			estimatedEffort: 1,
			status: 'Done',
		});
		await erledigt.addPillar(ausgeglichen.id, { through: { share: 100, confidence: 100 } });
		await ScoreEntry.create({ taskId: erledigt.id, punkte: 10, pünktlich: true, zeitpunkt: new Date() });

		// Zwei Kandidaten gleicher Priorität, ohne Deadline, je 100 % in einer der Säulen.
		const taskRueckstand = await Task.create({ title: 'Kandidat Rückstand', priority: 3, estimatedEffort: 1 });
		await taskRueckstand.addPillar(rueckstand.id, { through: { share: 100, confidence: 100 } });
		const taskAusgeglichen = await Task.create({ title: 'Kandidat Ausgeglichen', priority: 3, estimatedEffort: 1 });
		await taskAusgeglichen.addPillar(ausgeglichen.id, { through: { share: 100, confidence: 100 } });

		const ids = (await findSuggestedTasks()).map((t) => t.id);
		// score Rückstand = 0.25 + 0.2·1.0 = 0.45 > ausgeglichen 0.25 + 0.2·0 = 0.25
		assert.ok(
			ids.indexOf(taskRueckstand.id) < ids.indexOf(taskAusgeglichen.id),
			'Task der Rückstands-Säule steht vor dem der ausgeglichenen Säule',
		);
	});

	// ── AC2: Deadline-Nähe ────────────────────────────────────────────────────
	it('AC2: überfälliger Task wird vor nicht-fälligem bevorzugt (gleiche Priorität)', async () => {
		const ueberfaellig = await Task.create({
			title: 'Überfällig',
			priority: 3,
			estimatedEffort: 1,
			deadline: new Date(Date.now() - 7 * TAG),
		});
		const ohneDeadline = await Task.create({ title: 'Ohne Deadline', priority: 3, estimatedEffort: 1 });

		const ids = (await findSuggestedTasks()).map((t) => t.id);
		// score überfällig = 0.5·0.5 + 0.3·1.0 = 0.55 > ohne Deadline 0.25
		assert.ok(
			ids.indexOf(ueberfaellig.id) < ids.indexOf(ohneDeadline.id),
			'überfälliger Task steht vor dem nicht-fälligen',
		);
	});

	// ── AC3: Abhängigkeitsfilter bleibt vorgeschaltet ─────────────────────────
	it('AC3: Task mit noch offener Abhängigkeit erscheint nicht in der Vorschlagsliste', async () => {
		const blocker = await Task.create({ title: 'Blocker', priority: 1, estimatedEffort: 1 }); // Open
		const blockiert = await Task.create({ title: 'Blockiert', priority: 5, estimatedEffort: 1 });
		await blockiert.addDependency(blocker); // Abhängigkeit ist Open → blockiert
		const frei = await Task.create({ title: 'Frei', priority: 5, estimatedEffort: 1 });

		const ids = (await findSuggestedTasks()).map((t) => t.id);
		assert.ok(!ids.includes(blockiert.id), 'blockierter Task fehlt in der Liste');
		assert.ok(ids.includes(frei.id), 'freier Task ist in der Liste');
		assert.ok(ids.includes(blocker.id), 'Blocker (ohne offene Abhängigkeit) ist in der Liste');
	});

	// ── AC4: Überlastungsschutz ───────────────────────────────────────────────
	it('AC4: höchstens MAX_PRO_SAEULE (2) Tasks je Säule, weitere werden zurückgestellt', async () => {
		const saeule = await Pillar.create({ name: 'Eine Säule', weight: 20 });
		const eigene: number[] = [];
		for (let i = 0; i < 4; i++) {
			const t = await Task.create({ title: `Säulen-Task ${i}`, priority: 3, estimatedEffort: 1 });
			await t.addPillar(saeule.id, { through: { share: 100, confidence: 100 } });
			eigene.push(t.id);
		}
		const liste = await findSuggestedTasks();
		const ausSaeule = liste.filter((t) => eigene.includes(t.id));
		assert.equal(ausSaeule.length, 2, 'genau 2 Tasks der Säule in der Liste, die übrigen zurückgestellt');
	});

	it('AC4: Gesamtliste ist auf MAX_VORSCHLAEGE (5) begrenzt', async () => {
		// 7 Säulen mit je einem Task ⇒ Pro-Säule-Limit greift nicht, nur das Gesamtlimit.
		for (let i = 0; i < 7; i++) {
			const p = await Pillar.create({ name: `Säule ${i}`, weight: 20 });
			const t = await Task.create({ title: `Task ${i}`, priority: 3, estimatedEffort: 1 });
			await t.addPillar(p.id, { through: { share: 100, confidence: 100 } });
		}
		const liste = await findSuggestedTasks();
		assert.ok(liste.length <= 5, `Liste höchstens 5 Einträge, war ${liste.length}`);
	});
});

// Rote Spec-Tests für #1518 (Spec docs/spec/issue-1518.md, Journey 1): „Nächste Aufgabe" (`GET /next`,
// MCP `next_task`) und „Was ist jetzt dran?" (`GET /suggestions`) enthalten je Serie höchstens eine
// Instanz — die früheste offene ab heute. KEIN Produktivcode.
describe('find — eine Instanz je Serie (#1518)', () => {
	const dayFromToday = (offset: number): Date => {
		const day = new Date();
		day.setUTCHours(0, 0, 0, 0);
		day.setUTCDate(day.getUTCDate() + offset);
		return day;
	};

	const seedDailySeries = async (priority: number): Promise<Task[]> => {
		const series = await Series.create({
			title: 'Täglich',
			rhythm: 'daily',
			priority,
			estimatedEffort: 0.5,
			active: true,
			startDate: dayFromToday(0),
		});
		// Bewusst in umgekehrter Reihenfolge angelegt (heute+4 zuerst): die DB-Reihenfolge darf die
		// Wahl nicht treffen, nur die Deadline-Regel. `instances[0]` bleibt die heutige Instanz.
		const instances: Task[] = [];
		for (let offset = 4; offset >= 0; offset -= 1) {
			const occurrence = dayFromToday(offset);
			instances.unshift(
				await Task.create({
					title: 'Täglich',
					priority,
					estimatedEffort: 0.5,
					deadline: occurrence,
					seriesId: series.id,
					seriesOccurrence: occurrence,
					originSeriesId: series.id,
				}),
			);
		}
		return instances;
	};

	it('AK6: findNextImportantTask liefert die Instanz mit Deadline heute, nicht eine beliebige', async () => {
		const instances = await seedDailySeries(5);
		// Später angelegte Instanz mit früherer Deadline darf die Wahl nicht verschieben: die Regel
		// entscheidet nach Deadline, nicht nach Anlage-Reihenfolge.
		await Task.create({ title: 'Einzeln', priority: 2, estimatedEffort: 1 });

		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, instances[0].id);
	});

	it('AK6: findSuggestedTasks nennt je Serie höchstens eine Instanz und drei verschiedene Aufgaben', async () => {
		const instances = await seedDailySeries(5);
		const b = await Task.create({ title: 'Steuer', priority: 4, estimatedEffort: 1 });
		const c = await Task.create({ title: 'Garten', priority: 3, estimatedEffort: 1 });

		const suggestions = await findSuggestedTasks();
		const seriesHits = suggestions.filter((task) => task.seriesId !== null && task.seriesId !== undefined);
		assert.equal(seriesHits.length, 1, 'je Serie höchstens eine Instanz');
		assert.equal(seriesHits[0].id, instances[0].id, 'die Instanz mit Deadline heute');
		const ids = suggestions.slice(0, 3).map((task) => task.id);
		assert.equal(new Set(ids).size, 3, 'drei verschiedene Aufgaben');
		assert.deepEqual(
			[...ids].sort((x, y) => x - y),
			[instances[0].id, b.id, c.id].sort((x, y) => x - y),
		);
	});
});

// Rote Spec-Tests für Issue #1641 (Spec docs/spec/issue-1641.md, Journey 2): eine Aufgabe mit Datum
// mehr als 3 Kalendertage in der Zukunft erscheint weder bei findNextImportantTask noch bei
// findSuggestedTasks, auch wenn sie die höchste Priorität hätte. KEIN Produktivcode.
describe('find — Vorlauf 3 Tage (Issue #1641)', () => {
	const dayFromToday = (offset: number): Date => {
		const day = new Date();
		day.setUTCHours(0, 0, 0, 0);
		day.setUTCDate(day.getUTCDate() + offset);
		return day;
	};

	it('AK1: findNextImportantTask ignoriert die höchste Priorität, wenn ihr Datum 5 Tage entfernt ist', async () => {
		await Task.create({ title: 'Zu weit weg', priority: 5, estimatedEffort: 1, deadline: dayFromToday(5) });
		const niedrig = await Task.create({ title: 'Ohne Datum', priority: 2, estimatedEffort: 1 });

		const result = await findNextImportantTask();

		assert.ok(result !== null);
		assert.equal(result.id, niedrig.id, 'die zurückgehaltene Aufgabe darf nicht gewählt werden');
	});

	it('AK2: findNextImportantTask wählt eine Aufgabe mit Datum in genau 3 Tagen (Grenze inklusiv)', async () => {
		const grenzfall = await Task.create({
			title: 'Grenzfall',
			priority: 5,
			estimatedEffort: 1,
			deadline: dayFromToday(3),
		});
		await Task.create({ title: 'Ohne Datum', priority: 2, estimatedEffort: 1 });

		const result = await findNextImportantTask();

		assert.ok(result !== null);
		assert.equal(result.id, grenzfall.id, 'genau 3 Tage entfernt zählt noch als berechtigt');
	});

	it('AK1: findSuggestedTasks lässt eine Aufgabe mit Datum in 5 Tagen aus der Liste', async () => {
		const zuWeitWeg = await Task.create({
			title: 'Zu weit weg',
			priority: 5,
			estimatedEffort: 1,
			deadline: dayFromToday(5),
		});
		const ohneDatum = await Task.create({ title: 'Ohne Datum', priority: 2, estimatedEffort: 1 });

		const ids = (await findSuggestedTasks()).map((t) => t.id);

		assert.ok(!ids.includes(zuWeitWeg.id), 'zurückgehaltene Aufgabe fehlt in der Vorschlagsliste');
		assert.ok(ids.includes(ohneDatum.id));
	});

	it('AK3: Aufgabe ohne Datum und überfällige Aufgabe erscheinen in beiden Ergebnissen wie bisher', async () => {
		const ohneDatum = await Task.create({ title: 'Ohne Datum', priority: 3, estimatedEffort: 1 });
		const ueberfaellig = await Task.create({
			title: 'Überfällig',
			priority: 2,
			estimatedEffort: 1,
			deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
		});

		const naechste = await findNextImportantTask();
		const vorschlaege = (await findSuggestedTasks()).map((t) => t.id);

		assert.ok(naechste !== null && [ohneDatum.id, ueberfaellig.id].includes(naechste.id));
		assert.ok(vorschlaege.includes(ohneDatum.id));
		assert.ok(vorschlaege.includes(ueberfaellig.id));
	});

	it('AK5: eine Serie, deren aktuelle Instanz 5 Tage entfernt ist, erscheint in keinem der beiden Ergebnisse', async () => {
		const series = await Series.create({
			title: 'Weit weg',
			rhythm: 'daily',
			priority: 5,
			estimatedEffort: 0.5,
			active: true,
			startDate: dayFromToday(5),
		});
		const seriesTask = await Task.create({
			title: 'Weit weg',
			priority: 5,
			estimatedEffort: 0.5,
			deadline: dayFromToday(5),
			seriesId: series.id,
			seriesOccurrence: dayFromToday(5),
			originSeriesId: series.id,
		});
		const sonst = await Task.create({ title: 'Sonst nichts los', priority: 1, estimatedEffort: 1 });

		const naechste = await findNextImportantTask();
		const vorschlaege = (await findSuggestedTasks()).map((t) => t.id);

		assert.ok(naechste !== null);
		assert.equal(naechste.id, sonst.id, 'die Serie darf nicht gewählt werden');
		assert.ok(!vorschlaege.includes(seriesTask.id));
	});
});
