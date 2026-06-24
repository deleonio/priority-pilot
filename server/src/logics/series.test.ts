import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Pillar, Series } from '../models/index.js';
import { generateDueInstances, HORIZONT_TAGE } from './series.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

// Formatiert ein Datum (Date oder ISO-String) auf den reinen Kalendertag in UTC (YYYY-MM-DD),
// damit Vergleiche unabhängig von Uhrzeit/Zeitzone sind.
const tag = (d: Date | string): string => new Date(d).toISOString().slice(0, 10);

// Anker der Serie: Montag, 01.06.2026. Wöchentliche Termine fallen damit auf jeden Montag.
const STARTDATE = '2026-06-01';

// Festes „now" für deterministische Tests: Mittwoch, 24.06.2026.
// Horizont = 14 Tage ⇒ Fenster [2026-06-24, 2026-07-08].
// Montage im Fenster (innen, nicht auf den Rändern): 2026-06-29 und 2026-07-06.
const NOW = new Date('2026-06-24T12:00:00.000Z');

// Fenster nach 14 Tagen rollierend weiter: [2026-07-08, 2026-07-22].
// Neue Montage: 2026-07-13 und 2026-07-20.
const NOW_PLUS_HORIZONT = new Date('2026-07-08T12:00:00.000Z');

const createWeeklyTemplate = (overrides: Record<string, unknown> = {}) =>
	Series.create({
		frequency: 'WEEKLY',
		interval: 1,
		startDate: STARTDATE,
		defaultPriority: 3,
		active: true,
		...overrides,
	});

describe('generateDueInstances', () => {
	it('HORIZONT_TAGE ist die benannte Konstante 14', () => {
		assert.equal(HORIZONT_TAGE, 14);
	});

	// AC1: je fälligem Termin im Horizont genau EIN Task mit seriesId, eigener deadline,
	// gesetztem seriesOccurrence.
	it('AC1: erzeugt je fälligem Termin genau eine Instanz mit seriesId, deadline & seriesOccurrence', async () => {
		const series = await createWeeklyTemplate();
		await generateDueInstances(series, NOW);

		const instanzen = await Task.findAll({ where: { seriesId: series.id }, order: [['seriesOccurrence', 'ASC']] });
		assert.equal(instanzen.length, 2);

		// Erwartete Termine im Horizont (Montage 29.06. und 06.07.).
		assert.deepEqual(
			instanzen.map((t) => tag(t.seriesOccurrence as Date)),
			['2026-06-29', '2026-07-06'],
		);

		for (const inst of instanzen) {
			assert.equal(inst.seriesId, series.id);
			assert.ok(inst.deadline != null, 'Instanz braucht eine eigene deadline');
			assert.ok(inst.seriesOccurrence != null, 'Instanz braucht gesetztes seriesOccurrence');
			// Die Instanz übernimmt die Default-Priorität des Templates.
			assert.equal(inst.priority, 3);
		}
	});

	// AC4: dieselbe Periode erneut generiert ⇒ keine Dublette (Idempotenz über (seriesId, seriesOccurrence)).
	it('AC4: erneutes Generieren derselben Periode erzeugt keine Dubletten', async () => {
		const series = await createWeeklyTemplate();
		await generateDueInstances(series, NOW);
		await generateDueInstances(series, NOW);

		const instanzen = await Task.findAll({ where: { seriesId: series.id } });
		assert.equal(instanzen.length, 2);

		// Jeder Occurrence-Schlüssel kommt genau einmal vor.
		const keys = instanzen.map((t) => tag(t.seriesOccurrence as Date));
		assert.equal(new Set(keys).size, keys.length);
	});

	// AC3: geändertes Template wirkt nur auf KÜNFTIGE (noch nicht materialisierte) Termine;
	// bestehende Instanzen bleiben unberührt.
	it('AC3: Template-Änderung wirkt nur auf künftige Termine, bestehende Instanzen unverändert', async () => {
		const series = await createWeeklyTemplate({ defaultPriority: 3 });
		await generateDueInstances(series, NOW);

		const bestehende = await Task.findAll({ where: { seriesId: series.id } });
		assert.equal(bestehende.length, 2);
		const bestehendeIds = bestehende.map((t) => t.id).sort((a, b) => a - b);

		// Template ändern und das Fenster rollierend weiterschieben.
		series.defaultPriority = 5;
		await series.save();
		await generateDueInstances(series, NOW_PLUS_HORIZONT);

		// Bestehende Instanzen behalten ihre alte Priorität.
		for (const id of bestehendeIds) {
			const reloaded = await Task.findByPk(id);
			assert.equal(reloaded?.priority, 3, 'bestehende Instanz darf sich nicht rückwirkend ändern');
		}

		// Neue (künftige) Instanzen tragen die geänderte Priorität.
		const neue = await Task.findAll({
			where: { seriesId: series.id },
			order: [['seriesOccurrence', 'ASC']],
		});
		const neueTermine = neue.filter((t) => !bestehendeIds.includes(t.id));
		assert.equal(neueTermine.length, 2);
		assert.deepEqual(
			neueTermine.map((t) => tag(t.seriesOccurrence as Date)),
			['2026-07-13', '2026-07-20'],
		);
		for (const inst of neueTermine) {
			assert.equal(inst.priority, 5, 'künftige Instanz muss das geänderte Template widerspiegeln');
		}
	});

	// AC3 (Entkopplung): Die Säulen der Instanz sind ein SNAPSHOT aus dem Template.
	it('AC3: Säulen werden als Snapshot aus dem Template auf die Instanz kopiert', async () => {
		const koerper = await Pillar.create({ name: 'Körper', weight: 20 });
		const series = await createWeeklyTemplate();
		// Template-Säule (n:m über series_pillars, analog task_pillars).
		await series.addPillar(koerper, { through: { share: 100, confidence: 80 } });

		await generateDueInstances(series, NOW);

		const instanz = await Task.findOne({ where: { seriesId: series.id } });
		assert.ok(instanz, 'es muss eine Instanz erzeugt worden sein');
		const saeulen = await instanz!.getPillars();
		assert.equal(saeulen.length, 1);
		assert.equal(saeulen[0].id, koerper.id);
		assert.equal(saeulen[0].TaskPillar.share, 100);
		assert.equal(saeulen[0].TaskPillar.confidence, 80);
	});

	it('inaktive Serie (active=false) erzeugt keine Instanzen', async () => {
		const series = await createWeeklyTemplate({ active: false });
		await generateDueInstances(series, NOW);
		const instanzen = await Task.findAll({ where: { seriesId: series.id } });
		assert.equal(instanzen.length, 0);
	});
});
