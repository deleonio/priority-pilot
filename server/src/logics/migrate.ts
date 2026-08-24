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
	// Provenienz (#553): dauerhafte, FK-freie Spalte. Nullable, daher kein DEFAULT nötig. Bestehende
	// Tasks erhalten implizit `NULL` (= nie Teil einer Serie), was korrekt ist — nur neu generierte
	// Instanzen bekommen beim Materialisieren die `series.id` eingetragen (siehe logics/series.ts).
	{ name: 'originSeriesId', definition: 'INTEGER' },
	// Auto-Löschung bei verpasster Deadline (#523): NOT NULL mit DEFAULT 0 (SQLite verlangt bei
	// nachträglichem ADD COLUMN einen DEFAULT für NOT NULL). Wird hier mitgezogen, damit Bestands-DBs
	// die Spalte erhalten, bevor Queries (Task.findAll/-create) sie selektieren.
	{ name: 'autoDeleteAfterDeadline', definition: 'INTEGER NOT NULL DEFAULT 0' },
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
	// Auto-Löschung bei verpasster Deadline (#523): NOT NULL DEFAULT 0 (SQLite verlangt DEFAULT bei
	// nachträglichem ADD COLUMN); wird beim Generieren auf die Instanzen vererbt.
	{ name: 'autoDeleteAfterDeadline', definition: 'INTEGER NOT NULL DEFAULT 0' },
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
 * Abwärtskompatibilität). **Achtung:** `pillars.userId` gehört bewusst NICHT mehr dazu — Säulen sind
 * globale Stammdaten; die Spalte wird von {@link migratePillarDropUserId} auf Bestands-DBs
 * **entfernt**. Der SQLite-Typ entspricht dem Sequelize-Datentyp `DataTypes.INTEGER`.
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
 * Stellt die früher globalen Säulen auf **nutzer-eigene** Stammdaten um (#421, Epic #420, Teil 1),
 * BEVOR `sequelize.sync()` läuft. Auf einer Bestands-DB:
 *
 *   1. zieht die nullbare Spalte `userId` an `pillars` nach (falls noch nicht vorhanden),
 *   2. droppt den alten globalen Unique-Index `pillars_name` auf (`name`),
 *   3. legt den neuen Unique-Index `pillars_name_user_id` auf (`name`, `userId`) an,
 *   4. klont für JEDEN Nutzer eine eigene Kopie jeder globalen (NULL-owned) Säule
 *      (Name/Gewicht/Beschreibung),
 *   5. hängt `task_pillars` der Nutzer-Tasks (`tasks.userId`) von der globalen Säule auf die
 *      nutzer-eigene Kopie um (gleicher Name),
 *   6. hängt `series_pillars` analog nach `series.userId` um.
 *
 * NULL-owned Säulen und die Zuordnungen von Tasks/Serien ohne `userId` bleiben unverändert bestehen.
 *
 * Vollständig idempotent: Spalte, Index und Klone werden per PRAGMA- bzw. COUNT-Checks abgesichert;
 * ein zweiter Lauf legt keine Klon-Dubletten an und ändert keine bereits umgehängten Beiträge.
 * No-op bei frischer DB (keine `pillars`-Tabelle) — `sync()` legt Tabelle inkl. Spalte und Index an.
 */
export const migratePillarPerUser = async (db: Sequelize): Promise<void> => {
	const [pillarCols] = await db.query("PRAGMA table_info('pillars')");
	const pillarColumns = (pillarCols as { name: string }[]).map((row) => row.name);

	// Keine pillars-Tabelle (frische DB) → No-op; sync() übernimmt Anlegen von Tabelle + Index.
	if (pillarColumns.length === 0) {
		return;
	}

	// 1. userId-Spalte nachziehen (nullbar, daher kein DEFAULT nötig).
	if (!pillarColumns.includes('userId')) {
		await db.query('ALTER TABLE `pillars` ADD COLUMN `userId` INTEGER');
		console.log('Spalte userId an pillars nachgezogen (#421).');
	}

	// 2. + 3. Alten globalen Index droppen, neuen Unique-Index (name, userId) anlegen.
	const [indexRows] = await db.query("PRAGMA index_list('pillars')");
	const indexNames = (indexRows as { name: string }[]).map((row) => row.name);
	if (indexNames.includes('pillars_name')) {
		await db.query('DROP INDEX IF EXISTS `pillars_name`');
	}
	if (!indexNames.includes('pillars_name_user_id')) {
		await db.query('CREATE UNIQUE INDEX IF NOT EXISTS `pillars_name_user_id` ON `pillars`(`name`, `userId`)');
	}

	// 2b. Inline-UNIQUE auf `name` entfernen — Altlast aus `name: { unique: true }` im alten Modell.
	// SQLite erzeugt dafür einen Auto-Index (`sqlite_autoindex_*`), der nicht per DROP INDEX
	// entfernt werden kann. Stattdessen die Tabelle ohne die Spalten-Constraint neu anlegen.
	// Der neue Composite-Index `pillars_name_user_id` übernimmt die Eindeutigkeit korrekt.
	const hasAutoIndex = indexNames.some((n) => n.startsWith('sqlite_autoindex_pillars_'));
	if (hasAutoIndex) {
		await db.query('PRAGMA foreign_keys = OFF');
		await db.query(
			'CREATE TABLE `pillars_new` (' +
				'`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'`name` VARCHAR(255) NOT NULL, ' +
				"`weight` FLOAT NOT NULL DEFAULT '20', " +
				'`createdAt` DATETIME NOT NULL, ' +
				'`updatedAt` DATETIME NOT NULL, ' +
				"`description` VARCHAR(255) NOT NULL DEFAULT '', " +
				'`userId` INTEGER' +
				')',
		);
		await db.query('INSERT INTO `pillars_new` SELECT * FROM `pillars`');
		await db.query('DROP TABLE `pillars`');
		await db.query('ALTER TABLE `pillars_new` RENAME TO `pillars`');
		// Composite-Index neu anlegen (wurde mit der Tabelle gelöscht)
		await db.query('CREATE UNIQUE INDEX IF NOT EXISTS `pillars_name_user_id` ON `pillars`(`name`, `userId`)');
		await db.query('PRAGMA foreign_keys = ON');
		console.log('Inline-UNIQUE constraint von pillars.name entfernt.');
	}

	// Welche (optionalen) Tabellen existieren? Auf schlanken Bestands-/Test-DBs können `tasks`,
	// `series` und deren Join-Tabellen fehlen — dann entfällt das jeweilige Umhängen.
	const [tableRows] = await db.query("SELECT `name` FROM `sqlite_master` WHERE `type` = 'table'");
	const tables = new Set((tableRows as { name: string }[]).map((row) => row.name));

	// users-Tabelle nötig für die nutzer-eigenen Klone; fehlt sie, gibt es nichts umzustellen.
	if (!tables.has('users')) {
		return;
	}
	const [userRows] = await db.query('SELECT `id` FROM `users`');
	const userIds = (userRows as { id: number }[]).map((row) => row.id);

	// Die globalen (NULL-owned) Säulen als Klon-Vorlage.
	const [globalRows] = await db.query(
		'SELECT `id`, `name`, `weight`, `description` FROM `pillars` WHERE `userId` IS NULL',
	);
	const globalPillars = globalRows as { id: number; name: string; weight: number; description: string }[];

	for (const userId of userIds) {
		// 4. Klonen — nur wenn der Nutzer noch keine eigenen Säulen hat (Idempotenz).
		const [ownRows] = await db.query('SELECT COUNT(*) AS c FROM `pillars` WHERE `userId` = ?', {
			replacements: [userId],
		});
		const ownCount = Number((ownRows as { c: number }[])[0]?.c ?? 0);
		if (ownCount === 0) {
			for (const pillar of globalPillars) {
				await db.query(
					'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
						'VALUES (:name, :weight, :description, :userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
					{ replacements: { name: pillar.name, weight: pillar.weight, description: pillar.description, userId } },
				);
			}
		}

		// 5. task_pillars der Nutzer-Tasks von globalen Säulen auf die nutzer-eigene Kopie umhängen.
		if (tables.has('task_pillars') && tables.has('tasks')) {
			await db.query(
				'UPDATE `task_pillars` SET `pillarId` = (' +
					'SELECT `own`.`id` FROM `pillars` `own` ' +
					'JOIN `pillars` `global` ON `global`.`name` = `own`.`name` ' +
					'WHERE `own`.`userId` = :userId AND `global`.`id` = `task_pillars`.`pillarId` AND `global`.`userId` IS NULL' +
					') WHERE `task_pillars`.`taskId` IN (SELECT `id` FROM `tasks` WHERE `userId` = :userId) ' +
					'AND EXISTS (' +
					'SELECT 1 FROM `pillars` `own` ' +
					'JOIN `pillars` `global` ON `global`.`name` = `own`.`name` ' +
					'WHERE `own`.`userId` = :userId AND `global`.`id` = `task_pillars`.`pillarId` AND `global`.`userId` IS NULL' +
					')',
				{ replacements: { userId } },
			);
		}

		// 6. series_pillars der Nutzer-Serien analog nach series.userId umhängen.
		if (tables.has('series_pillars') && tables.has('series')) {
			await db.query(
				'UPDATE `series_pillars` SET `pillarId` = (' +
					'SELECT `own`.`id` FROM `pillars` `own` ' +
					'JOIN `pillars` `global` ON `global`.`name` = `own`.`name` ' +
					'WHERE `own`.`userId` = :userId AND `global`.`id` = `series_pillars`.`pillarId` AND `global`.`userId` IS NULL' +
					') WHERE `series_pillars`.`seriesId` IN (SELECT `id` FROM `series` WHERE `userId` = :userId) ' +
					'AND EXISTS (' +
					'SELECT 1 FROM `pillars` `own` ' +
					'JOIN `pillars` `global` ON `global`.`name` = `own`.`name` ' +
					'WHERE `own`.`userId` = :userId AND `global`.`id` = `series_pillars`.`pillarId` AND `global`.`userId` IS NULL' +
					')',
				{ replacements: { userId } },
			);
		}
	}
};

/**
 * Zieht die nullbare `userId`-Spalte an `pillar_feedback` nach (#430, AK3), BEVOR `sequelize.sync()`
 * läuft. `sync()` ohne `alter` ergänzt vorhandene Tabellen nicht um neue Spalten — die Spalte fehlt
 * auf einer Bestands-DB, und `loadFeedbackExamples({ where: { userId } })` bräche mit
 * `SQLITE_ERROR: no such column: userId`.
 *
 * Idempotent: Bereits vorhandene Spalten werden übersprungen, mehrfache Aufrufe bleiben stabil.
 * Fehlt die Tabelle ganz (frische DB), ist die Migration ein No-op — `sync()` legt danach Tabelle
 * inkl. Spalte korrekt an. Die Spalte bleibt nullbar, damit historische (vor #430 global angelegte)
 * Samples erhalten bleiben; die Klassifikation ignoriert sie bewusst (siehe `loadFeedbackExamples`).
 */
export const migratePillarFeedbackUserId = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('pillar_feedback')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('userId')) {
		return;
	}
	await db.query('ALTER TABLE `pillar_feedback` ADD COLUMN `userId` INTEGER');
	console.log('Spalte userId an pillar_feedback nachgezogen (#430).');
};

/**
 * Zieht die `kind`- und `builtin_key`-Spalten auf einer **bestehenden** `llm_providers`-Tabelle
 * nach (Built-in-Provider Mistral/OpenRouter mit ENV-Keys). `sequelize.sync()` ohne `alter`
 * ergänzt vorhandene Tabellen nicht um neue Spalten — ohne Nachziehen bräche jeder Provider-Zugriff
 * mit `no such column: kind`.
 *
 * `kind` ist NOT NULL und braucht daher zwingend einen DEFAULT (SQLite-Constraint): `'custom'` —
 * Bestandszeilen aus #951 sind Custom-Provider. `builtin_key` ist nullable. Die zwei Built-in-
 * Zeilen legt der Service lazy an (`ensureBuiltins`), nicht diese Migration. Idempotent; No-op bei
 * frischer DB (keine `llm_providers`-Tabelle) — `sync()` legt Tabelle inkl. Spalten an.
 */
export const migrateLlmProviderKindColumns = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('llm_providers')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0) {
		return;
	}
	if (!existing.includes('kind')) {
		await db.query("ALTER TABLE `llm_providers` ADD COLUMN `kind` VARCHAR(255) NOT NULL DEFAULT 'custom'");
		console.log('Spalte kind an llm_providers nachgezogen.');
	}
	if (!existing.includes('builtin_key')) {
		await db.query('ALTER TABLE `llm_providers` ADD COLUMN `builtin_key` VARCHAR(255)');
		console.log('Spalte builtin_key an llm_providers nachgezogen.');
	}
};

/**
 * Zieht die `checklist`-Spalte (JSON-Array, #531) auf einer **bestehenden** `tasks`-Tabelle nach,
 * BEVOR `sequelize.sync()` läuft. `sync()` ohne `alter` ergänzt vorhandene Tabellen nicht um neue
 * Spalten — ohne Nachziehen bräche jeder Lese-/Schreibzugriff mit `no such column`. Bestehende Tasks
 * erhalten den Default `[]` (rückwärtskompatibel, unverändert). Idempotent (Spalte vorhanden → No-op);
 * bei frischer DB (keine `tasks`-Tabelle) ebenso No-op — `sync()` legt die Spalte inkl. Default an.
 */
export const migrateTaskChecklist = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('checklist')) {
		return;
	}
	await db.query("ALTER TABLE `tasks` ADD COLUMN `checklist` JSON NOT NULL DEFAULT '[]'");
	console.log('Spalte checklist an tasks nachgezogen (#531).');
};
