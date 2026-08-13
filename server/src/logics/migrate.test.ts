import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Task } from '../models/index.js';
import {
	migrateSeriesColumns,
	migrateSeriesTable,
	migrateUserIdColumns,
	migratePillarDescription,
	migrateTaskChecklist,
} from './migrate.js';
import { SEED_PILLARS } from '../models/pillarData.js';
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

const SERIES_COLUMNS = ['seriesId', 'isException', 'seriesOccurrence', 'originSeriesId'] as const;
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
		assert.ok((await taskIndexes()).includes(UNIQUE_INDEX), `Unique-Index ${UNIQUE_INDEX} wurde angelegt`);
	});

	// ── AK4: Der Unique-Index bleibt auf der nachgezogenen Tabelle wirksam ──────────────────────
	it('hält den Unique-Constraint auf (seriesId, seriesOccurrence) auch nach der Migration ein', async () => {
		// Alt-Schema, migrieren, dann sync() (legt den Unique-Index an).
		await createLegacyTasksTable();
		await migrateSeriesColumns(sequelize);
		// `checklist` (#531) ist Teil des aktuellen Task-Modells und wird vom Task.create()-INSERT
		// mitgeschrieben — eigene Migration hier nachziehen, damit der Insert nicht an der fehlenden
		// Spalte bricht (nicht Teil der Serien-Spalten).
		await migrateTaskChecklist(sequelize);
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

// ── Rote Spec-Tests für #163 — fehlende Schema-Migration für die `series`-Tabelle ─────────────────
//
// Root Cause: Auf einer `series`-Tabelle, die VOR dem vollständigen Serien-Feature angelegt wurde,
// fehlen `title`, `rhythm`, `priority`, `estimatedEffort`, `active`, `startDate`.
// `sequelize.sync()` ohne `alter` ergänzt vorhandene Tabellen NICHT um neue Spalten → alle
// Series-CRUD-Operationen schlagen mit `SQLITE_ERROR: no such column: title` fehl (#163).
//
// Der Vertrag: eine idempotente Vorab-Migration `migrateSeriesTable(sequelize)`, die VOR
// `sequelize.sync()` die fehlenden Spalten per `ALTER TABLE series ADD COLUMN` nachzieht.
// Kein Produktivcode — Tests werden grün, sobald `migrate.ts` `migrateSeriesTable` exportiert.

const SERIES_TABLE_COLUMNS = [
	'title',
	'rhythm',
	'priority',
	'estimatedEffort',
	'active',
	'startDate',
	'description',
] as const;

const seriesColumns = async (): Promise<string[]> => {
	const [rows] = await sequelize.query("PRAGMA table_info('series')");
	return (rows as { name: string }[]).map((row) => row.name);
};

/**
 * Erzeugt eine `series`-Tabelle im Alt-Schema (vor dem vollständigen Serien-Feature) per Raw-SQL
 * mit nur `id`, `createdAt`, `updatedAt` — OHNE die Feature-Spalten. Bildet exakt eine
 * Bestands-`database.sqlite` nach, auf der die Migration greifen muss.
 */
const createLegacySeriesTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `series` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

describe('migrateSeriesTable', () => {
	// ── AK1: Migration auf Alt-Schema fügt die fehlenden Spalten nach ────────────────────────────
	it('zieht auf einem Alt-Schema die fehlenden Serien-Spalten nach, sodass sync() nicht mehr bricht', async () => {
		await createLegacySeriesTable();

		const before = await seriesColumns();
		for (const column of SERIES_TABLE_COLUMNS) {
			assert.ok(!before.includes(column), `Alt-Schema hat ${column} noch nicht`);
		}

		await migrateSeriesTable(sequelize);
		await assert.doesNotReject(() => sequelize.sync(), 'sync() bricht nach der Migration nicht mehr ab');

		const after = await seriesColumns();
		for (const column of SERIES_TABLE_COLUMNS) {
			assert.ok(after.includes(column), `Serien-Tabellenspalte ${column} wurde nachgezogen`);
		}
	});

	// ── AK5: Idempotenz — erneuter Lauf auf bereits migriertem Schema ist stabil ─────────────────
	it('ist idempotent: erneuter Aufruf wirft nicht und erzeugt keine doppelten Spalten', async () => {
		await sequelize.sync({ force: true });

		await assert.doesNotReject(() => migrateSeriesTable(sequelize), 'erster Lauf auf neuem Schema ist no-op');
		await assert.doesNotReject(() => migrateSeriesTable(sequelize), 'zweiter Lauf bleibt stabil');

		const columns = await seriesColumns();
		for (const column of SERIES_TABLE_COLUMNS) {
			const occurrences = columns.filter((name) => name === column).length;
			assert.equal(occurrences, 1, `${column} existiert genau einmal (keine Dublette)`);
		}
	});

	// ── Frische DB (Tabelle fehlt) ist No-op; sync() legt Tabelle korrekt an ────────────────────
	it('ist auf einer DB ohne series-Tabelle ein No-op und sync() legt die Tabelle korrekt an', async () => {
		assert.deepEqual(await seriesColumns(), [], 'Vorbedingung: keine series-Tabelle');

		await assert.doesNotReject(() => migrateSeriesTable(sequelize), 'Migration ohne Tabelle ist no-op');
		await assert.doesNotReject(() => sequelize.sync(), 'sync() legt die Tabelle frisch an');

		const columns = await seriesColumns();
		for (const column of SERIES_TABLE_COLUMNS) {
			assert.ok(columns.includes(column), `frische Tabelle enthält ${column}`);
		}
	});

	// ── AK1 (Verhalten): Nach Migration wirft Series.findAll() keinen SQLITE_ERROR mehr ──────────
	it('nach Migration antwortet Series.findAll() ohne SequelizeDatabaseError und gibt leere Liste zurück', async () => {
		await createLegacySeriesTable();
		await migrateSeriesTable(sequelize);
		await sequelize.sync();

		const { default: Series } = await import('../models/series.js');
		await assert.doesNotReject(() => Series.findAll(), 'Series.findAll() wirft keinen SQLITE_ERROR mehr');
		const rows = await Series.findAll();
		assert.deepEqual(rows, [], 'leere Liste (keine Serien in Bestands-DB)');
	});
});

// ── Rote Spec-Tests für #207 — fehlende Schema-Migration für die `userId`-Spalten ───────────────────
//
// Root Cause: Die Datenisolation (#207, AK5) ergab `userId` an `pillars` und `tasks` sowie den
// Unique-Index `pillars_name_user_id` auf (`name`, `userId`). Auf einer Bestands-DB, die vor #207
// angelegt wurde, fehlen diese Spalten. `sequelize.sync()` ohne `alter` ergänzt vorhandene Tabellen
// NICHT um neue Spalten, versucht aber den Unique-Index anzulegen → bricht mit
// `SQLITE_ERROR: no such column: userId` ab und verhindert den Server-Start.
//
// Der Vertrag: eine idempotente Vorab-Migration `migrateUserIdColumns(sequelize)`, die VOR
// `sequelize.sync()` die fehlenden Spalten per `ALTER TABLE ... ADD COLUMN` nachzieht. Kein
// Produktivcode — Tests werden grün, sobald `migrate.ts` `migrateUserIdColumns` exportiert.

/** Spaltennamen einer Tabelle (leer, falls die Tabelle nicht existiert). */
const columnsOf = async (table: string): Promise<string[]> => {
	const [rows] = await sequelize.query(`PRAGMA table_info('${table}')`);
	return (rows as { name: string }[]).map((row) => row.name);
};

/**
 * Erzeugt eine `tasks`-Tabelle im Alt-Schema direkt vor #207 (also NACH dem Serien-Feature
 * #120/#142, aber VOR der Datenisolation) per Raw-SQL — mit allen Series-Spalten, aber OHNE
 * `userId`. So kann `sync()` den Series-Unique-Index anlegen (Spalten vorhanden) und die Migration
 * muss nur noch `userId` nachziehen. Bildet exakt eine Bestands-`database.sqlite` nach, auf der die
 * Migration greifen muss.
 */
const createLegacyTasksTableBefore207 = async (): Promise<void> => {
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
			'`seriesId` INTEGER, ' +
			'`isException` INTEGER NOT NULL DEFAULT 0, ' +
			'`seriesOccurrence` DATETIME, ' +
			'`autoDeleteAfterDeadline` INTEGER NOT NULL DEFAULT 0, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

describe('migrateUserIdColumns', () => {
	// ── AK1: Migration auf Alt-Schema fügt die fehlende userId-Spalte an tasks nach (nur tasks —
	// pillars.userId zieht separat migratePillarPerUser (#421) nach).
	it('zieht auf einem Alt-Schema userId an tasks nach, sodass sync() nicht mehr bricht', async () => {
		await createLegacyTasksTableBefore207();

		assert.ok(!(await columnsOf('tasks')).includes('userId'), 'Alt-Schema von tasks hat userId noch nicht');

		await migrateUserIdColumns(sequelize);
		await assert.doesNotReject(() => sequelize.sync(), 'sync() bricht nach der Migration nicht mehr ab');

		assert.ok((await columnsOf('tasks')).includes('userId'), 'userId wurde an tasks nachgezogen');
	});

	// ── Idempotenz — erneuter Lauf auf bereits migriertem Schema ist stabil
	it('ist idempotent: erneuter Aufruf wirft nicht und erzeugt keine doppelten Spalten', async () => {
		await sequelize.sync({ force: true });

		await assert.doesNotReject(() => migrateUserIdColumns(sequelize), 'erster Lauf auf neuem Schema ist no-op');
		await assert.doesNotReject(() => migrateUserIdColumns(sequelize), 'zweiter Lauf bleibt stabil');

		const columns = await columnsOf('tasks');
		const occurrences = columns.filter((name) => name === 'userId').length;
		assert.equal(occurrences, 1, 'userId existiert an tasks genau einmal (keine Dublette)');
	});

	// ── Frische DB (tasks-Tabelle fehlt) ist No-op; sync() legt sie korrekt an
	it('ist auf einer DB ohne tasks-Tabelle ein No-op und sync() legt sie korrekt an', async () => {
		assert.deepEqual(await columnsOf('tasks'), [], 'Vorbedingung: keine tasks-Tabelle');

		await assert.doesNotReject(() => migrateUserIdColumns(sequelize), 'Migration ohne Tabelle ist no-op');
		await assert.doesNotReject(() => sequelize.sync(), 'sync() legt die Tabellen frisch an');

		assert.ok((await columnsOf('tasks')).includes('userId'), 'frische tasks-Tabelle enthält userId');
	});

	// ── Authentifizierte Query: Task.findAll({ where: { userId } }) bricht nicht mehr
	it('erlaubt nach Migration ein Task.findAll filtert nach userId ohne SQLITE_ERROR', async () => {
		await createLegacyTasksTableBefore207();
		await migrateUserIdColumns(sequelize);
		// `checklist` (#531) und `originSeriesId` (#553) werden von Task.findAll mitselektiert — hier
		// nachziehen, damit die Query nicht an der fehlenden Spalte bricht (separate Migrationen, nicht
		// Teil der userId-Spalten).
		await migrateTaskChecklist(sequelize);
		await migrateSeriesColumns(sequelize);
		await sequelize.sync();

		await assert.doesNotReject(
			() => Task.findAll({ where: { userId: 1 } }),
			'Task.findAll filtert nach userId ohne SQLITE_ERROR',
		);
	});
});

describe('migratePillarDescription', () => {
	/**
	 * Erzeugt eine `pillars`-Tabelle im Alt-Schema direkt vor dem description-Feature: mit `userId`
	 * (nach #207), aber OHNE `description`. Bildet eine Bestands-`database.sqlite` nach, auf der die
	 * Migration greifen muss.
	 */
	const createLegacyPillarsTableBeforeDescription = async (): Promise<void> => {
		await sequelize.query(
			'CREATE TABLE `pillars` (' +
				'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'`name` VARCHAR(255) NOT NULL, ' +
				'`weight` FLOAT NOT NULL DEFAULT 20, ' +
				'`userId` INTEGER, ' +
				'`createdAt` DATETIME NOT NULL, ' +
				'`updatedAt` DATETIME NOT NULL' +
				')',
		);
	};

	/** Legt die fünf Standard-Säulen (ohne description, wie im Alt-Stand) plus eine eigene Säule an. */
	const insertLegacyPillars = async (): Promise<void> => {
		const names = [...SEED_PILLARS.map((p) => p.name), 'Eigene Säule'];
		await sequelize.query(
			`INSERT INTO \`pillars\` (\`name\`, \`weight\`, \`createdAt\`, \`updatedAt\`) VALUES ` +
				names.map(() => '(?, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').join(', '),
			{ replacements: names },
		);
	};

	// ── AK1: Migration zieht die description-Spalte nach und backfillt die kanonischen Stammdaten
	it('zieht die description-Spalte nach und backfillt die fünf Standard-Säulen nach Namen', async () => {
		await createLegacyPillarsTableBeforeDescription();
		await insertLegacyPillars();

		assert.ok(!(await columnsOf('pillars')).includes('description'), 'Vorbedingung: keine description-Spalte');

		await migratePillarDescription(sequelize);

		assert.ok((await columnsOf('pillars')).includes('description'), 'description-Spalte wurde nachgezogen');

		// Die fünf Standard-Säulen erhalten ihre kanonische Kurzbeschreibung (Lookup nach Name).
		const [rows] = await sequelize.query('SELECT `name`, `description` FROM `pillars` ORDER BY `id`');
		const byName = new Map((rows as { name: string; description: string }[]).map((row) => [row.name, row.description]));
		for (const { name, description } of SEED_PILLARS) {
			assert.equal(byName.get(name), description, `Standard-Säule „${name}" hat ihre kanonische Beschreibung`);
		}
		// Eine nicht-kanonische Säule bleibt ohne Beschreibung (kein Treffer in SEED_PILLARS).
		assert.equal(byName.get('Eigene Säule'), '', 'nicht-kanonische Säule wird nicht überschrieben');
	});

	// ── Idempotenz — erneuter Lauf ist stabil und erzeugt keine Dubletten
	it('ist idempotent: erneuter Aufruf wirft nicht und legt description nicht doppelt an', async () => {
		await createLegacyPillarsTableBeforeDescription();
		await insertLegacyPillars();

		await migratePillarDescription(sequelize);
		await assert.doesNotReject(() => migratePillarDescription(sequelize), 'zweiter Lauf bleibt stabil');

		const occurrences = (await columnsOf('pillars')).filter((name) => name === 'description').length;
		assert.equal(occurrences, 1, 'description existiert genau einmal (keine Dublette)');
	});

	// ── Frische DB (Tabelle fehlt) ist No-op
	it('ist auf einer DB ohne pillars-Tabelle ein No-op', async () => {
		assert.deepEqual(await columnsOf('pillars'), [], 'Vorbedingung: keine pillars-Tabelle');
		await assert.doesNotReject(() => migratePillarDescription(sequelize), 'Migration ohne Tabelle ist no-op');
	});
});

// Hinweis: Die frühere Suite `migratePillarDropUserId` wurde mit #421 entfernt. Säulen sind wieder
// nutzer-eigen (Spalte `userId` + Unique-Index `pillars_name_user_id`); die Umstellung deckt
// `migrate-pillar-per-user.test.ts` ab. Die alte Drop-Migration widerspricht dem neuen Modell und ist
// mit ihr entfallen.
