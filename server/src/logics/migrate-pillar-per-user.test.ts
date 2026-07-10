import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
// `migratePillarPerUser` existiert noch nicht — der Import macht diese Spec-Datei bewusst ROT,
// bis `server/src/logics/migrate.ts` die Funktion exportiert (Teil 1 von Epic #420, Issue #421).
import { migratePillarPerUser } from './migrate.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { closeDb } from '../test/helpers.js';

// ── Rote Spec-Tests für #421 — „Säulen pro Nutzer: Datenmodell & Migration" ─────────────────────
//
// Ausgangslage (Stand VOR diesem PR): `pillars` ist GLOBAL — Spalte `userId` fehlt, es existiert ein
// globaler Unique-Index `pillars_name` auf (`name`). Ziel: Säulen sind nutzer-eigen.
//
// Der Vertrag: eine idempotente Vorab-Migration `migratePillarPerUser(sequelize)`, die auf einer
// Bestands-DB
//   1. die nullbare Spalte `userId` an `pillars` nachzieht,
//   2. den alten globalen Unique-Index `pillars_name` droppt,
//   3. einen neuen Unique-Index `pillars_name_user_id` auf (`name`, `userId`) anlegt,
//   4. für JEDEN existierenden Nutzer eigene Kopien aller globalen Säulen (Name/Beschreibung/Gewicht)
//      klont,
//   5. `task_pillars` von den globalen Säulen auf die nutzer-eigenen Kopien umhängt (nach task.userId),
//   6. `series_pillars` analog umhängt (nach series.userId),
//   7. NULL-owned Säulen und die Zuordnungen von Tasks/Serien ohne `userId` unangetastet lässt.
//
// Kein Produktivcode — die Tests werden grün, sobald `migrate.ts` `migratePillarPerUser` exportiert
// und das `Pillar`-Modell `userId` + Unique-Index `(name, userId)` trägt.

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

/** Skalar-Count aus einer Raw-Query. */
const scalarCount = async (sql: string, replacements: unknown[] = []): Promise<number> => {
	const [rows] = await sequelize.query(sql, { replacements });
	return Number((rows as { c: number }[])[0]?.c ?? 0);
};

/** Die Säule, auf die die (einzige) `task_pillars`-Zeile eines Tasks zeigt. */
const pillarOfTask = async (
	taskId: number,
): Promise<{ id: number; name: string; userId: number | null } | undefined> => {
	const [rows] = await sequelize.query(
		'SELECT p.`id` AS id, p.`name` AS name, p.`userId` AS userId ' +
			'FROM `task_pillars` tp JOIN `pillars` p ON p.`id` = tp.`pillarId` WHERE tp.`taskId` = ?',
		{ replacements: [taskId] },
	);
	return (rows as { id: number; name: string; userId: number | null }[])[0];
};

/** Die Säule, auf die die (einzige) `series_pillars`-Zeile einer Serie zeigt. */
const pillarOfSeries = async (
	seriesId: number,
): Promise<{ id: number; name: string; userId: number | null } | undefined> => {
	const [rows] = await sequelize.query(
		'SELECT p.`id` AS id, p.`name` AS name, p.`userId` AS userId ' +
			'FROM `series_pillars` sp JOIN `pillars` p ON p.`id` = sp.`pillarId` WHERE sp.`seriesId` = ?',
		{ replacements: [seriesId] },
	);
	return (rows as { id: number; name: string; userId: number | null }[])[0];
};

// ── Alt-Schema-Fabriken (Stand VOR #421) ────────────────────────────────────────────────────────

/**
 * `pillars`-Tabelle im Alt-Stand: mit `name`, `weight`, `description`, aber OHNE `userId`; der
 * globale Unique-Index `pillars_name` auf (`name`). Bildet exakt eine Bestands-`database.sqlite` nach.
 */
const createLegacyPillarsTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `pillars` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			'`name` VARCHAR(255) NOT NULL, ' +
			'`weight` FLOAT NOT NULL DEFAULT 20, ' +
			"`description` VARCHAR(255) NOT NULL DEFAULT '', " +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
	await sequelize.query('CREATE UNIQUE INDEX `pillars_name` ON `pillars`(`name`)');
};

const createLegacyUsersTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `users` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			'`email` VARCHAR(255) NOT NULL, ' +
			'`passwordHash` VARCHAR(255) NOT NULL, ' +
			"`displayName` VARCHAR(255) NOT NULL DEFAULT '', " +
			'`avatarUrl` VARCHAR(255), ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

const createLegacyTasksTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `tasks` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			'`title` VARCHAR(255) NOT NULL, ' +
			'`userId` INTEGER, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

const createLegacyTaskPillarsTable = async (): Promise<void> => {
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

const createLegacySeriesTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `series` (' +
			'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
			"`title` VARCHAR(255) NOT NULL DEFAULT '', " +
			'`userId` INTEGER, ' +
			'`createdAt` DATETIME NOT NULL, ' +
			'`updatedAt` DATETIME NOT NULL' +
			')',
	);
};

const createLegacySeriesPillarsTable = async (): Promise<void> => {
	await sequelize.query(
		'CREATE TABLE `series_pillars` (' +
			'`seriesId` INTEGER NOT NULL, ' +
			'`pillarId` INTEGER NOT NULL, ' +
			'`share` FLOAT NOT NULL DEFAULT 0, ' +
			'`confidence` FLOAT NOT NULL DEFAULT 100, ' +
			'PRIMARY KEY (`seriesId`, `pillarId`)' +
			')',
	);
};

// Globale Säulen mit bewusst UNTERSCHIEDLICHEN Gewichten — so lässt sich beim Klonen prüfen, dass die
// echten Gewichte übernommen werden (nicht bloß der Modell-Default 20).
const GLOBAL_WEIGHTS: Record<string, number> = {
	Körper: 10,
	Beziehungen: 15,
	Sinn: 20,
	'Mentale Gesundheit': 25,
	Wirksamkeit: 30,
};

/** Legt die fünf globalen Säulen mit fixen ids 1..5 an (NULL-owned, wie der echte Alt-Seed). */
const insertGlobalPillars = async (): Promise<void> => {
	let id = 1;
	for (const { name, description } of SEED_PILLARS) {
		await sequelize.query(
			'INSERT INTO `pillars` (`id`, `name`, `weight`, `description`, `createdAt`, `updatedAt`) ' +
				'VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
			{ replacements: [id, name, GLOBAL_WEIGHTS[name], description] },
		);
		id += 1;
	}
};

const insertUser = (id: number, email: string): Promise<unknown> =>
	sequelize.query(
		'INSERT INTO `users` (`id`, `email`, `passwordHash`, `displayName`, `createdAt`, `updatedAt`) ' +
			"VALUES (?, ?, '__x__', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		{ replacements: [id, email, email] },
	);

const insertTask = (id: number, title: string, userId: number | null): Promise<unknown> =>
	sequelize.query(
		'INSERT INTO `tasks` (`id`, `title`, `userId`, `createdAt`, `updatedAt`) ' +
			'VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
		{ replacements: [id, title, userId] },
	);

const insertTaskPillar = (taskId: number, pillarId: number): Promise<unknown> =>
	sequelize.query('INSERT INTO `task_pillars` (`taskId`, `pillarId`, `share`, `confidence`) VALUES (?, ?, 100, 90)', {
		replacements: [taskId, pillarId],
	});

const insertSeries = (id: number, title: string, userId: number | null): Promise<unknown> =>
	sequelize.query(
		'INSERT INTO `series` (`id`, `title`, `userId`, `createdAt`, `updatedAt`) ' +
			'VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
		{ replacements: [id, title, userId] },
	);

const insertSeriesPillar = (seriesId: number, pillarId: number): Promise<unknown> =>
	sequelize.query(
		'INSERT INTO `series_pillars` (`seriesId`, `pillarId`, `share`, `confidence`) VALUES (?, ?, 100, 80)',
		{ replacements: [seriesId, pillarId] },
	);

/**
 * Baut die komplette Legacy-DB mit zwei Nutzern auf:
 * - 5 globale Säulen (ids 1..5): Körper=1, Beziehungen=2, Sinn=3, Mentale Gesundheit=4, Wirksamkeit=5.
 * - user1 (id 1), user2 (id 2).
 * - task 10 → user1, task 20 → user2, task 30 → OHNE userId (NULL).
 * - task_pillars: 10→Körper(1), 20→Sinn(3), 30→Wirksamkeit(5).
 * - series 100 → user1, series_pillars: 100→Beziehungen(2).
 */
const buildLegacyTwoUserDb = async (): Promise<void> => {
	await createLegacyPillarsTable();
	await createLegacyUsersTable();
	await createLegacyTasksTable();
	await createLegacyTaskPillarsTable();
	await createLegacySeriesTable();
	await createLegacySeriesPillarsTable();

	await insertGlobalPillars();
	await insertUser(1, 'user1@example.com');
	await insertUser(2, 'user2@example.com');

	await insertTask(10, 'Joggen (user1)', 1);
	await insertTask(20, 'Sinn-Task (user2)', 2);
	await insertTask(30, 'Alt-Task ohne Owner', null);
	await insertTaskPillar(10, 1); // user1 → Körper
	await insertTaskPillar(20, 3); // user2 → Sinn
	await insertTaskPillar(30, 5); // NULL-User → Wirksamkeit

	await insertSeries(100, 'Wochen-Serie (user1)', 1);
	await insertSeriesPillar(100, 2); // user1-Serie → Beziehungen
};

beforeEach(async () => {
	// Sauberer Ausgangszustand: jeder Test baut sein Szenario per Raw-SQL selbst auf.
	await sequelize.getQueryInterface().dropAllTables();
});
after(closeDb);

describe('migratePillarPerUser — AK1 (Modell): Säulennamen sind pro Nutzer eindeutig', () => {
	// Nach der Migration existiert der Unique-Index (name, userId): derselbe Name für ZWEI Nutzer ist
	// erlaubt, derselbe Name für DENSELBEN Nutzer wird abgewiesen (Raw-Insert, modellunabhängig).
	it('erlaubt gleichen Namen für verschiedene Nutzer, verbietet Duplikate beim selben Nutzer', async () => {
		await createLegacyPillarsTable();
		await createLegacyUsersTable();
		await insertGlobalPillars();
		await insertUser(1, 'a@example.com');
		await insertUser(2, 'b@example.com');

		await migratePillarPerUser(sequelize);

		// Schema-Umstellung: userId-Spalte + neuer Unique-Index, alter globaler Index weg.
		assert.ok((await columnsOf('pillars')).includes('userId'), 'userId-Spalte wurde an pillars nachgezogen');
		const idx = await indexesOf('pillars');
		assert.ok(idx.includes('pillars_name_user_id'), 'neuer Unique-Index pillars_name_user_id existiert');
		assert.ok(!idx.includes('pillars_name'), 'alter globaler Unique-Index pillars_name wurde gedroppt');

		const insertPillar = (name: string, userId: number): Promise<unknown> =>
			sequelize.query(
				'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
					"VALUES (?, 20, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				{ replacements: [name, userId] },
			);

		await assert.doesNotReject(() => insertPillar('Eigene Säule', 1), 'erste eigene Säule für Nutzer 1');
		await assert.doesNotReject(
			() => insertPillar('Eigene Säule', 2),
			'gleicher Name für Nutzer 2 ist erlaubt (Eindeutigkeit nur pro Nutzer)',
		);
		await assert.rejects(
			() => insertPillar('Eigene Säule', 1),
			'gleicher Name beim selben Nutzer verletzt den Unique-Constraint (name, userId)',
		);
	});
});

describe('migratePillarPerUser — AK2 (Migration): Klonen + Umhängen der Beiträge', () => {
	it('klont je Nutzer alle globalen Säulen mit Gewicht und hängt task_pillars/series_pillars um', async () => {
		await buildLegacyTwoUserDb();

		// Vorbedingung: pillars ist global (kein userId), globaler Index vorhanden.
		assert.ok(!(await columnsOf('pillars')).includes('userId'), 'Vorbedingung: pillars ohne userId');
		assert.ok((await indexesOf('pillars')).includes('pillars_name'), 'Vorbedingung: globaler Index pillars_name');

		await migratePillarPerUser(sequelize);

		// Jeder Nutzer hat eigene Kopien aller fünf Säulen; die globalen NULL-Säulen bleiben erhalten.
		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` = 1'),
			5,
			'user1 hat 5 eigene Säulen',
		);
		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` = 2'),
			5,
			'user2 hat 5 eigene Säulen',
		);
		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` IS NULL'),
			5,
			'die fünf globalen NULL-owned Säulen bleiben unverändert bestehen',
		);
		assert.equal(await scalarCount('SELECT COUNT(*) AS c FROM `pillars`'), 15, 'insgesamt 5 global + 2×5 nutzer-eigen');

		// Die geklonten Säulen tragen die ECHTEN Gewichte (nicht den Default 20).
		const [weightRows] = await sequelize.query('SELECT `name`, `weight` FROM `pillars` WHERE `userId` = 1');
		const weightByName = new Map((weightRows as { name: string; weight: number }[]).map((r) => [r.name, r.weight]));
		for (const { name } of SEED_PILLARS) {
			assert.equal(weightByName.get(name), GLOBAL_WEIGHTS[name], `Klon „${name}" (user1) übernimmt das echte Gewicht`);
		}

		// task_pillars für Nutzer-Tasks zeigen jetzt auf die nutzer-eigenen Kopien.
		const t10 = await pillarOfTask(10);
		assert.equal(t10?.name, 'Körper', 'task 10 zeigt weiter auf „Körper"');
		assert.equal(t10?.userId, 1, 'task 10 (user1) zeigt auf die user1-eigene Kopie');

		const t20 = await pillarOfTask(20);
		assert.equal(t20?.name, 'Sinn', 'task 20 zeigt weiter auf „Sinn"');
		assert.equal(t20?.userId, 2, 'task 20 (user2) zeigt auf die user2-eigene Kopie');

		// Task OHNE userId bleibt unverändert auf der globalen (NULL-owned) Säule.
		const t30 = await pillarOfTask(30);
		assert.equal(t30?.name, 'Wirksamkeit', 'task 30 zeigt weiter auf „Wirksamkeit"');
		assert.equal(t30?.userId, null, 'task 30 (ohne Owner) bleibt auf der globalen NULL-owned Säule');
		assert.equal(t30?.id, 5, 'task 30 zeigt unverändert auf die ursprüngliche globale Säule (id 5)');

		// series_pillars analog nach series.userId umgehängt.
		const s100 = await pillarOfSeries(100);
		assert.equal(s100?.name, 'Beziehungen', 'series 100 zeigt weiter auf „Beziehungen"');
		assert.equal(s100?.userId, 1, 'series 100 (user1) zeigt auf die user1-eigene Kopie');
	});
});

describe('migratePillarPerUser — AK3 (Idempotenz & frische DB)', () => {
	it('ist idempotent: ein zweiter Lauf ändert nichts', async () => {
		await buildLegacyTwoUserDb();

		await migratePillarPerUser(sequelize);
		const totalAfterFirst = await scalarCount('SELECT COUNT(*) AS c FROM `pillars`');
		const t10First = await pillarOfTask(10);

		await assert.doesNotReject(() => migratePillarPerUser(sequelize), 'zweiter Lauf wirft nicht');

		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars`'),
			totalAfterFirst,
			'zweiter Lauf legt keine weiteren Säulen an (keine Klon-Dubletten)',
		);
		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` = 1'),
			5,
			'user1 hat weiterhin genau 5',
		);
		assert.equal(
			await scalarCount('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` = 2'),
			5,
			'user2 hat weiterhin genau 5',
		);

		const t10Second = await pillarOfTask(10);
		assert.equal(t10Second?.id, t10First?.id, 'die Umhängung von task 10 bleibt beim zweiten Lauf stabil');
	});

	it('ist auf einer frischen DB (keine pillars-Tabelle) ein No-op', async () => {
		assert.deepEqual(await columnsOf('pillars'), [], 'Vorbedingung: keine pillars-Tabelle');

		await assert.doesNotReject(() => migratePillarPerUser(sequelize), 'Migration ohne pillars-Tabelle ist no-op');

		assert.deepEqual(await columnsOf('pillars'), [], 'die Migration legt auf einer frischen DB nichts an');
	});
});
