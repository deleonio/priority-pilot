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

describe('generateDueInstances', () => {
	// ── AK 1: je fälligem Termin genau EIN Task mit seriesId und eigener deadline ──────────────
	it('wöchentliches Template erzeugt je Termin genau eine Instanz mit seriesId + eigener deadline', async () => {
		const start = new Date('2026-01-01T00:00:00.000Z');
		const series = await Series.create({
			title: 'Sport',
			rhythm: 'weekly',
			priority: 4,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});

		// Fenster [01.01., 20.01.] enthält wöchentlich: 01., 08., 15. → genau 3 Termine.
		const until = new Date('2026-01-20T00:00:00.000Z');
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

	// ── AK 4: erneute Generierung derselben Periode erzeugt keine Dublette (Idempotenz) ────────
	it('zweite Generierung desselben Fensters erzeugt keine Dubletten', async () => {
		const series = await Series.create({
			title: 'Kochen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const until = new Date('2026-01-20T00:00:00.000Z');

		const first = await generateDueInstances(series, { until });
		assert.equal(first.length, 3);

		const second = await generateDueInstances(series, { until });
		assert.equal(second.length, 0, 'bereits materialisierte Termine werden nicht erneut erzeugt');

		const total = await Task.count({ where: { seriesId: series.id } });
		assert.equal(total, 3, 'insgesamt bleiben es genau drei Instanzen');
	});

	// ── AK 4 (heikler Pfad, in #120 als WARNUNG markiert): Idempotenz hängt am unveränderlichen
	//    `seriesOccurrence`, NICHT an der `deadline`. Wird eine Instanz verschoben (AK 2) und dasselbe
	//    Fenster erneut generiert, darf KEINE Dublette für die verschobene Periode entstehen. Eine
	//    naive, an `deadline` verankerte Umsetzung bestünde alle anderen Tests, scheitert aber hier. ──
	it('verschobene Instanz wird im selben Fenster nicht dupliziert (Anker: seriesOccurrence)', async () => {
		const series = await Series.create({
			title: 'Aufräumen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const until = new Date('2026-01-20T00:00:00.000Z');

		const first = await generateDueInstances(series, { until });
		assert.equal(first.length, 3);

		// AK 2: eine Instanz verschieben (deadline ändern → isException). Der Idempotenz-Anker
		// `seriesOccurrence` bleibt dabei unverändert.
		const moved = first[0];
		const occurrence = new Date(moved.seriesOccurrence as unknown as Date).getTime();
		moved.deadline = new Date('2026-03-01T00:00:00.000Z');
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

	// ── AK 3: Template-Änderung gilt nur für künftige Instanzen ────────────────────────────────
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
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		// Pillar-Vorlage für die initiale Serie anlegen.
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillar.id, share: 100, confidence: 80 });

		// Erste Generierung mit Default-Priorität 2.
		const existing = await generateDueInstances(series, {
			until: new Date('2026-01-20T00:00:00.000Z'),
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

		// Künftiges Fenster generieren (21.01.–10.02.).
		const future = await generateDueInstances(series, {
			until: new Date('2026-02-10T00:00:00.000Z'),
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

	// ── AK 3 (Negativ): inaktives Template generiert keine Instanzen ───────────────────────────
	it('inaktives Template erzeugt keine Instanzen', async () => {
		const series = await Series.create({
			title: 'Pausiert',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: false,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const instances = await generateDueInstances(series, {
			until: new Date('2026-01-20T00:00:00.000Z'),
		});
		assert.equal(instances.length, 0);
	});

	// ── AK 2 (#295): Instanz erbt description + Pillars aus der Serien-Vorlage ─────────────────
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
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		await SeriesPillar.create({ seriesId: series.id, pillarId: pillarA.id, share: 70, confidence: 90 });
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillarB.id, share: 30, confidence: 60 });

		const instances = await generateDueInstances(series, {
			until: new Date('2026-01-01T00:00:00.000Z'),
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
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		const instances = await generateDueInstances(series, {
			until: new Date('2026-01-01T00:00:00.000Z'),
		});
		assert.equal(instances.length, 1, 'eine Instanz erzeugt');
		const instance = instances[0];

		assert.equal(instance.description, null, 'description ist null wenn im Template null');

		const taskPillars = await TaskPillar.findAll({ where: { taskId: instance.id } });
		assert.equal(taskPillars.length, 0, 'keine task_pillars wenn Vorlage leer');
	});

	// ── Monthly: korrekte Termine auch bei Monatsenden (z. B. 31.01. → 28.02., nicht 03.03.) ───────
	it('monthly mit Start am 31.01. erzeugt korrekte Termine (28.02., 31.03., 30.04.)', async () => {
		const series = await Series.create({
			title: 'Monatliche Prüfung',
			rhythm: 'monthly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			// Start am 31. Januar 2026 (Samstag)
			startDate: new Date('2026-01-31T00:00:00.000Z'),
		});

		// Fenster [31.01., 30.04.] → sollte 31.01., 28.02., 31.03., 30.04. enthalten (4 Termine)
		const until = new Date('2026-04-30T00:00:00.000Z');
		const instances = await generateDueInstances(series, { until });

		assert.equal(instances.length, 4, 'genau vier monatliche Instanzen');

		const deadlines = instances
			.map((t) => new Date(t.deadline as unknown as Date))
			.sort((a, b) => a.getTime() - b.getTime());

		// 31.01.2026
		assert.equal(deadlines[0].getUTCFullYear(), 2026);
		assert.equal(deadlines[0].getUTCMonth(), 0); // Januar (0-indexed)
		assert.equal(deadlines[0].getUTCDate(), 31);

		// 28.02.2026 (Februar hat 28 Tage im Jahr 2026)
		assert.equal(deadlines[1].getUTCFullYear(), 2026);
		assert.equal(deadlines[1].getUTCMonth(), 1); // Februar
		assert.equal(deadlines[1].getUTCDate(), 28, 'Februar-Termin ist der 28. (nicht 31.)');

		// 31.03.2026
		assert.equal(deadlines[2].getUTCFullYear(), 2026);
		assert.equal(deadlines[2].getUTCMonth(), 2); // März
		assert.equal(deadlines[2].getUTCDate(), 31);

		// 30.04.2026 (April hat 30 Tage)
		assert.equal(deadlines[3].getUTCFullYear(), 2026);
		assert.equal(deadlines[3].getUTCMonth(), 3); // April
		assert.equal(deadlines[3].getUTCDate(), 30, 'April-Termin ist der 30. (nicht 31.)');
	});
});

// Rote Spec-Tests für #244 — `materializeDueSeries` bündelt die Serien-Materialisierung serverseitig:
// es generiert die fälligen Instanzen ALLER aktiven Serien (optional auf einen User eingeschränkt) und
// isoliert Fehler einzelner Serien, sodass ein Ausreißer den Gesamtlauf nicht abbricht. KEIN Produktivcode.
describe('materializeDueSeries — Aggregat + Fehler-Isolation (AK6 #244)', () => {
	// ── AK6a: aggregiert über alle aktiven Serien, überspringt inaktive ─────────────────────────
	it('erzeugt Tasks für alle aktiven Serien und keine für inaktive', async () => {
		await Series.create({
			title: 'Aktiv A',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		await Series.create({
			title: 'Aktiv B',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const inactive = await Series.create({
			title: 'Inaktiv',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: false,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		// Fenster [01.01., 20.01.] → je aktiver Serie 3 wöchentliche Termine (01., 08., 15.).
		const until = new Date('2026-01-20T00:00:00.000Z');
		const created = await materializeDueSeries(undefined, until);

		assert.equal(created.length, 6, 'zwei aktive Serien × 3 Termine = 6 materialisierte Tasks');

		// Keine Instanz gehört zur inaktiven Serie.
		for (const task of created) {
			assert.notEqual(task.seriesId, inactive.id, 'keine Instanz stammt aus der inaktiven Serie');
		}
		const inactiveTasks = await Task.count({ where: { seriesId: inactive.id } });
		assert.equal(inactiveTasks, 0, 'die inaktive Serie erzeugt keine Tasks');
	});

	// ── AK6b: ein Fehler bei einer Serie bricht den Gesamtlauf nicht ab ──────────────────────────
	it('ein Fehler bei einer einzelnen Serie bricht den Gesamtlauf nicht ab', async () => {
		// Gute Serie: erzeugt regulär ihre Instanzen.
		const good = await Series.create({
			title: 'Gute Serie',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
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
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		await broken.update({ title: '' });

		const until = new Date('2026-01-20T00:00:00.000Z');

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
