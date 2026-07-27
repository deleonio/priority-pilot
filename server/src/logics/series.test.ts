import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task, Pillar, SeriesPillar, TaskPillar } from '../models/index.js';
import { generateDueInstances, materializeDueSeries } from './series.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

// Rote Spec-Tests für #120 — Serienaufgaben (Habits): Serien-Template + eigenständige Instanzen.
// Der Vertrag deckt die Generierungslogik ab (AK 1, 3, 4); die Instanz-Override-Semantik (AK 2)
// liegt im API-Test (series.api.test.ts). Es wird KEIN Produktivcode geschrieben — die Tests
// werden grün, sobald `Series`, `seriesId`/`isException` am Task und `generateDueInstances`
// existieren.

const ONE_DAY = 24 * 60 * 60 * 1000;

// Hilfsfunktion: Erstellt ein Datum, das `offsetDays` Tage in der Zukunft liegt (UTC).
// Dies stellt sicher, dass alle generierten Termine zukünftig sind und nicht von der
// "nur zukünftige Termine"-Logik gefiltert werden.
const futureDate = (offsetDays: number): Date => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offsetDays);
	result.setUTCHours(0, 0, 0, 0);
	return result;
};

// Hilfsfunktion: Erstellt ein Datum, das `offsetDays` Tage in der VERGANGENHEIT liegt (UTC).
// Übte den Pfad "vergangenes startDate" — der Kern des PRs (Serien nur zukünftig generieren).
const pastDate = (offsetDays: number): Date => futureDate(-offsetDays);

describe('generateDueInstances', () => {
	// 🔴🔴 AK 1: je fälligem Termin genau EIN Task mit seriesId und eigener deadline 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('wöchentliches Template erzeugt je Termin genau eine Instanz mit seriesId + eigener deadline', async () => {
		const start = futureDate(1); // Morgen
		const series = await Series.create({
			title: 'Sport',
			rhythm: 'weekly',
			priority: 4,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});

		// Fenster [morgen, morgen+19 Tage] enthält wöchentlich: morgen, morgen+7, morgen+14 → genau 3 Termine.
		const until = futureDate(20);
		const instances = await generateDueInstances(series, { until });

		assert.equal(instances.length, 3, 'genau drei wöchentliche Instanzen im Fenster');

		// Jede Instanz ist ein vollwertiger Task mit seriesId und eigener deadline.
		for (const inst of instances) {
			assert.equal(inst.seriesId, series.id);
			assert.ok(inst.deadline, 'Instanz hat eine eigene deadline');
			assert.equal(inst.isException, false, 'frisch generierte Instanz ist keine Ausnahme');
		}

		// Deadlines liegen genau 7 Tage auseinander (aufsteigend sortiert).
		const deadlines = instances.map((t) => new Date(t.deadline as unknown as Date).getTime()).sort((a, b) => a - b);
		assert.equal(deadlines[0], start.getTime());
		assert.equal(deadlines[1] - deadlines[0], 7 * ONE_DAY);
		assert.equal(deadlines[2] - deadlines[1], 7 * ONE_DAY);

		// Die Instanzen sind echt persistiert (als Task mit seriesId abrufbar).
		const persisted = await Task.findAll({ where: { seriesId: series.id } });
		assert.equal(persisted.length, 3);
	});

	// 🔴🔴 AK 4: erneute Generierung desselben Fensters erzeugt keine Dublette (Idempotenz) 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('zweite Generierung desselben Fensters erzeugt keine Dubletten', async () => {
		const series = await Series.create({
			title: 'Kochen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});
		const until = futureDate(20);

		const first = await generateDueInstances(series, { until });
		assert.equal(first.length, 3);

		const second = await generateDueInstances(series, { until });
		assert.equal(second.length, 0, 'bereits materialisierte Termine werden nicht erneut erzeugt');

		const total = await Task.count({ where: { seriesId: series.id } });
		assert.equal(total, 3, 'insgesamt bleiben es genau drei Instanzen');
	});

	// 🔴🔴 AK 4 (heikler Pfad, in #120 als WARNUNG markiert): Idempotenz hängt am unveränderlichen
	//    `seriesOccurrence`, NICHT an der `deadline`. Wird eine Instanz verschoben (AK 2) und dasselbe
	//    Fenster erneut generiert, darf KEINE Dublette für die verschobene Periode entstehen. Eine
	//    naive, an `deadline` verankerte Umsetzung bestünde alle anderen Tests, scheitert aber hier. 🔴🔴
	it('verschobene Instanz wird im selben Fenster nicht dupliziert (Anker: seriesOccurrence)', async () => {
		const series = await Series.create({
			title: 'Aufräumen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});
		const until = futureDate(20);

		const first = await generateDueInstances(series, { until });
		assert.equal(first.length, 3);

		// AK 2: eine Instanz verschieben (deadline ändern → isException). Der Idempotenz-Anker
		// `seriesOccurrence` bleibt dabei unverändert.
		const moved = first[0];
		const occurrence = new Date(moved.seriesOccurrence as unknown as Date).getTime();
		moved.deadline = futureDate(60); // 60 Tage in der Zukunft
		moved.isException = true;
		await moved.save();

		// Dasselbe Fenster erneut generieren: Die verschobene Periode darf NICHT neu materialisiert
		// werden — sonst wäre die Idempotenz fälschlich an `deadline` statt `seriesOccurrence` verankert.
		const second = await generateDueInstances(series, { until });
		assert.equal(second.length, 0, 'verschobene Periode erzeugt keine Dublette');

		const total = await Task.count({ where: { seriesId: series.id } });
		assert.equal(total, 3, 'trotz verschobener deadline bleiben es genau drei Instanzen');

		// Der Anker ist die unveränderliche `seriesOccurrence`-Spalte (nicht die verschobene deadline).
		const reloaded = await Task.findByPk(moved.id);
		assert.ok(reloaded);
		const stillOccurrence = new Date(reloaded.seriesOccurrence as unknown as Date).getTime();
		assert.equal(stillOccurrence, occurrence, 'seriesOccurrence bleibt der stabile Idempotenz-Anker');
	});

	// 🔴🔴 AK 3: Template-Änderung gilt nur für künftige Instanzen 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('Template-Änderung wirkt nur auf künftige, nicht auf bestehende Instanzen', async () => {
		// #295: AK3-Erweiterung — Snapshot-Vertrag gilt auch für description + Pillars.
		const pillar = await Pillar.create({ name: 'Fokus', weight: 100 });

		const series = await Series.create({
			title: 'Lesen',
			rhythm: 'weekly',
			priority: 2,
			estimatedEffort: 0.5,
			active: true,
			description: 'Täglich 30 Minuten lesen',
			startDate: futureDate(1),
		});

		// Pillar-Vorlage für die initiale Serie anlegen.
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillar.id, share: 100, confidence: 80 });

		// Erste Generierung mit Default-Priorität 2.
		const existing = await generateDueInstances(series, {
			until: futureDate(20),
		});
		assert.equal(existing.length, 3);
		for (const inst of existing) {
			assert.equal(inst.priority, 2);
			// #295 AK3: bestehende Instanz trägt description-Snapshot
			assert.equal(
				inst.description,
				'Täglich 30 Minuten lesen',
				'bestehende Instanz trägt die ursprüngliche description',
			);
		}

		// #295 AK3: bestehende Instanzen tragen die ursprünglichen task_pillars
		for (const inst of existing) {
			const pillars = await TaskPillar.findAll({ where: { taskId: inst.id } });
			assert.equal(pillars.length, 1, 'bestehende Instanz hat einen task_pillar');
			assert.equal(pillars[0].pillarId, pillar.id, 'korrekter pillarId');
			assert.equal(pillars[0].share, 100, 'ursprünglicher share');
			assert.equal(pillars[0].confidence, 80, 'ursprüngliche confidence');
		}

		// Template ändern: künftige Instanzen sollen Priorität 5 erhalten.
		series.priority = 5;
		series.description = 'Geänderte Beschreibung';
		await series.save();

		// Pillar-Vorlage ebenfalls ändern: confidence von 80 → 50
		await SeriesPillar.update({ confidence: 50 }, { where: { seriesId: series.id, pillarId: pillar.id } });

		// Künftiges Fenster generieren (21 Tage ab start).
		const future = await generateDueInstances(series, {
			until: futureDate(30),
		});
		assert.ok(future.length > 0, 'es entstehen neue künftige Instanzen');
		for (const inst of future) {
			assert.equal(inst.priority, 5, 'neue Instanzen tragen die geänderte Default-Priorität');
			// #295 AK3: neue Instanzen erben die geänderte description
			assert.equal(inst.description, 'Geänderte Beschreibung', 'neue Instanzen tragen die geänderte description');
		}

		// #295 AK3: neue Instanzen erben die geänderte Pillar-Vorlage
		for (const inst of future) {
			const pillars = await TaskPillar.findAll({ where: { taskId: inst.id } });
			assert.equal(pillars.length, 1, 'neue Instanz hat einen task_pillar');
			assert.equal(pillars[0].confidence, 50, 'neue Instanz trägt die geänderte confidence');
		}

		// Bestehende Instanzen bleiben unverändert bei Priorität 2.
		const oldInstances = await Task.findAll({
			where: { id: existing.map((t) => t.id) },
		});
		for (const inst of oldInstances) {
			assert.equal(inst.priority, 2, 'bestehende Instanzen behalten ihre alte Priorität');
			// #295 AK3: bestehende Instanzen behalten ihre alte description
			assert.equal(inst.description, 'Täglich 30 Minuten lesen', 'bestehende Instanzen behalten ihre alte description');
		}

		// #295 AK3: bestehende Instanzen behalten ihre alten task_pillars (confidence = 80, nicht 50)
		for (const inst of oldInstances) {
			const pillars = await TaskPillar.findAll({ where: { taskId: inst.id } });
			assert.equal(pillars.length, 1, 'bestehende Instanz hat weiterhin einen task_pillar');
			assert.equal(pillars[0].confidence, 80, 'bestehende Instanz behält die alte confidence (Snapshot-Vertrag)');
		}
	});

	// 🔴🔴 AK 3 (Negativ): inaktives Template generiert keine Instanzen 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('inaktives Template erzeugt keine Instanzen', async () => {
		const series = await Series.create({
			title: 'Pausiert',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: false,
			startDate: futureDate(1),
		});
		const instances = await generateDueInstances(series, {
			until: futureDate(20),
		});
		assert.equal(instances.length, 0);
	});

	// 🔴🔴 AK 2 (#295): Instanz erbt description + Pillars aus der Serien-Vorlage 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('erzeugte Instanz trägt description und task_pillars aus der Serien-Vorlage', async () => {
		const pillarA = await Pillar.create({ name: 'Körper', weight: 50 });
		const pillarB = await Pillar.create({ name: 'Geist', weight: 50 });

		const series = await Series.create({
			title: 'Meditation',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			description: 'Täglich meditieren und Geist stärken',
			startDate: futureDate(1),
		});

		await SeriesPillar.create({ seriesId: series.id, pillarId: pillarA.id, share: 70, confidence: 90 });
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillarB.id, share: 30, confidence: 60 });

		const instances = await generateDueInstances(series, {
			until: futureDate(1),
		});
		assert.equal(instances.length, 1, 'genau eine Instanz erzeugt');
		const instance = instances[0];

		assert.equal(
			instance.description,
			'Täglich meditieren und Geist stärken',
			'Instanz trägt die description aus dem Template',
		);

		const taskPillars = await TaskPillar.findAll({ where: { taskId: instance.id } });
		assert.equal(taskPillars.length, 2, 'Instanz hat zwei task_pillars');

		const rowA = taskPillars.find((p) => p.pillarId === pillarA.id);
		const rowB = taskPillars.find((p) => p.pillarId === pillarB.id);
		assert.ok(rowA, 'Säule A ist in den task_pillars vorhanden');
		assert.ok(rowB, 'Säule B ist in den task_pillars vorhanden');
		assert.equal(rowA!.share, 70, 'Säule A: share korrekt kopiert');
		assert.equal(rowA!.confidence, 90, 'Säule A: confidence korrekt kopiert');
		assert.equal(rowB!.share, 30, 'Säule B: share korrekt kopiert');
		assert.equal(rowB!.confidence, 60, 'Säule B: confidence korrekt kopiert');
	});

	it('Serie ohne Pillar-Vorlage erzeugt Instanz ohne task_pillars (kein Fehler); description null bleibt null', async () => {
		const series = await Series.create({
			title: 'Laufen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			description: null,
			startDate: futureDate(1),
		});

		const instances = await generateDueInstances(series, {
			until: futureDate(1),
		});
		assert.equal(instances.length, 1, 'eine Instanz erzeugt');
		const instance = instances[0];

		assert.equal(instance.description, null, 'description ist null wenn im Template null');

		const taskPillars = await TaskPillar.findAll({ where: { taskId: instance.id } });
		assert.equal(taskPillars.length, 0, 'keine task_pillars wenn Vorlage leer');
	});

	// 🔴🔴 Monthly: korrekte Termine auch bei Monatsenden (z. B. 31.01. → 28.02., nicht 03.03.) 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('monthly mit Start am 31. erzeugt korrekte Termine auch bei Monatsende', async () => {
		// Verwende einen Start, der auf den 31. eines Monats fällt und in der Zukunft liegt.
		// Wir starten am 31. des übernächsten Monats (falls der aktuelle Monat 31 Tage hat).
		const now = new Date();
		const start = new Date(now);

		// Gehe 2 Monate in die Zukunft
		start.setUTCMonth(start.getUTCMonth() + 2);
		// Setze auf den 1. des Monats
		start.setUTCDate(1);

		// Prüfe, ob der Monat 31 Tage hat
		const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
		if (lastDay >= 31) {
			start.setUTCDate(31);
		} else {
			// Falls nicht, nimm den letzten Tag des Monats
			start.setUTCDate(lastDay);
		}

		const series = await Series.create({
			title: 'Monatliche Prüfung',
			rhythm: 'monthly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});

		// Fenster: 4 Monate ab Start
		const until = new Date(start);
		until.setUTCMonth(until.getUTCMonth() + 4);
		until.setUTCDate(0); // Letzter Tag des 4. Monats

		const instances = await generateDueInstances(series, { until });

		assert.equal(instances.length, 4, 'genau vier monatliche Instanzen');

		const deadlines = instances
			.map((t) => new Date(t.deadline as unknown as Date))
			.sort((a, b) => a.getTime() - b.getTime());

		// Der erste Termin sollte der 31. (oder letzter Tag) des Startmonats sein
		assert.equal(deadlines[0].getUTCDate(), start.getUTCDate());

		// Der zweite Termin sollte im Februar (oder entsprechenden Monat) sein
		// und auf den letzten gültigen Tag geklemmt sein
		const febLastDay = new Date(
			Date.UTC(deadlines[1].getUTCFullYear(), deadlines[1].getUTCMonth() + 1, 0),
		).getUTCDate();
		assert.ok(
			deadlines[1].getUTCDate() <= febLastDay,
			'Februar-Termin (oder entsprechend) ist auf den letzten Tag des Monats geklemmt',
		);

		// Der dritte Termin sollte im März (oder entsprechenden Monat) sein
		// Wenn der Startmonat 31 Tage hatte, sollte dieser Termin auch auf den 31. fallen (falls möglich)
		if (start.getUTCDate() === 31) {
			const marLastDay = new Date(
				Date.UTC(deadlines[2].getUTCFullYear(), deadlines[2].getUTCMonth() + 1, 0),
			).getUTCDate();
			assert.ok(
				deadlines[2].getUTCDate() === Math.min(31, marLastDay),
				'März-Termin ist korrekt auf 31. oder letzten Tag geklemmt',
			);
		}

		// Der vierte Termin sollte im April (oder entsprechenden Monat) sein
		// April hat 30 Tage, also sollte der Termin auf den 30. fallen
		const aprLastDay = new Date(
			Date.UTC(deadlines[3].getUTCFullYear(), deadlines[3].getUTCMonth() + 1, 0),
		).getUTCDate();
		assert.ok(
			deadlines[3].getUTCDate() <= aprLastDay,
			'April-Termin (oder entsprechend) ist auf den letzten Tag des Monats geklemmt',
		);
	});
});

// 🔴🔴 PR "Serien nur zukünftig": vergangenes startDate + Idempotenz / Raster-Treue 🔴🔴🔴🔴🔴🔴🔴
describe('generateDueInstances — vergangenes startDate (nur zukünftig generieren)', () => {
	// AK4 für den Pfad vergangenes startDate: `now` muss deterministisch sein (UTC-Mitternacht),
	// sonst würde `seriesOccurrence` bei jedem Aufruf anders ausfallen → Duplikate.
	it('vergangenes startDate: zweite Generierung desselben Fensters erzeugt keine Dubletten (AK4)', async () => {
		const series = await Series.create({
			title: 'Täglich',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: pastDate(60), // zwei Monate in der Vergangenheit
		});
		const until = futureDate(7); // eine Woche vorlaufend

		const first = await generateDueInstances(series, { until });
		assert.ok(first.length > 0, 'erster Lauf erzeugt zukünftige Instanzen');

		// Sofortiger zweiter Aufruf mit identischem Fenster — muss 0 neue erzeugen (Idempotenz).
		const second = await generateDueInstances(series, { until });
		assert.equal(second.length, 0, 'zweiter Lauf erzeugt keine Duplikate (vergangenes startDate)');

		const total = await Task.count({ where: { seriesId: series.id } });
		assert.equal(total, first.length, 'Gesamtanzahl bleibt stabil — kein ungebremster Zuwachs');
	});

	// Raster-Treue: auch nach der "heute"-Verschiebung liegt der erste Termin auf dem Anker-Tag,
	// nicht einfach auf "heute" — sonst bräche eine monthly-Serie beim ersten Termin aus der Reihe.
	it('vergangenes startDate (monthly): der erste Termin liegt auf dem Anker-Tag, nicht auf "heute"', async () => {
		const start = pastDate(90); // ~3 Monate in der Vergangenheit, auf den 15. (heute-Tag) gesetzt
		start.setUTCDate(15); // deterministischer Anker-Tag
		const series = await Series.create({
			title: 'Monatlich',
			rhythm: 'monthly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});
		const until = futureDate(95); // breit genug für mehrere Monate

		const instances = await generateDueInstances(series, { until });
		assert.ok(instances.length >= 2, 'es entstehen mehrere monatliche Termine');

		// Jeder Termin muss auf den Anker-Tag (15.) fallen — auch der erste.
		for (const inst of instances) {
			const day = new Date(inst.deadline as unknown as Date).getUTCDate();
			assert.equal(day, 15, 'jeder Termin liegt auf dem Anker-Tag (15.), nicht auf "heute"');
		}
	});
});

// Rote Spec-Tests für #244 — `materializeDueSeries` bündelt die Serien-Materialisierung serverseitig:
// es generiert die fälligen Instanzen ALLER aktiven Serien (optional auf einen User eingeschränkt) und
// isoliert Fehler einzelner Serien, sodass ein Ausreißer den Gesamtlauf nicht abbricht. KEIN Produktivcode.
describe('materializeDueSeries — Aggregat + Fehler-Isolation (AK6 #244)', () => {
	// 🔴🔴 AK6a: aggregiert über alle aktiven Serien, überspringt inaktive 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('erzeugt Tasks für alle aktiven Serien und keine für inaktive', async () => {
		await Series.create({
			title: 'Aktiv A',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});
		await Series.create({
			title: 'Aktiv B',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});
		const inactive = await Series.create({
			title: 'Inaktiv',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: false,
			startDate: futureDate(1),
		});

		// Fenster [morgen, morgen+19 Tage] → je aktiver Serie 3 wöchentliche Termine.
		const until = futureDate(20);
		const created = await materializeDueSeries(undefined, until);

		assert.equal(created.length, 6, 'zwei aktive Serien × 3 Termine = 6 materialisierte Tasks');

		// Keine Instanz gehört zur inaktiven Serie.
		for (const task of created) {
			assert.notEqual(task.seriesId, inactive.id, 'keine Instanz stammt aus der inaktiven Serie');
		}
		const inactiveTasks = await Task.count({ where: { seriesId: inactive.id } });
		assert.equal(inactiveTasks, 0, 'die inaktive Serie erzeugt keine Tasks');
	});

	// 🔴🔴 AK6b: ein Fehler bei einer Serie bricht den Gesamtlauf nicht ab 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
	it('ein Fehler bei einer einzelnen Serie bricht den Gesamtlauf nicht ab', async () => {
		// Gute Serie: erzeugt regelmäßig ihre Instanzen.
		const good = await Series.create({
			title: 'Gute Serie',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});

		// Fehler-Serie: leerer Titel simuliert einen Fehler beim Materialisieren der Instanz
		// (die generierte Task-Instanz hat einen leeren Titel → DB-/Validierungsfehler im Produktivcode).
		// Am Modell selbst erzwingen wir den leeren Titel per Direktzuweisung, damit `create`
		// hier nicht bereits vorab scheitert.
		const broken = await Series.create({
			title: 'Platzhalter',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: futureDate(1),
		});
		await broken.update({ title: '' });

		const until = futureDate(20);

		// Der Lauf darf NICHT werfen — Fehler einzelner Serien werden isoliert.
		let created: Task[] = [];
		await assert.doesNotReject(async () => {
			created = await materializeDueSeries(undefined, until);
		}, 'ein einzelner Serien-Fehler darf den Gesamtlauf nicht abbrechen');

		// Die guten Instanzen sind trotz des Ausreißers entstanden.
		const goodTasks = await Task.count({ where: { seriesId: good.id } });
		assert.equal(goodTasks, 3, 'die fehlerfreie Serie materialisiert ihre 3 Instanzen trotz des Ausreißers');
		assert.ok(
			created.some((task) => task.seriesId === good.id),
			'die guten Instanzen sind Teil des Ergebnisses',
		);
	});
});
