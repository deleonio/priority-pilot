import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task } from '../models/index.js';
import { generateDueInstances } from './series.js';
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
			defaultPriority: 4,
			defaultEstimatedEffort: 0.5,
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
			defaultPriority: 3,
			defaultEstimatedEffort: 0.5,
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

	// ── AK 3: Template-Änderung gilt nur für künftige Instanzen ────────────────────────────────
	it('Template-Änderung wirkt nur auf künftige, nicht auf bestehende Instanzen', async () => {
		const series = await Series.create({
			title: 'Lesen',
			rhythm: 'weekly',
			defaultPriority: 2,
			defaultEstimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		// Erste Generierung mit Default-Priorität 2.
		const existing = await generateDueInstances(series, {
			until: new Date('2026-01-20T00:00:00.000Z'),
		});
		assert.equal(existing.length, 3);
		for (const inst of existing) {
			assert.equal(inst.priority, 2);
		}

		// Template ändern: künftige Instanzen sollen Priorität 5 erhalten.
		series.defaultPriority = 5;
		await series.save();

		// Künftiges Fenster generieren (21.01.–10.02.).
		const future = await generateDueInstances(series, {
			until: new Date('2026-02-10T00:00:00.000Z'),
		});
		assert.ok(future.length > 0, 'es entstehen neue künftige Instanzen');
		for (const inst of future) {
			assert.equal(inst.priority, 5, 'neue Instanzen tragen die geänderte Default-Priorität');
		}

		// Bestehende Instanzen bleiben unverändert bei Priorität 2.
		const oldInstances = await Task.findAll({
			where: { id: existing.map((t) => t.id) },
		});
		for (const inst of oldInstances) {
			assert.equal(inst.priority, 2, 'bestehende Instanzen behalten ihre alte Priorität');
		}
	});

	// ── AK 3 (Negativ): inaktives Template generiert keine Instanzen ───────────────────────────
	it('inaktives Template erzeugt keine Instanzen', async () => {
		const series = await Series.create({
			title: 'Pausiert',
			rhythm: 'weekly',
			defaultPriority: 3,
			defaultEstimatedEffort: 0.5,
			active: false,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const instances = await generateDueInstances(series, {
			until: new Date('2026-01-20T00:00:00.000Z'),
		});
		assert.equal(instances.length, 0);
	});
});
