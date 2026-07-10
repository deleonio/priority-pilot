import type { Sequelize } from 'sequelize';
import { SEED_PILLARS } from '../models/pillarData.js';

/**
 * Definition der mit dem Serien-Feature (#120/#142) am `Task`-Modell hinzugekommenen Spalten
 * (siehe `server/src/models/task.ts`). Jede Spalte wird per `ALTER TABLE tasks ADD COLUMN`
 * nachgezogen, falls sie auf einer Bestands-`database.sqlite` noch fehlt. Die SQLite-Typen
 * entsprechen den Sequelize-Datentypen am Modell.
 *
 * Hinweis: SQLite kann eine `NOT NULL`-Spalte nur mit Default nachträglich ergänzen — `isException`
 * trägt daher zwingend `NOT NULL DEFAULT 0` (Modell-Default `false`). Die nullbaren Spalten
 * (`seriesId`, `seriesOccurrence`) brauchen keinen Default.
 */
const SERIES_COLUMNS = [
	{ name: 'seriesId', definition: 'INTEGER' },
	{ name: 'isException', definition: 'INTEGER NOT NULL DEFAULT 0' },
	{ name: 'seriesOccurrence', definition: 'DATETIME' },
] as const;

/**
 * Zieht fehlende Serien-Spalten auf einer **bestehenden** `tasks`-Tabelle nach, **bevor**
 * `sequelize.sync()` läuft. Analog zu `migrateLegacySinglePillar` (siehe `server/src/index.ts`):
 * `sync()` ohne `alter` ergänzt vorhandene Tabellen NICHT um neue Spalten, versucht aber den
 * Unique-Index `tasks_series_id_series_occurrence` auf (`seriesId`, `seriesOccurrence`) anzulegen —
 * das schlägt auf einer vor dem Serien-Feature angelegten DB mit
 * `SQLITE_ERROR: no such column: seriesId` fehl und verhindert den Server-Start (#146).
 *
 * Idempotent: Bereits vorhandene Spalten werden übersprungen, mehrfache Aufrufe bleiben stabil.
 * Fehlt die `tasks`-Tabelle ganz (frische DB), ist die Migration ein No-op — `sync()` legt danach
 * Tabelle inkl. Spalten und Index korrekt an.
 */
export const migrateSeriesColumns = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	// Keine Tabelle (frische DB) → No-op; sync() übernimmt das Anlegen.
	if (existing.size === 0) {
		return;
	}

	for (const column of SERIES_COLUMNS) {
		if (existing.has(column.name)) {
			continue;
		}
		await db.query(`ALTER TABLE \`tasks\` ADD COLUMN \`${column.name}\` ${column.definition}`);
		console.log(`Serien-Spalte ${column.name} an tasks nachgezogen.`);
	}
};

/**
 * Fehlende Spalten der `series`-Tabelle nachziehen (#163).
 *
 * SQLite-Constraint: `ALTER TABLE ADD COLUMN NOT NULL` erfordert einen DEFAULT-Wert.
 */
const SERIES_TABLE_COLUMNS = [
	{ name: 'title', definition: "VARCHAR(255) NOT NULL DEFAULT ''" },
	{ name: 'rhythm', definition: "TEXT NOT NULL DEFAULT 'weekly'" },
	{ name: 'priority', definition: 'INTEGER NOT NULL DEFAULT 3' },
	{ name: 'estimatedEffort', definition: 'FLOAT NOT NULL DEFAULT 0.5' },
	{ name: 'active', definition: 'INTEGER NOT NULL DEFAULT 1' },
	{ name: 'startDate', definition: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP' },
	// Eigentümer-Bindung (#244, AK1): nullable, daher kein DEFAULT nötig.
	{ name: 'userId', definition: 'INTEGER' },
	// Freitext-Beschreibung (#301): nullable, daher kein NOT NULL/DEFAULT nötig.
	{ name: 'description', definition: 'TEXT' },
] as const;

/**
 * Benennt die Serien-Spalten `defaultPriority` → `priority` und `defaultEstimatedEffort` →
 * `estimatedEffort` auf einer **bestehenden** `series`-Tabelle um (#300), BEVOR `migrateSeriesTable`
 * und `sequelize.sync()` laufen.
 *
 * Reihenfolge kritisch: Liefe `migrateSeriesTable` mit den neuen Spaltennamen zuerst auf einer
 * Bestands-DB mit Alt-Spalten, legte es leere Neu-Spalten an → das anschließende RENAME schlüge fehl.
 *
 * PRAGMA-geführt und idempotent: Es wird nur umbenannt, wenn die Alt-Spalte existiert und die
 * Neu-Spalte noch nicht. No-op, wenn die Tabelle noch nicht existiert (frische DB: `sync()` legt sie
 * direkt mit den neuen Namen an).
 */
export async function migrateSeriesRenameFields(seq: Sequelize): Promise<void> {
	// Tabelle existiert nicht → No-Op
	const [tableCheck] = await seq.query("SELECT name FROM sqlite_master WHERE type='table' AND name='series'");
	if ((tableCheck as unknown[]).length === 0) return;

	const [rows] = await seq.query("PRAGMA table_info('series')");
	const cols = (rows as { name: string }[]).map((r) => r.name);

	if (cols.includes('defaultPriority') && !cols.includes('priority')) {
		await seq.query('ALTER TABLE `series` RENAME COLUMN `defaultPriority` TO `priority`');
	}
	if (cols.includes('defaultEstimatedEffort') && !cols.includes('estimatedEffort')) {
		await seq.query('ALTER TABLE `series` RENAME COLUMN `defaultEstimatedEffort` TO `estimatedEffort`');
	}
}

/**
 * Zieht fehlende Spalten auf einer **bestehenden** `series`-Tabelle nach, bevor `sequelize.sync()`
 * läuft. Analog zu `migrateSeriesColumns`: `sync()` ohne `alter` ergänzt vorhandene Tabellen nicht
 * um neue Spalten → alle Series-CRUD-Operationen schlagen mit `SQLITE_ERROR: no such column: title`
 * fehl (#163).
 *
 * Idempotent und No-op, wenn die Tabelle noch nicht existiert.
 */
export const migrateSeriesTable = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('series')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0) {
		return;
	}

	for (const column of SERIES_TABLE_COLUMNS) {
		if (existing.has(column.name)) {
			continue;
		}
		await db.query(`ALTER TABLE \`series\` ADD COLUMN \`${column.name}\` ${column.definition}`);
		console.log(`Serien-Tabellenspalte ${column.name} an series nachgezogen.`);
	}
};

/**
 * Zieht die nullable `avatarUrl`-Spalte auf einer **bestehenden** `users`-Tabelle nach (#217).
 *
 * `sequelize.sync()` ohne `alter` ergänzt vorhandene Tabellen nicht um neue Spalten —
 * `findOrCreate` mit `avatarUrl`-Default und `user.update({ avatarUrl })` schlagen sonst mit
 * `SQLITE_ERROR: no such column: avatarUrl` fehl. Idempotent; No-op bei frischer DB.
 */
export const migrateUsersAvatarUrl = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('avatarUrl')) {
		return;
	}

	await db.query('ALTER TABLE `users` ADD COLUMN `avatarUrl` VARCHAR(255)');
	console.log('Spalte avatarUrl an users nachgezogen.');
};

/**
 * Definition der mit der Datenisolation (#207, AK5) ergänzten `userId`-Spalte an `tasks` (nullable,
 * Abwärtskompatibilität). Die separate `pillars.userId`-Spalte (#427 — Säulen pro Nutzer) wird von
 * {@link migratePillarAddUserId} nachgezogen. Der SQLite-Typ entspricht dem Sequelize-Datentyp
 * `DataTypes.INTEGER`.
 */
const USER_ID_COLUMNS = [{ table: 'tasks', column: 'userId', definition: 'INTEGER' }] as const;

/**
 * Zieht die nullable `userId`-Spalte auf **bestehenden** `tasks`-Tabellen nach (#207), BEVOR
 * `sequelize.sync()` läuft. Analog zu `migrateSeriesColumns`: `sync()` ohne `alter` ergänzt
 * vorhandene Tabellen NICHT um neue Spalten. Jede authentifizierte Query filtert per `ownerScope`
 * auf `userId` und würde sonst mit `no such column` brechen.
 *
 * Idempotent: Bereits vorhandene Spalten werden übersprungen, mehrfache Aufrufe bleiben stabil.
 * Fehlt die Tabelle ganz (frische DB), ist die Migration ein No-op — `sync()` legt danach Tabelle
 * inkl. Spalte korrekt an.
 */
export const migrateUserIdColumns = async (db: Sequelize): Promise<void> => {
	for (const { table, column, definition } of USER_ID_COLUMNS) {
		const [rows] = await db.query(`PRAGMA table_info('${table}')`);
		const existing = (rows as { name: string }[]).map((row) => row.name);

		if (existing.length === 0 || existing.includes(column)) {
			continue;
		}
		await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
		console.log(`Spalte ${column} an ${table} nachgezogen.`);
	}
};

/**
 * Zieht die `description`-Spalte (Kurzbeschreibung der Säule) auf einer **bestehenden** `pillars`-
 * Tabelle nach und backfillt die kanonischen Stammdaten nach Namen. Säulen sind global (nicht pro
 * Nutzer), daher erfolgt das Zurückfüllen unabhängig von `userId` — jede Standard-Säule mit noch
 * leerer Beschreibung erhält den Wert aus {@link SEED_PILLARS}.
 *
 * SQLite-Constraint: `ALTER TABLE ADD COLUMN NOT NULL` erfordert einen DEFAULT-Wert, daher wird
 * `NOT NULL DEFAULT ''` gesetzt; der Seed bzw. dieses Backfill füllen die echten Texte. Idempotent
 * (Spalte wie auch jeder `UPDATE … WHERE description = ''` sind wiederholt ausführbar) und No-op bei
 * frischer DB (`sync()` legt die Spalte inkl. Default an; das Backfill findet dann nichts Leeres).
 */
export const migratePillarDescription = async (db: Sequelize): Promise<void> => {
	const [rows] = await db.query("PRAGMA table_info('pillars')");
	const existing = (rows as { name: string }[]).map((row) => row.name);

	if (existing.length === 0 || existing.includes('description')) {
		return;
	}
	await db.query("ALTER TABLE `pillars` ADD COLUMN `description` VARCHAR(255) NOT NULL DEFAULT ''");
	for (const { name, description } of SEED_PILLARS) {
		await db.query("UPDATE `pillars` SET `description` = :description WHERE `name` = :name AND `description` = ''", {
			replacements: { description, name },
		});
	}
	console.log('Spalte description an pillars nachgezogen und Stammdaten zurückgefüllt.');
};

/**
 * Zieht die `userId`-Spalte auf einer **bestehenden** `pillars`-Tabelle nach und stellt den
 * Unique-Index von `pillars_name` (`name`) auf `pillars_name_user_id` (`name`, `userId`) um (#427 —
 * Säulen werden wieder **pro Nutzer** geführt, Umkehr des #207-Cleanups).
 *
 * Läuft BEVOR `sequelize.sync()` (wie alle Vorab-Migrationen), damit `sync()` das neue Modell (Index
 * auf `name`, `userId`) ohne „no such column: userId"-Konflikt anwenden kann. Der Index-Name
 * entspricht dem Sequelize-Default für den Modell-Index (`pillars_name_user_id`), sodass `sync()` ihn
 * als bereits vorhanden erkennt und nicht erneut anzulegen versucht.
 *
 * Reihenfolge bewusst: zuerst den alten `pillars_name`-Index **droppen**, dann die nullable
 * `userId`-Spalte ergänzen (SQLite: `ADD COLUMN` ohne `NOT NULL` braucht keinen Default), dann den
 * neuen zusammengesetzten Index anlegen. Alles mit `IF [NOT] EXISTS` abgesichert → idempotent. No-op,
 * wenn `userId` bereits existiert oder die Tabelle fehlt (frische DB: `sync()` legt sie korrekt an).
 */
export const migratePillarAddUserId = async (db: Sequelize): Promise<void> => {
	const [rows] = await db.query("PRAGMA table_info('pillars')");
	const existing = (rows as { name: string }[]).map((row) => row.name);

	if (existing.length === 0 || existing.includes('userId')) {
		return;
	}
	await db.query('DROP INDEX IF EXISTS `pillars_name`');
	await db.query('ALTER TABLE `pillars` ADD COLUMN `userId` INTEGER');
	await db.query('CREATE UNIQUE INDEX IF NOT EXISTS `pillars_name_user_id` ON `pillars`(`name`, `userId`)');
	console.log('Spalte userId an pillars nachgezogen und Unique-Index auf (name, userId) umgestellt.');
};

/**
 * Legt für einen (neuen) Nutzer den kanonischen Startbestand der fünf {@link SEED_PILLARS} an —
 * jede Säule mit dessen `userId`, Name, Kurzbeschreibung und Default-Gewichtung (Σ weight = 100).
 * Säulen werden mit #427 **pro Nutzer** geführt; diese Funktion ist der Pro-Nutzer-Ersatz für den
 * früheren globalen Säulen-Seed.
 *
 * Raw-SQL (konsistent mit den übrigen Migrationen und unabhängig vom Modell-Zustand). Der Aufrufer
 * ist für die Einmaligkeit verantwortlich (z. B. nur bei der Nutzeranlage) — der Unique-Index
 * (`name`, `userId`) verhindert Dubletten.
 */
export const seedPillarsForUser = async (db: Sequelize, userId: number): Promise<void> => {
	for (const { name, description, weight } of SEED_PILLARS) {
		await db.query(
			'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
				'VALUES (:name, :weight, :description, :userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
			{ replacements: { name, weight, description, userId } },
		);
	}
};

/**
 * Überführt eine Bestands-DB mit **globalen** Säulen (`userId IS NULL`) in das Pro-Nutzer-Modell
 * (#427). Für jeden Nutzer, dessen Tasks über `task_pillars` auf eine globale Säule zeigen, wird
 * eine gleichnamige Pro-Nutzer-Kopie angelegt und die betroffenen `task_pillars`-Zeilen darauf
 * umgebogen (Match über den Säulennamen). Anschließend werden die alten globalen Säulen entfernt.
 * Kein Beitrag geht verloren, keine Join-Zeile verwaist.
 *
 * Idempotent: Nach dem ersten Lauf existieren keine globalen Säulen mehr → jeder weitere Aufruf ist
 * ein No-op (Schritt 2). No-op auch bei fehlender `pillars`-Tabelle (frische DB) oder wenn bereits
 * ausschließlich Pro-Nutzer-Säulen vorliegen. Raw-SQL, unabhängig vom aktuellen Modell-Zustand.
 */
export const migratePillarsPerUser = async (db: Sequelize): Promise<void> => {
	// 1. Keine pillars-Tabelle (frische DB) → No-op.
	const [tableInfo] = await db.query("PRAGMA table_info('pillars')");
	if ((tableInfo as unknown[]).length === 0) {
		return;
	}

	// 2. Keine globalen Säulen (userId IS NULL) → nichts zu migrieren (auch der Idempotenz-Anker).
	const [globalRows] = await db.query('SELECT COUNT(*) AS n FROM `pillars` WHERE `userId` IS NULL');
	if ((globalRows as { n: number }[])[0].n === 0) {
		return;
	}

	// 3. Distinct (Task-Owner, globale Säule) aus den vorhandenen Join-Zeilen ermitteln.
	const [pairs] = await db.query(
		'SELECT DISTINCT t.`userId` AS userId, tp.`pillarId` AS pillarId, ' +
			'p.`name` AS name, p.`weight` AS weight, p.`description` AS description ' +
			'FROM `task_pillars` tp ' +
			'JOIN `tasks` t ON t.`id` = tp.`taskId` ' +
			'JOIN `pillars` p ON p.`id` = tp.`pillarId` ' +
			'WHERE p.`userId` IS NULL AND t.`userId` IS NOT NULL',
	);

	for (const pair of pairs as {
		userId: number;
		pillarId: number;
		name: string;
		weight: number;
		description: string;
	}[]) {
		// 3a. Pro-Nutzer-Kopie anlegen (oder eine bereits vorhandene wiederverwenden).
		const [existing] = await db.query('SELECT `id` FROM `pillars` WHERE `name` = :name AND `userId` = :userId', {
			replacements: { name: pair.name, userId: pair.userId },
		});
		let targetId: number;
		if ((existing as { id: number }[]).length > 0) {
			targetId = (existing as { id: number }[])[0].id;
		} else {
			await db.query(
				'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
					'VALUES (:name, :weight, :description, :userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
				{ replacements: { name: pair.name, weight: pair.weight, description: pair.description, userId: pair.userId } },
			);
			const [inserted] = await db.query('SELECT `id` FROM `pillars` WHERE `name` = :name AND `userId` = :userId', {
				replacements: { name: pair.name, userId: pair.userId },
			});
			targetId = (inserted as { id: number }[])[0].id;
		}

		// 3b. task_pillars der Tasks dieses Nutzers von der globalen auf die Pro-Nutzer-Säule umbiegen.
		await db.query(
			'UPDATE `task_pillars` SET `pillarId` = :targetId ' +
				'WHERE `pillarId` = :oldId AND `taskId` IN (SELECT `id` FROM `tasks` WHERE `userId` = :userId)',
			{ replacements: { targetId, oldId: pair.pillarId, userId: pair.userId } },
		);
	}

	// 4. Alte globale Säulen (userId IS NULL) entfernen.
	await db.query('DELETE FROM `pillars` WHERE `userId` IS NULL');
	console.log('Globale Säulen auf Pro-Nutzer-Säulen migriert (#427).');
};
