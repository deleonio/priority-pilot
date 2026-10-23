import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { DataTypes } from 'sequelize';
import {
	Dependency,
	Invoice,
	Pillar,
	PillarFeedback,
	PlaceFavorite,
	ScoreEntry,
	Series,
	SeriesPillar,
	Task,
	TaskPillar,
	User,
} from './index.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

// Spiegel-Tests für #2826 (ADR 0026): die Modell-Typen müssen unter MariaDB korrekt anlegbar
// sein. Sie lesen die Attribute über `getAttributes()` und machen Typ-Fehler als Assertions-
// fehler sichtbar, BEVOR `sync()` unter MariaDB bricht. Der echte MariaDB-Lauf (AK7) bleibt
// manuelle PR-Prüfliste (TF4, ADR 0026 — automatisierter Smoke in Folgeticket).

/** Liest die Längen-Option eines Sequelize-Typs (dialektabhängig in options oder direkt). */
function typeLength(type: unknown): string | undefined {
	const t = type as { options?: { length?: unknown }; length?: unknown };
	const v = t.options?.length ?? t.length;
	if (typeof v === 'number') return String(v);
	return typeof v === 'string' ? v.toLowerCase() : undefined;
}

describe('Typ-Audit #2826 — FLOAT zu DOUBLE (AK1)', () => {
	type Modell = { getAttributes(): Record<string, { type?: unknown }> };
	const DOUBLE_SPALTEN: Array<[Modell, string]> = [
		[Task, 'estimatedEffort'],
		[Task, 'actualEffort'],
		[Task, 'latitude'],
		[Task, 'longitude'],
		[Series, 'estimatedEffort'],
		[Series, 'latitude'],
		[Series, 'longitude'],
		[TaskPillar, 'share'],
		[TaskPillar, 'confidence'],
		[SeriesPillar, 'share'],
		[SeriesPillar, 'confidence'],
		[Pillar, 'weight'],
		[ScoreEntry, 'punkte'],
		[Dependency, 'weight'],
		[PlaceFavorite, 'latitude'],
		[PlaceFavorite, 'longitude'],
		[User, 'lastGeoLatitude'],
		[User, 'lastGeoLongitude'],
	];

	it('alle 18 FLOAT-Spalten melden DataTypes.DOUBLE', () => {
		assert.equal(DOUBLE_SPALTEN.length, 18, 'die Spaltenliste deckt alle FLOAT-Stellen ab');
		for (const [model, spalte] of DOUBLE_SPALTEN) {
			const type = model.getAttributes()[spalte]?.type;
			assert.ok(type, `${spalte} existiert am Modell`);
			assert.ok(
				type instanceof DataTypes.DOUBLE,
				`Spalte "${spalte}" ist ${String(type)} — MariaDB-FLOAT ist unzuverlässig, erwartet DOUBLE (ADR 0026)`,
			);
		}
	});
});

describe('Typ-Audit #2826 — DATE(3) für seriesOccurrence (AK2)', () => {
	it('tasks.seriesOccurrence trägt Millisekunden-Präzision DATE(3)', () => {
		const type = Task.getAttributes().seriesOccurrence?.type;
		assert.ok(type instanceof DataTypes.DATE, 'seriesOccurrence bleibt eine DATE-Spalte');
		const fracs = typeLength(type);
		assert.ok(
			fracs === '3' || /\(3\)/.test(String(type)),
			`seriesOccurrence ist ${String(type)} — ohne DATE(3) verliert MariaDB die Millisekunden`,
		);
	});

	it('Roundtrip: Millisekunden überleben Save/Reload identisch (TF2)', async () => {
		const serie = await Series.create({
			title: 'Rhythmusquelle',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});
		const ts = new Date('2026-05-06T07:08:09.123Z');
		await Task.create({
			title: 'Okkurrenz',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			seriesId: serie.id,
			seriesOccurrence: ts,
		});
		const back = await Task.findOne({ where: { seriesId: serie.id } });
		assert.ok(back?.seriesOccurrence, 'seriesOccurrence wurde gespeichert');
		assert.equal(back.seriesOccurrence.getTime(), ts.getTime(), 'Millisekunden bleiben erhalten');
	});
});

describe('Typ-Audit #2826 — JSON und BLOB (AK5)', () => {
	it('die vier JSON-Spalten bleiben DataTypes.JSON (Spiegel gegen den Typwechsel)', () => {
		for (const type of [
			Task.getAttributes().checklist?.type,
			Series.getAttributes().checklist?.type,
			Invoice.getAttributes().lineItems?.type,
			PillarFeedback.getAttributes().pillars?.type,
		]) {
			assert.ok(type instanceof DataTypes.JSON, `JSON-Spalte bleibt JSON (ist ${String(type)})`);
		}
	});

	it('invoices.pdfBytes ist mindestens MEDIUMBLOB (MariaDB-BLOB endet bei 64 KB)', () => {
		const type = Invoice.getAttributes().pdfBytes?.type;
		assert.ok(type instanceof DataTypes.BLOB, 'pdfBytes bleibt eine BLOB-Spalte');
		const len = typeLength(type);
		assert.ok(
			len === 'medium' || /mediumblob/i.test(String(type)),
			`pdfBytes ist ${String(type)} — zu klein für Rechnungs-PDFs, erwartet MEDIUMBLOB`,
		);
	});

	it('Task.checklist-Roundtrip: Einträge kommen deep-equal zurück (TF3)', async () => {
		const liste = [
			{ id: 'c1', title: 'Schritt eins' },
			{ id: 'c2', title: 'Schritt zwei' },
		];
		await Task.create({ title: 'Checkliste', status: 'Open', priority: 3, checklist: liste });
		const back = await Task.findOne({ where: { title: 'Checkliste' } });
		assert.deepEqual(
			(back as unknown as { checklist?: unknown }).checklist,
			liste,
			'JSON-checklist überlebt den Speicher-Roundtrip unverändert',
		);
	});
});
