import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Task } from '../models/index.js';
import { migrateSeriesColumns } from './migrate.js';
import { closeDb } from '../test/helpers.js';

// Rote Spec-Tests für #146 — fehlende Schema-Migration für die Serien-Spalten.
//
// Root Cause: Auf einer `tasks`-Tabelle, die VOR dem Serien-Feature (#120/#142) angelegt wurde,
// fehlen `seriesId`, `isException`, `seriesOccurrence`. `sequelize.sync()` ohne `alter` ergänzt
// bestehende Tabellen NICHT um neue Spalten, versucht aber den Unique-Index
// `tasks_series_id_series_occurrence` auf (`seriesId`, `seriesOccurrence`) anzulegen → bricht mit
// `SQLITE_ERROR: no such column: seriesId` ab.
//
// Der Vertrag: eine idempotente Vorab-Migration `migrateSeriesColumns(sequelize)`, die — analog zu
// `migrateLegacySinglePillar` — VOR `sequelize.sync()` die fehlenden Spalten per
// `ALTER TABLE tasks ADD COLUMN` nachzieht. Es wird KEIN Produktivcode geschrieben; die Tests
// werden grün, sobald `server/src/logics/migrate.ts` mit `migrateSeriesColumns` existiert.

const SERIES_COLUMNS = ['seriesId', 'isException', 'seriesOccurrence'] as const;
const UNIQUE_INDEX = 'tasks_series_id_series_occurrence';

/** Spaltennamen der `tasks`-Tabelle (leer, falls die Tabelle nicht existiert). */
const taskColumns = async (): Promise<string[]> => {
	const [rows] = await sequelize.query("PRAGMA table_info('tasks')");
	return (rows as { name: string }[]).map((row) => row.name);
};

/** Index-Namen der `tasks`-Tabelle. */
const taskIndexes = async (): Promise<string[]> => {
	const [rows] = await sequelize.query("PRAGMA index_list('tasks')");
	return (rows as { name: string }[]).map((row) => row.name);
};

/**
 * Erzeugt eine `tasks`-Tabelle im **Alt-Schema** (vor dem Serien-Feature) per Raw-SQL — also OHNE
 * die Serien-Spalten und ohne den Unique-Index. Bildet damit exakt eine Bestands-`database.sqlite`
 * nach, auf der die Migration greifen muss.
 */
const createLegacyTasksTable = async (): Promise<void> => {
	await sequelize.getQueryInterface().dropAllTables();
	await sequelize.query(
		'CREATE TABLE `tasks` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			"`status` TEXT NOT NULL DEFAULT 'Open', " +
			'`title` VARCHAR(255) NOT NULL, ' +
			'`priority` INTEGER NOT NULL DEFAULT 3, ' +
			'`estimatedEffort` FLOAT NOT NULL DEFAULT 0.5, ' +
			'`actualEffort` FLOAT, ' +
			'`description` TEXT, ' +
			'`deadline` DATETIME, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

beforeEach(async () => {
	// Sauberer Ausgangszustand: alle Tabellen entfernen, jeder Test baut sein Szenario selbst auf.
	await sequelize.getQueryInterface().dropAllTables();
});
after(closeDb);

describe('migrateSeriesColumns', () => {
	// ── AK1: Migration auf Alt-Schema fügt die fehlenden Serien-Spalten nach ────────────────────
	it('zieht auf einem Alt-Schema die Serien-Spalten nach, sodass sync() nicht mehr bricht', async () => {
		await createLegacyTasksTable();

		// Vorbedingung: das Alt-Schema hat KEINE der Serien-Spalten.
		const before = await taskColumns();
		for (const column of SERIES_COLUMNS) {
			assert.ok(!before.includes(column), `Alt-Schema hat ${column} noch nicht`);
		}

		// Migration vor sync() — danach darf sync() den Unique-Index ohne Fehler anlegen.
		await migrateSeriesColumns(sequelize);
		await assert.doesNotReject(() => sequelize.sync(), 'sync() bricht nach der Migration nicht mehr ab');

		const after = await taskColumns();
		for (const column of SERIES_COLUMNS) {
			assert.ok(after.includes(column), `Serien-Spalte ${column} wurde nachgezogen`);
		}
	});

	// ── AK2: Idempotenz — erneuter Lauf auf bereits migriertem Schema ist stabil ────────────────
	it('ist idempotent: erneuter Aufruf wirft nicht und erzeugt keine doppelten Spalten', async () => {
		// Volles, aktuelles Schema (enthält die Serien-Spalten bereits).
		await sequelize.sync({ force: true });

		await assert.doesNotReject(() => migrateSeriesColumns(sequelize), 'erster Lauf auf neuem Schema ist no-op');
		await assert.doesNotReject(() => migrateSeriesColumns(sequelize), 'zweiter Lauf bleibt stabil');

		const columns = await taskColumns();
		for (const column of SERIES_COLUMNS) {
			const occurrences = columns.filter((name) => name === column).length;
			assert.equal(occurrences, 1, `${column} existiert genau einmal (keine Dublette)`);
		}
	});

	// ── AK3: Frische DB (Tabelle fehlt) ist No-op; sync() legt Tabelle + Unique-Index an ─────────
	it('ist auf einer DB ohne tasks-Tabelle ein No-op und sync() legt Tabelle inkl. Unique-Index an', async () => {
		// Keine tasks-Tabelle vorhanden (durch beforeEach bereits gedroppt).
		assert.deepEqual(await taskColumns(), [], 'Vorbedingung: keine tasks-Tabelle');

		await assert.doesNotReject(() => migrateSeriesColumns(sequelize), 'Migration ohne Tabelle ist no-op');
		await assert.doesNotReject(() => sequelize.sync(), 'sync() legt die Tabelle frisch an');

		const columns = await taskColumns();
		for (const column of SERIES_COLUMNS) {
			assert.ok(columns.includes(column), `frische Tabelle enthält ${column}`);
		}
		assert.ok(
			(await taskIndexes()).includes(UNIQUE_INDEX),
			`Unique-Index ${UNIQUE_INDEX} wurde angelegt`,
		);
	});

	// ── AK4: Der Unique-Index bleibt auf der nachgezogenen Tabelle wirksam ──────────────────────
	it('hält den Unique-Constraint auf (seriesId, seriesOccurrence) auch nach der Migration ein', async () => {
		// Alt-Schema, migrieren, dann sync() (legt den Unique-Index an).
		await createLegacyTasksTable();
		await migrateSeriesColumns(sequelize);
		await sequelize.sync();

		const occurrence = new Date('2026-01-01T00:00:00.000Z');
		await Task.create({ title: 'Serien-Instanz 1', seriesId: 1, seriesOccurrence: occurrence });

		// Zweiter Task mit identischem (seriesId, seriesOccurrence) verletzt den Unique-Index.
		await assert.rejects(
			() => Task.create({ title: 'Serien-Instanz 2', seriesId: 1, seriesOccurrence: occurrence }),
			'zweiter Insert derselben Periode verletzt den Unique-Constraint',
		);

		const total = await Task.count({ where: { seriesId: 1 } });
		assert.equal(total, 1, 'nur die erste Instanz der Periode wurde materialisiert');
	});
});
