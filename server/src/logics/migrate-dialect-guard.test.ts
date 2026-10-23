import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Sequelize } from 'sequelize';
import { migratePillarPerUser, migratePillarRestore, migrateSeriesRenameFields } from './migrate.js';

// Rote Spec-Tests für #2825 — AK3 (docs/spec/issue-2825.md).
//
// Unter Dialekt mysql dürfen die Legacy-Migrationen ihre SQLite-exklusiven Roh-SQL-Pfade
// (PRAGMA, sqlite_master) nicht senden; unter sqlite bleibt das Verhalten unverändert. Die
// Funktionen sind heute dialect-blind — die mysql-Fälle schlagen deshalb als Assertion rot.
// Der Spy-Sequelize reicht getDialect() durch und zeichnet query()-Aufrufe auf; es findet kein
// echter Verbindungsaufbau statt.

type QueryRecordingSequelize = {
	getDialect: () => 'mysql' | 'sqlite';
	query: (sql: string) => Promise<[unknown[], unknown]>;
	queries: string[];
};

const spySequelize = (dialect: 'mysql' | 'sqlite'): QueryRecordingSequelize => {
	const spy: QueryRecordingSequelize = {
		getDialect: () => dialect,
		queries: [],
		query: async (sql: string) => {
			spy.queries.push(sql);
			return [[], []];
		},
	};
	return spy;
};

const legacyMigrations = [
	['migrateSeriesRenameFields', migrateSeriesRenameFields],
	['migratePillarPerUser', migratePillarPerUser],
	['migratePillarRestore', migratePillarRestore],
] as const;

describe('Legacy-Migrationen je Dialekt (#2825 AK3)', () => {
	for (const [name, migrate] of legacyMigrations) {
		it(`${name} sendet unter mysql keine PRAGMA-/sqlite_master-Abfrage`, async () => {
			const spy = spySequelize('mysql');
			await (migrate as (seq: Sequelize) => Promise<void>)(spy as unknown as Sequelize);
			assert.deepEqual(spy.queries, []);
		});
	}

	it('Kontrollfall: unter sqlite läuft migrateSeriesRenameFields unverändert und fragt das Schema ab', async () => {
		const spy = spySequelize('sqlite');
		await migrateSeriesRenameFields(spy as unknown as Sequelize);
		assert.ok(spy.queries.length >= 1, 'Unter sqlite erwartet die Migration ihre Schema-Abfrage');
	});
});
