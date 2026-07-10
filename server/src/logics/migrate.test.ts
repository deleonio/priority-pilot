import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Task } from '../models/index.js';
import {
	migrateSeriesColumns,
	migrateSeriesTable,
	migrateUserIdColumns,
	migratePillarDescription,
	migratePillarAddUserId,
	migratePillarsPerUser,
	seedPillarsForUser,
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
		assert.ok((await taskIndexes()).includes(UNIQUE_INDEX), `Unique-Index ${UNIQUE_INDEX} wurde angelegt`);
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

/** Index-Namen einer Tabelle. */
const indexesOf = async (table: string): Promise<string[]> => {
	const [rows] = await sequelize.query(`PRAGMA index_list('${table}')`);
	return (rows as { name: string }[]).map((row) => row.name);
};

/**
 * Erzeugt eine `pillars`-Tabelle im Alt-Schema (vor #207) per Raw-SQL — mit `id`, `name`, `weight`
 * und Zeitstempeln, aber OHNE `userId`. Bildet exakt eine Bestands-`database.sqlite` nach, auf der
 * die Migration greifen muss (damit sync() den Unique-Index anlegen kann).
 */
const createLegacyPillarsTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `pillars` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			'`name` VARCHAR(255) NOT NULL, ' +
			'`weight` FLOAT NOT NULL DEFAULT 20, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
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
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

describe('migrateUserIdColumns', () => {
	// ── AK1: Migration auf Alt-Schema fügt die fehlende userId-Spalte an tasks nach (nur noch tasks —
	// pillars.userId wurde mit dem Säulen-Cleanup entfernt, siehe migratePillarDropUserId).
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

describe('migratePillarAddUserId (#427)', () => {
	/**
	 * Erzeugt eine `pillars`-Tabelle im Stand VOR #427 (globale Säulen): OHNE `userId`-Spalte, mit dem
	 * global eindeutigen Unique-Index `pillars_name` auf (`name`). Bildet eine Bestands-`database.sqlite`
	 * nach, auf der die Migration greifen muss (damit sync() den neuen (name, userId)-Index anlegen kann).
	 */
	const createLegacyGlobalPillars = async (): Promise<void> => {
		await createLegacyPillarsTable(); // Alt-Schema ohne userId
		await sequelize.query('CREATE UNIQUE INDEX `pillars_name` ON `pillars`(`name`)');
	};

	// ── AK: Migration ergänzt userId-Spalte und stellt den Unique-Index auf (name, userId) um
	it('ergänzt die userId-Spalte und stellt den Unique-Index auf (name, userId) um', async () => {
		await createLegacyGlobalPillars();
		assert.ok(!(await columnsOf('pillars')).includes('userId'), 'Vorbedingung: userId noch nicht vorhanden');

		await migratePillarAddUserId(sequelize);
		await sequelize.sync();

		const columns = await columnsOf('pillars');
		assert.ok(columns.includes('userId'), 'userId-Spalte wurde nachgezogen');
		// Der neue, zusammengesetzte Index existiert (ob von der Migration oder sync() angelegt).
		assert.ok(
			(await indexesOf('pillars')).includes('pillars_name_user_id'),
			'der (name, userId)-Index pillars_name_user_id existiert',
		);
		// Der alte (name)-Index ist weg.
		assert.ok(!(await indexesOf('pillars')).includes('pillars_name'), 'der alte Index pillars_name wurde gedroppt');
	});

	// ── Idempotenz — erneuter Lauf ist stabil
	it('ist idempotent: erneuter Aufruf wirft nicht', async () => {
		await createLegacyGlobalPillars();
		await migratePillarAddUserId(sequelize);
		await assert.doesNotReject(() => migratePillarAddUserId(sequelize), 'zweiter Lauf bleibt stabil');
	});

	// ── No-op, wenn userId-Spalte bereits vorhanden ist (bereits migrierte DB)
	it('ist ein No-op, wenn pillars bereits eine userId-Spalte hat', async () => {
		await sequelize.sync({ force: true }); // aktuelles Modell → userId vorhanden
		assert.ok((await columnsOf('pillars')).includes('userId'), 'Vorbedingung: userId vorhanden');

		await assert.doesNotReject(() => migratePillarAddUserId(sequelize), 'Migration ist no-op');
		assert.ok((await columnsOf('pillars')).includes('userId'), 'userId-Spalte bleibt erhalten');
	});

	// ── No-op bei fehlender Tabelle (frische DB → sync() übernimmt)
	it('ist auf einer DB ohne pillars-Tabelle ein No-op', async () => {
		assert.deepEqual(await columnsOf('pillars'), [], 'Vorbedingung: keine pillars-Tabelle');
		await assert.doesNotReject(() => migratePillarAddUserId(sequelize), 'Migration ohne Tabelle ist no-op');
	});

	// ── Verhalten: nach der Migration ist der Säulenname PRO NUTZER eindeutig (Raw-Insert)
	it('erlaubt nach Migration+sync denselben Namen je Nutzer genau einmal', async () => {
		await createLegacyGlobalPillars();
		await migratePillarDescription(sequelize); // description-Spalte (NOT NULL) nachziehen
		await migratePillarAddUserId(sequelize);
		await sequelize.sync();

		const insert = (name: string, userId: number) =>
			sequelize.query(
				'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
					"VALUES (?, 20, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				{ replacements: [name, userId] },
			);

		await assert.doesNotReject(() => insert('Körper', 1), 'erster Insert (Nutzer 1) klappt');
		await assert.doesNotReject(() => insert('Körper', 2), 'gleicher Name für Nutzer 2 ist erlaubt');
		await assert.rejects(() => insert('Körper', 1), 'zweite „Körper"-Säule desselben Nutzers wird abgewiesen');
	});
});

// ── Rote Spec-Tests für #427 — Säulen pro Nutzer (Datenmodell & Migration) ────────────────────────
//
// Kontext: Säulen waren bislang **globale Stammdaten** (Unique auf `name`). Mit #427 werden sie
// **pro Nutzer** geführt: `pillars` bekommt `userId`, der Unique-Index steht auf (`name`, `userId`).
//
// Der Vertrag umfasst zwei neue Funktionen in `migrate.ts`:
//   • `seedPillarsForUser(db, userId)` — legt für einen (neuen) Nutzer die fünf kanonischen
//     SEED_PILLARS mit seiner `userId` an (Σ weight ≈ 100).
//   • `migratePillarsPerUser(db)` — überführt eine Bestands-DB mit **globalen** Säulen (userId=NULL)
//     in das Pro-Nutzer-Modell: jede `task_pillars`-Zeile zeigt danach auf die Säule **desselben
//     Nutzers** (Match über den Namen), keine Zeile wird verwaist, und die alten globalen Säulen
//     (ohne userId) verschwinden. Die Migration ist idempotent.
//
// KEIN Produktivcode — die Tests werden grün, sobald `migrate.ts` beide Funktionen exportiert und
// korrekt implementiert. Das Legacy-Schema wird bewusst per Raw-SQL aufgebaut (Bestands-DB-Abbild).

describe('seedPillarsForUser (#427 AK1)', () => {
	/** Säulen des Nutzers, nach `id` sortiert (Raw-SQL, unabhängig vom Modell-Zustand). */
	const pillarsOfUser = async (userId: number): Promise<{ name: string; weight: number; userId: number }[]> => {
		const [rows] = await sequelize.query(
			'SELECT `name`, `weight`, `userId` FROM `pillars` WHERE `userId` = ? ORDER BY `id`',
			{ replacements: [userId] },
		);
		return rows as { name: string; weight: number; userId: number }[];
	};

	// ── AK1: Default-Startbestand — genau die 5 SEED_PILLARS mit userId, Σ weight ≈ 100 ─────────
	it('legt für einen neuen Nutzer genau die 5 SEED_PILLARS mit seiner userId an', async () => {
		await sequelize.sync({ force: true });

		await seedPillarsForUser(sequelize, 7);

		const pillars = await pillarsOfUser(7);
		assert.equal(pillars.length, SEED_PILLARS.length, 'exakt fünf Säulen wurden angelegt');
		assert.deepEqual(
			pillars.map((p) => p.name).sort(),
			[...SEED_PILLARS].map((p) => p.name).sort(),
			'die Namen entsprechen den kanonischen SEED_PILLARS',
		);
		for (const pillar of pillars) {
			assert.equal(pillar.userId, 7, `Säule „${pillar.name}" trägt die userId des Nutzers`);
		}
	});

	it('die Summe der Gewichte der Startsäulen ist ≈ 100', async () => {
		await sequelize.sync({ force: true });

		await seedPillarsForUser(sequelize, 7);

		const sum = (await pillarsOfUser(7)).reduce((acc, p) => acc + p.weight, 0);
		assert.ok(Math.abs(sum - 100) < 0.001, `Σ weight ≈ 100 (war ${sum})`);
	});

	it('seedet je Nutzer getrennt — zwei Nutzer erhalten je ihren eigenen Startbestand', async () => {
		await sequelize.sync({ force: true });

		await seedPillarsForUser(sequelize, 1);
		await seedPillarsForUser(sequelize, 2);

		assert.equal((await pillarsOfUser(1)).length, SEED_PILLARS.length, 'Nutzer 1 hat seine 5 Säulen');
		assert.equal((await pillarsOfUser(2)).length, SEED_PILLARS.length, 'Nutzer 2 hat seine 5 Säulen');
	});
});

describe('migratePillarsPerUser (#427 AK3/AK4)', () => {
	/**
	 * Baut das Ziel-Schema (#427) per Raw-SQL auf: `pillars` **mit** `userId`, dazu `users`, `tasks`
	 * (mit `userId`) und die Join-Tabelle `task_pillars`. Bildet eine Bestands-DB nach, auf der die
	 * Migration greifen muss — unabhängig vom aktuellen Sequelize-Modell-Zustand.
	 */
	const createPerUserSchema = async (): Promise<void> => {
		await sequelize.getQueryInterface().dropAllTables();
		await sequelize.query(
			'CREATE TABLE `pillars` (' +
				'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'`name` VARCHAR(255) NOT NULL, ' +
				'`weight` FLOAT NOT NULL DEFAULT 20, ' +
				"`description` VARCHAR(255) NOT NULL DEFAULT '', " +
				'`userId` INTEGER, ' +
				'`createdAt` DATETIME NOT NULL, ' +
				'`updatedAt` DATETIME NOT NULL' +
				')',
		);
		await sequelize.query(
			'CREATE TABLE `users` (' +
				'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'`email` VARCHAR(255) NOT NULL, ' +
				"`passwordHash` VARCHAR(255) NOT NULL DEFAULT 'x', " +
				'`createdAt` DATETIME NOT NULL, ' +
				'`updatedAt` DATETIME NOT NULL' +
				')',
		);
		await sequelize.query(
			'CREATE TABLE `tasks` (' +
				'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'`title` VARCHAR(255) NOT NULL, ' +
				'`userId` INTEGER, ' +
				'`createdAt` DATETIME NOT NULL, ' +
				'`updatedAt` DATETIME NOT NULL' +
				')',
		);
		await sequelize.query(
			'CREATE TABLE `task_pillars` (' +
				'`taskId` INTEGER NOT NULL, ' +
				'`pillarId` INTEGER NOT NULL, ' +
				'`share` FLOAT NOT NULL DEFAULT 0, ' +
				'`confidence` FLOAT NOT NULL DEFAULT 100, ' +
				'PRIMARY KEY (`taskId`, `pillarId`)' +
				')',
		);
	};

	/**
	 * Baut das Alt-Szenario: fünf **globale** Säulen (userId=NULL, ids 1..5), zwei Nutzer, je ein
	 * Task pro Nutzer und `task_pillars`, die auf die globalen Säulen-IDs zeigen:
	 *   Task 1 (Nutzer 1) → „Körper"
	 *   Task 2 (Nutzer 2) → „Körper" **und** „Beziehungen"
	 * So wird geprüft, dass derselbe globale Name auf getrennte Pro-Nutzer-Kopien abgebildet wird.
	 */
	const seedLegacyGlobalScenario = async (): Promise<void> => {
		const names = SEED_PILLARS.map((p) => p.name); // ids 1..5, userId=NULL
		await sequelize.query(
			'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) VALUES ' +
				names.map(() => "(?, 20, '', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").join(', '),
			{ replacements: names },
		);
		await sequelize.query(
			'INSERT INTO `users` (`id`, `email`, `createdAt`, `updatedAt`) VALUES ' +
				"(1, 'u1@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), " +
				"(2, 'u2@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		);
		await sequelize.query(
			'INSERT INTO `tasks` (`id`, `title`, `userId`, `createdAt`, `updatedAt`) VALUES ' +
				"(1, 'Task von Nutzer 1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), " +
				"(2, 'Task von Nutzer 2', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		);
		// Körper = globale id 1, Beziehungen = globale id 2 (Reihenfolge der SEED_PILLARS).
		await sequelize.query(
			'INSERT INTO `task_pillars` (`taskId`, `pillarId`, `share`, `confidence`) VALUES ' +
				'(1, 1, 100, 100), ' + // Task 1 → Körper
				'(2, 1, 60, 100), ' + // Task 2 → Körper
				'(2, 2, 40, 100)', // Task 2 → Beziehungen
		);
	};

	/** Zahl der noch verbliebenen globalen Säulen (userId IS NULL). */
	const globalPillarCount = async (): Promise<number> => {
		const [rows] = await sequelize.query('SELECT COUNT(*) AS n FROM `pillars` WHERE `userId` IS NULL');
		return (rows as { n: number }[])[0].n;
	};

	/** Zahl der verwaisten Join-Zeilen (pillarId ohne existierende Säule). */
	const orphanTaskPillarCount = async (): Promise<number> => {
		const [rows] = await sequelize.query(
			'SELECT COUNT(*) AS n FROM `task_pillars` tp LEFT JOIN `pillars` p ON p.`id` = tp.`pillarId` WHERE p.`id` IS NULL',
		);
		return (rows as { n: number }[])[0].n;
	};

	/**
	 * Join-Sicht: pro `task_pillars`-Zeile der Task-Owner, der Säulen-Owner und der Säulenname.
	 * Damit lässt sich die AK3-Kernaussage prüfen (Säule gehört demselben Nutzer wie der Task,
	 * Name bleibt erhalten).
	 */
	const joinView = async (): Promise<{ taskId: number; taskUserId: number; pillarUserId: number; name: string }[]> => {
		const [rows] = await sequelize.query(
			'SELECT tp.`taskId` AS taskId, t.`userId` AS taskUserId, p.`userId` AS pillarUserId, p.`name` AS name ' +
				'FROM `task_pillars` tp ' +
				'JOIN `pillars` p ON p.`id` = tp.`pillarId` ' +
				'JOIN `tasks` t ON t.`id` = tp.`taskId` ' +
				'ORDER BY tp.`taskId`, p.`name`',
		);
		return rows as { taskId: number; taskUserId: number; pillarUserId: number; name: string }[];
	};

	// ── AK3: Migration ohne Beitragsverlust ──────────────────────────────────────────────────────
	it('bildet jede task_pillars-Zeile auf die gleichnamige Säule DESSELBEN Nutzers ab', async () => {
		await createPerUserSchema();
		await seedLegacyGlobalScenario();

		// Ausgangs-Beiträge als (taskId, name)-Menge festhalten — diese müssen die Migration überleben.
		const before = (await joinView()).map((r) => `${r.taskId}:${r.name}`).sort();
		assert.deepEqual(
			before,
			['1:Körper', '2:Beziehungen', '2:Körper'],
			'Vorbedingung: drei Beiträge über globale Säulen',
		);

		await migratePillarsPerUser(sequelize);

		const after = await joinView();
		// Kein Beitrag ging verloren: dieselbe (taskId, name)-Menge wie zuvor.
		assert.deepEqual(
			after.map((r) => `${r.taskId}:${r.name}`).sort(),
			before,
			'jede (Task, Säulenname)-Zuordnung bleibt erhalten',
		);
		// Jede Säule gehört jetzt exakt dem Nutzer, dem auch der Task gehört.
		for (const row of after) {
			assert.equal(
				row.pillarUserId,
				row.taskUserId,
				`Säule „${row.name}" gehört dem Task-Owner (Nutzer ${row.taskUserId})`,
			);
		}
	});

	it('verwaist keine task_pillars-Zeile und entfernt die alten globalen Säulen', async () => {
		await createPerUserSchema();
		await seedLegacyGlobalScenario();

		await migratePillarsPerUser(sequelize);

		assert.equal(await orphanTaskPillarCount(), 0, 'keine verwaiste Join-Zeile nach der Migration');
		assert.equal(await globalPillarCount(), 0, 'die alten globalen Säulen (userId=NULL) sind entfernt');

		// Die Zahl der Beiträge bleibt unverändert (nichts gelöscht, nichts dupliziert).
		const [rows] = await sequelize.query('SELECT COUNT(*) AS n FROM `task_pillars`');
		assert.equal((rows as { n: number }[])[0].n, 3, 'weiterhin genau drei Join-Zeilen');
	});

	// ── AK4: Idempotenz — zweiter Lauf lässt den Zustand unverändert ────────────────────────────
	it('ist idempotent: zweiter Aufruf wirft nicht und lässt den Zustand unverändert', async () => {
		await createPerUserSchema();
		await seedLegacyGlobalScenario();

		await migratePillarsPerUser(sequelize);
		const afterFirst = await joinView();
		const [pillarsAfterFirst] = await sequelize.query('SELECT COUNT(*) AS n FROM `pillars`');

		await assert.doesNotReject(() => migratePillarsPerUser(sequelize), 'zweiter Lauf wirft nicht');

		assert.deepEqual(await joinView(), afterFirst, 'die Join-Zuordnungen sind nach dem zweiten Lauf identisch');
		assert.equal(await globalPillarCount(), 0, 'weiterhin keine globalen Säulen');
		assert.equal(await orphanTaskPillarCount(), 0, 'weiterhin keine verwaiste Join-Zeile');
		const [pillarsAfterSecond] = await sequelize.query('SELECT COUNT(*) AS n FROM `pillars`');
		assert.deepEqual(pillarsAfterSecond, pillarsAfterFirst, 'die Zahl der Säulen bleibt gleich (keine Dubletten)');
	});

	// ── No-op: keine globalen Säulen vorhanden (frische Pro-Nutzer-DB) ──────────────────────────
	it('ist ein No-op, wenn keine globalen Säulen (userId=NULL) existieren', async () => {
		await createPerUserSchema();
		// Nur Pro-Nutzer-Säulen (userId gesetzt), keine globale Zeile.
		await sequelize.query(
			'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) VALUES ' +
				"('Körper', 20, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		);
		const [before] = await sequelize.query('SELECT `id`, `name`, `userId` FROM `pillars` ORDER BY `id`');

		await assert.doesNotReject(() => migratePillarsPerUser(sequelize), 'Migration ohne globale Säulen ist no-op');

		const [after] = await sequelize.query('SELECT `id`, `name`, `userId` FROM `pillars` ORDER BY `id`');
		assert.deepEqual(after, before, 'die vorhandenen Pro-Nutzer-Säulen bleiben unangetastet');
	});

	it('ist auf einer DB ohne pillars-Tabelle ein No-op', async () => {
		await sequelize.getQueryInterface().dropAllTables();
		await assert.doesNotReject(() => migratePillarsPerUser(sequelize), 'Migration ohne pillars-Tabelle ist no-op');
	});
});
