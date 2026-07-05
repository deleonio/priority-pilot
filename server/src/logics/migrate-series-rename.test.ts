import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { migrateSeriesRenameFields } from './migrate.js';
import { closeDb } from '../test/helpers.js';

// Rote Spec-Tests für #300 — AK-A1.1: idempotente Rename-Migration
// defaultPriority → priority, defaultEstimatedEffort → estimatedEffort an der series-Tabelle.
//
// migrateSeriesRenameFields existiert noch nicht — der Import-Fehler ist die legitime Rotfärbung.
// Die Tests werden grün, sobald migrate.ts die Funktion exportiert.

const seriesColumns = async (): Promise<string[]> => {
	const [rows] = await sequelize.query("PRAGMA table_info('series')");
	return (rows as { name: string }[]).map((row) => row.name);
};

/**
 * Erzeugt eine series-Tabelle im Alt-Schema mit defaultPriority/defaultEstimatedEffort.
 * Bildet exakt eine Bestands-database.sqlite nach, die vor dem Rename-Feature (#300) angelegt wurde.
 */
const createLegacySeriesWithOldFields = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `series` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			"`title` VARCHAR(255) NOT NULL DEFAULT '', " +
			"`rhythm` TEXT NOT NULL DEFAULT 'weekly', " +
			'`defaultPriority` INTEGER NOT NULL DEFAULT 3, ' +
			'`defaultEstimatedEffort` FLOAT NOT NULL DEFAULT 0.5, ' +
			'`active` INTEGER NOT NULL DEFAULT 1, ' +
			'`startDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
			'`userId` INTEGER, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

beforeEach(async () => {
	await sequelize.getQueryInterface().dropAllTables();
});
after(closeDb);

describe('migrateSeriesRenameFields', () => {
	// ── AK-A1.1: Bestands-DB — Spalten werden umbenannt, Bestandswerte erhalten ─────────────────
	it('benennt defaultPriority → priority und defaultEstimatedEffort → estimatedEffort um; Bestandswerte bleiben erhalten', async () => {
		await createLegacySeriesWithOldFields();
		await sequelize.query(
			'INSERT INTO `series` (`title`, `rhythm`, `defaultPriority`, `defaultEstimatedEffort`, `active`, `startDate`, `createdAt`, `updatedAt`) ' +
				"VALUES ('Test-Serie', 'weekly', 4, 0.8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		);

		const before = await seriesColumns();
		assert.ok(before.includes('defaultPriority'), 'Vorbedingung: defaultPriority vorhanden');
		assert.ok(before.includes('defaultEstimatedEffort'), 'Vorbedingung: defaultEstimatedEffort vorhanden');
		assert.ok(!before.includes('priority'), 'Vorbedingung: priority noch nicht vorhanden');
		assert.ok(!before.includes('estimatedEffort'), 'Vorbedingung: estimatedEffort noch nicht vorhanden');

		await migrateSeriesRenameFields(sequelize);

		const after = await seriesColumns();
		assert.ok(after.includes('priority'), 'priority-Spalte nach Migration vorhanden');
		assert.ok(after.includes('estimatedEffort'), 'estimatedEffort-Spalte nach Migration vorhanden');
		assert.ok(!after.includes('defaultPriority'), 'defaultPriority-Spalte nach Migration entfernt');
		assert.ok(!after.includes('defaultEstimatedEffort'), 'defaultEstimatedEffort-Spalte nach Migration entfernt');

		// Werterhalt: ursprüngliche Werte müssen unter den neuen Spaltennamen lesbar sein.
		const [rows] = await sequelize.query('SELECT `priority`, `estimatedEffort` FROM `series` LIMIT 1');
		const row = (rows as Array<{ priority: number; estimatedEffort: number }>)[0];
		assert.equal(row.priority, 4, 'Bestandswert priority=4 bleibt erhalten');
		assert.equal(row.estimatedEffort, 0.8, 'Bestandswert estimatedEffort=0.8 bleibt erhalten');
	});

	// ── AK-A1.1: Idempotenz — zweiter Lauf ist No-Op, keine Dubletten ───────────────────────────
	it('ist idempotent: erneuter Aufruf wirft nicht und erzeugt keine doppelten Spalten', async () => {
		await createLegacySeriesWithOldFields();
		await migrateSeriesRenameFields(sequelize);
		await assert.doesNotReject(() => migrateSeriesRenameFields(sequelize), 'zweiter Lauf bleibt stabil');

		const columns = await seriesColumns();
		assert.equal(columns.filter((c) => c === 'priority').length, 1, 'priority existiert genau einmal');
		assert.equal(columns.filter((c) => c === 'estimatedEffort').length, 1, 'estimatedEffort existiert genau einmal');
		assert.ok(!columns.includes('defaultPriority'), 'defaultPriority nicht mehr vorhanden');
		assert.ok(!columns.includes('defaultEstimatedEffort'), 'defaultEstimatedEffort nicht mehr vorhanden');
	});

	// ── AK-A1.1 Negativ-Kontrolle: frische DB → sync() → keine alten Feldnamen ─────────────────
	it('ist auf einer DB ohne series-Tabelle ein No-op; sync() legt priority/estimatedEffort an, nicht die alten Namen', async () => {
		assert.deepEqual(await seriesColumns(), [], 'Vorbedingung: keine series-Tabelle');

		await assert.doesNotReject(() => migrateSeriesRenameFields(sequelize), 'Migration ohne Tabelle ist no-op');
		await assert.doesNotReject(() => sequelize.sync(), 'sync() legt die Tabelle frisch an');

		const columns = await seriesColumns();
		assert.ok(columns.includes('priority'), 'frische Tabelle enthält priority');
		assert.ok(columns.includes('estimatedEffort'), 'frische Tabelle enthält estimatedEffort');
		assert.ok(!columns.includes('defaultPriority'), 'frische Tabelle enthält KEIN defaultPriority');
		assert.ok(!columns.includes('defaultEstimatedEffort'), 'frische Tabelle enthält KEIN defaultEstimatedEffort');
	});
});
