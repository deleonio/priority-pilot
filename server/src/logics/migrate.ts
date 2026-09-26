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
	// Standort-Koordinaten (#1066): nullable, daher kein NOT NULL/DEFAULT nötig. Bestand bleibt `NULL`.
	{ name: 'latitude', definition: 'FLOAT' },
	{ name: 'longitude', definition: 'FLOAT' },
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
	// Ersteller-Konto (#1222, analog `Task.createdById` #1213): nullable, daher kein DEFAULT nötig;
	// Bestandsserien bleiben ohne Ersteller-Eintrag (NULL, lesbar und unverändert).
	{ name: 'createdById', definition: 'INTEGER' },
	// Freitext-Beschreibung (#301): nullable, daher kein NOT NULL/DEFAULT nötig.
	{ name: 'description', definition: 'TEXT' },
	// Serien-Ortsbezug (#1063), analog `Task.address`: nullable, daher kein NOT NULL/DEFAULT nötig.
	{ name: 'address', definition: 'VARCHAR(255)' },
	// Auto-Löschung bei verpasster Deadline (#523): NOT NULL DEFAULT 0 (SQLite verlangt DEFAULT bei
	// nachträglichem ADD COLUMN); wird beim Generieren auf die Instanzen vererbt.
	{ name: 'autoDeleteAfterDeadline', definition: 'INTEGER NOT NULL DEFAULT 0' },
	// Standort-Koordinaten des Serien-Orts (#1066): nullable, daher kein NOT NULL/DEFAULT nötig.
	{ name: 'latitude', definition: 'FLOAT' },
	{ name: 'longitude', definition: 'FLOAT' },
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
	// Rohabfrage ohne generierten Sequelize-Typ: `sqlite_master` liefert nur plain Name-Zeilen,
	// deshalb der Cast auf unknown[] statt eines Modell-Typs (Muster `graph.ts`, #1471).
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
 * Zieht die nullable `imageUrl`-Spalte (Gruppenbild, #1225) auf einer **bestehenden** `groups`-
 * Tabelle nach, bevor `sequelize.sync()` läuft — sync() ohne `alter` ergänzt vorhandene Tabellen
 * nicht um neue Spalten, jede Gruppen-Query mit `imageUrl` würde sonst mit `no such column` brechen.
 * Idempotent (Spalte vorhanden → übersprungen); No-op bei frischer DB.
 */
export const migrateGroupImageUrl = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('groups')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('imageUrl')) {
		return;
	}

	await db.query('ALTER TABLE `groups` ADD COLUMN `imageUrl` VARCHAR(255)');
	console.log('Spalte imageUrl an groups nachgezogen.');
};

/**
 * Entfernt die `name`-Spalte von einer **bestehenden** `place_favorites`-Tabelle (#1595). Seit dem
 * Wegfall des Anzeigenamens schreibt keine Route mehr `name`; die Spalte ist auf Bestands-DBs aber
 * `NOT NULL` ohne Default, jedes `INSERT` bräche sonst mit `NOT NULL constraint failed`.
 * `sequelize.sync()` ohne `alter` entfernt Spalten nicht. Die Adresse bleibt unverändert erhalten,
 * verloren geht nur der (laut Ticket ersatzlos entfallende) Name.
 * Idempotent (Spalte fehlt → übersprungen); No-op bei frischer DB.
 */
export const migratePlaceFavoriteDropName = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('place_favorites')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || !existing.has('name')) {
		return;
	}

	await db.query('ALTER TABLE `place_favorites` DROP COLUMN `name`');
	console.log('Spalte name aus place_favorites entfernt (#1595).');
};

/**
 * Legt den Unique-Index `(userId, address)` auf einer **bestehenden** `place_favorites`-Tabelle an
 * (#1595, AK4) und räumt vorher Altbestands-Duplikate weg. Ohne diesen Index ist die Dedup-Prüfung
 * der Route ein reines Read-then-Write: zwei gleichzeitige POSTs mit derselben Adresse sehen beide
 * noch keinen Eintrag und legen beide einen an.
 *
 * Reihenfolge ist Pflicht: `CREATE UNIQUE INDEX` scheitert, solange doppelte Zeilen existieren —
 * deshalb behält der Lauf je (`userId`, kleingeschriebene Adresse) die **älteste** Zeile (kleinste
 * `id`, die der Nutzer zuerst gespeichert hat) und löscht die übrigen. Groß-/Kleinschreibung und
 * Leerraum werden dabei genauso normalisiert wie in der Route (`normalizeAddress`).
 *
 * Idempotent (Index vorhanden → übersprungen); No-op bei frischer DB — dort legt `sync()` den im
 * Modell deklarierten Index selbst an.
 */
export const migratePlaceFavoriteAddressUnique = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('place_favorites')");
	if ((columns as { name: string }[]).length === 0) {
		return;
	}

	const [indexRows] = await db.query("PRAGMA index_list('place_favorites')");
	const indexNames = (indexRows as { name: string }[]).map((row) => row.name);
	if (indexNames.includes('place_favorites_user_id_address')) {
		return;
	}

	await db.query(
		'DELETE FROM `place_favorites` WHERE `id` NOT IN (' +
			'SELECT MIN(`id`) FROM `place_favorites` GROUP BY `userId`, LOWER(TRIM(`address`))' +
			')',
	);
	await db.query(
		'CREATE UNIQUE INDEX IF NOT EXISTS `place_favorites_user_id_address` ON `place_favorites`(`userId`, `address`)',
	);
	console.log('Unique-Index place_favorites_user_id_address angelegt (#1595).');
};

/**
 * Legt den Unique-Index `(provider, externalSubscriptionId)` auf einer **bestehenden**
 * `subscriptions`-Tabelle an (#1690): Ohne ihn legen zwei gleichzeitig eingereichte Play-Käufe
 * desselben Tokens zwei Abos an. Anders als bei den Orten löscht der Lauf keine Duplikate, denn an
 * Abos hängen Rechnungen; gibt es welche, bleibt der Index aus und der Server meldet es.
 *
 * Idempotent (Index vorhanden → übersprungen); No-op bei frischer DB — dort legt `sync()` den im
 * Modell deklarierten Index selbst an.
 */
export const migrateSubscriptionExternalIdUnique = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('subscriptions')");
	if ((columns as { name: string }[]).length === 0) {
		return;
	}
	const [indexRows] = await db.query("PRAGMA index_list('subscriptions')");
	if ((indexRows as { name: string }[]).some((row) => row.name === 'subscriptions_provider_external_subscription_id')) {
		return;
	}
	const [duplicates] = await db.query(
		'SELECT `provider`, `externalSubscriptionId` FROM `subscriptions` GROUP BY `provider`, `externalSubscriptionId` HAVING COUNT(*) > 1',
	);
	if ((duplicates as unknown[]).length > 0) {
		console.warn('subscriptions enthält doppelte Käufe je Anbieter, Unique-Index (#1690) nicht angelegt.');
		return;
	}
	await db.query(
		'CREATE UNIQUE INDEX IF NOT EXISTS `subscriptions_provider_external_subscription_id` ON `subscriptions`(`provider`, `externalSubscriptionId`)',
	);
	console.log('Unique-Index subscriptions_provider_external_subscription_id angelegt (#1690).');
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
 * Führt den Säulen-Bestand jedes Nutzers auf EXAKT die fünf festen Standard-Säulen zurück
 * (#1573), BEVOR `sequelize.sync()` läuft und NACH `migratePillarPerUser` (braucht dessen
 * `userId`-Spalte). Pro Nutzer:
 *
 *   1. umbenannte Standard-Säulen: Zeilen ohne Standard-Namen füllen die Lücken fehlender
 *      Standard-Namen (Reihenfolge: Zeilen nach id, Lücken in SEED-PILLARS-Reihenfolge) —
 *      die id bleibt dieselbe, damit die id-basierten Beiträge (task_pillars/series_pillars)
 *      unverändert erhalten bleiben;
 *   2. zusätzliche Säulen (überschüssige Zeilen ohne Standard-Namen): mitsamt ihrer Beiträge
 *      entfernt (folgt der bisherigen DELETE-Semantik aus `routes/pillars.ts`);
 *   3. fehlende Standard-Säulen: neu angelegt — Gewicht nach AK5: Ist die Summe der
 *      verbliebenen Gewichte <= 100, füllen die neuen den Rest gleichmäßig auf, sonst werden
 *      alle proportional auf 100 renormiert und die neuen starten bei 0.
 *
 * Idempotent: Ein zweiter Lauf findet exakt die 5 Standard-Namen vor und ändert nichts.
 * No-op bei frischer DB (keine `pillars`-Tabelle) — Seed und sync() übernehmen dort.
 */
export const migratePillarRestore = async (db: Sequelize): Promise<void> => {
	const [pillarCols] = await db.query("PRAGMA table_info('pillars')");
	if ((pillarCols as { name: string }[]).length === 0) {
		return;
	}

	const [tableRows] = await db.query("SELECT `name` FROM `sqlite_master` WHERE `type` = 'table'");
	const tables = new Set((tableRows as { name: string }[]).map((row) => row.name));
	if (!tables.has('users')) {
		return;
	}

	const standardNames = SEED_PILLARS.map((pillar) => pillar.name);
	const [userRows] = await db.query('SELECT `id` FROM `users`');
	const userIds = (userRows as { id: number }[]).map((row) => row.id);

	for (const userId of userIds) {
		const [ownRows] = await db.query(
			'SELECT `id`, `name`, `weight` FROM `pillars` WHERE `userId` = ? ORDER BY `id` ASC',
			{
				replacements: [userId],
			},
		);
		const own = ownRows as { id: number; name: string; weight: number }[];

		const owned = new Set(own.map((row) => row.name));
		const missing = standardNames.filter((name) => !owned.has(name));
		const extras = own.filter((row) => !standardNames.includes(row.name));

		// 1. Umbenannte Zeilen füllen die Lücken (id-Reihenfolge auf SEED-Reihenfolge gepaart) —
		// Reset per UPDATE auf demselben Datensatz, damit Beiträge an der id hängen bleiben.
		const renamedCount = Math.min(missing.length, extras.length);
		for (let i = 0; i < renamedCount; i += 1) {
			await db.query('UPDATE `pillars` SET `name` = ? WHERE `id` = ?', {
				replacements: [missing[i], extras[i]!.id],
			});
		}

		// 2. Überschüssige zusätzliche Säulen mitsamt Beiträgen entfernen (DELETE-Semantik #428/#1573).
		for (let i = renamedCount; i < extras.length; i += 1) {
			const extraId = extras[i]!.id;
			if (tables.has('task_pillars')) {
				await db.query('DELETE FROM `task_pillars` WHERE `pillarId` = ?', { replacements: [extraId] });
			}
			if (tables.has('series_pillars')) {
				await db.query('DELETE FROM `series_pillars` WHERE `pillarId` = ?', { replacements: [extraId] });
			}
			await db.query('DELETE FROM `pillars` WHERE `id` = ?', { replacements: [extraId] });
		}

		// 3. Fehlende Standard-Säulen anlegen (Name/Beschreibung aus SEED_PILLARS, Gewicht nach AK5).
		const toCreate = missing.slice(renamedCount);
		if (toCreate.length === 0) {
			continue;
		}
		const [currentRows] = await db.query('SELECT `id`, `weight` FROM `pillars` WHERE `userId` = ?', {
			replacements: [userId],
		});
		const current = currentRows as { id: number; weight: number }[];
		const keptSum = current.reduce((acc, row) => acc + row.weight, 0);

		let createWeight: number;
		if (keptSum > 100) {
			// Renormierung der verbliebenen Säulen auf 100 (Faktor), neue Säulen starten bei 0.
			const factor = 100 / keptSum;
			for (const row of current) {
				await db.query('UPDATE `pillars` SET `weight` = ? WHERE `id` = ?', {
					replacements: [row.weight * factor, row.id],
				});
			}
			createWeight = 0;
		} else {
			// Rest bis 100 gleichmäßig auf die neuen Säulen verteilen.
			createWeight = (100 - keptSum) / toCreate.length;
		}

		for (const name of toCreate) {
			const seed = SEED_PILLARS.find((pillar) => pillar.name === name)!;
			await db.query(
				'INSERT INTO `pillars` (`name`, `weight`, `description`, `userId`, `createdAt`, `updatedAt`) ' +
					'VALUES (:name, :weight, :description, :userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
				{ replacements: { name: seed.name, weight: createWeight, description: seed.description, userId } },
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
 * Zieht die nullbare `userId`-Spalte an `llm_providers` nach (#1547 — Provider pro Nutzer), BEVOR
 * `sequelize.sync()` läuft. `sync()` ohne `alter` ergänzt vorhandene Tabellen nicht um neue Spalten
 * — ohne Nachziehen bräche der nutzerbezogene Scope (`userId IS NULL OR userId = …`) mit
 * `SQLITE_ERROR: no such column: userId`.
 *
 * Idempotent: Bereits vorhandene Spalten werden übersprungen, mehrfache Aufrufe bleiben stabil.
 * Fehlt die Tabelle ganz (frische DB), ist die Migration ein No-op — `sync()` legt danach Tabelle
 * inkl. Spalte korrekt an. Die Spalte bleibt nullbar: Bestandszeilen (inkl. Built-ins) gelten
 * weiter instanzweit und bleiben für alle Nutzer sichtbar.
 */
export const migrateLlmProviderUserId = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('llm_providers')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('userId')) {
		return;
	}
	await db.query('ALTER TABLE `llm_providers` ADD COLUMN `userId` INTEGER');
	console.log('Spalte userId an llm_providers nachgezogen (#1547).');
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

/**
 * Zieht die `groupId`-Spalte (Gruppen-Adressierung, #1521) auf einer **bestehenden** `tasks`-Tabelle
 * nach, BEVOR `sequelize.sync()` läuft — analog `migrateTaskChecklist`. Nullable, daher kein Default;
 * Bestandsaufgaben bleiben ohne Gruppenbezug (`NULL`). Idempotent (Spalte vorhanden → No-op).
 */
export const migrateTaskGroupId = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('groupId')) {
		return;
	}
	await db.query('ALTER TABLE `tasks` ADD COLUMN `groupId` INTEGER');
	console.log('Spalte groupId an tasks nachgezogen (#1521).');
};

/**
 * Zieht die `address`-Spalte (Aufgabenort, Adresssuche im Formular) auf einer **bestehenden**
 * `tasks`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog `migrateTaskChecklist`. Nullable,
 * daher kein Default nötig; bestehende Tasks bleiben ohne Adresse (`NULL`). Idempotent (Spalte
 * vorhanden → No-op); bei frischer DB ebenso No-op — `sync()` legt die Spalte an.
 */
export const migrateTaskAddress = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('address')) {
		return;
	}
	await db.query('ALTER TABLE `tasks` ADD COLUMN `address` VARCHAR(255)');
	console.log('Spalte address an tasks nachgezogen.');
};

/**
 * Geo-Config-Spalten am User (#1098: Anzeige-/Alarm-Entfernung, Positionsermittlungs-Intervall)
 * mit denselben Defaults wie das Modell (`server/src/models/user.ts`) bzw. `GEO_CONFIG_DEFAULTS`
 * der Route. `NOT NULL` mit Default, damit SQLite die Spalte auf Bestands-Zeilen füllen kann
 * (ALTER TABLE ADD COLUMN NOT NULL erfordert einen DEFAULT-Wert, siehe migratePillarDescription).
 */
const USER_GEO_COLUMNS = [
	{ column: 'displayDistanceKm', definition: 'INTEGER NOT NULL DEFAULT 5' },
	{ column: 'alarmDistanceKm', definition: 'INTEGER NOT NULL DEFAULT 1' },
	{ column: 'intervalMinutes', definition: 'INTEGER NOT NULL DEFAULT 5' },
] as const;

/**
 * Zieht die Geo-Config-Spalten auf einer **bestehenden** `users`-Tabelle nach, BEVOR
 * `sequelize.sync()` läuft — analog `migrateUserIdColumns`: `sync()` ohne `alter` ergänzt
 * vorhandene Tabellen NICHT um neue Spalten; jede User-Query (Login, `/geo-config`,
 * `/tasks/nearby`) würde sonst mit `no such column: displayDistanceKm` brechen (#1103 F1).
 *
 * Idempotent: Bereits vorhandene Spalten werden übersprungen, mehrfache Aufrufe bleiben stabil.
 * Fehlt die Tabelle ganz (frische DB), ist die Migration ein No-op — `sync()` legt danach Tabelle
 * inkl. Spalten an.
 */
export const migrateUserGeoConfigColumns = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0) {
		return;
	}
	for (const { column, definition } of USER_GEO_COLUMNS) {
		if (!existing.includes(column)) {
			await db.query(`ALTER TABLE \`users\` ADD COLUMN \`${column}\` ${definition}`);
			console.log(`Spalte ${column} an users nachgezogen.`);
		}
	}
};

/**
 * Zieht die `displayNameCustom`-Flag-Spalte auf einer **bestehenden** `users`-Tabelle nach
 * (#1256) — analog `migrateUsersAvatarUrl`, aber NOT NULL mit Default 0: die Flag markiert,
 * dass der Nutzer seinen Anzeigenamen selbst gesetzt hat, und schützt ihn so vor dem
 * OAuth-Profil-Sync (`upsertOAuthUser`). `sequelize.sync()` ohne `alter` ergänzt die Spalte
 * nicht, jede User-Query mit der Flag würde mit `no such column` brechen. Bestandskonten
 * starten mit 0 (Ursprung des Namens ist nachträglich nicht unterscheidbar — sie folgen dem
 * Google-Profil, bis sie selbst speichern). Idempotent; No-op bei frischer DB.
 */
export const migrateUsersDisplayNameCustom = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('displayNameCustom')) {
		return;
	}

	await db.query('ALTER TABLE `users` ADD COLUMN `displayNameCustom` TINYINT NOT NULL DEFAULT 0');
	console.log('Spalte displayNameCustom an users nachgezogen.');
};

/**
 * Zieht die `role`-Spalte (Rollensystem admin/member) auf einer **bestehenden** `users`-Tabelle
 * nach — analog `migrateUsersDisplayNameCustom`. `sequelize.sync()` ohne `alter` ergänzt die
 * Spalte nicht, jede User-Query (Login, `/auth/me`, Admin-API) würde sonst mit
 * `no such column: role` brechen. Bestandskonten starten als `'member'` — Beförderung zu
 * `'admin'` läuft über `ADMIN_EMAILS` (siehe `logics/adminEmails.ts`) oder die Admin-API.
 * Idempotent; No-op bei frischer DB (dann legt `sync()` die Spalte samt Default an).
 */
export const migrateUsersRoleColumn = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('role')) {
		return;
	}

	await db.query("ALTER TABLE `users` ADD COLUMN `role` VARCHAR(255) NOT NULL DEFAULT 'member'");
	console.log('Spalte role an users nachgezogen.');
};

/**
 * Zieht die `plan`-Spalte (Paket `'free' | 'pro' | 'max' | 'ultimate'`, #1456) auf einer
 * **bestehenden** `users`-Tabelle nach — analog `migrateUsersRoleColumn`. Bestandskonten starten
 * als `'free'` (kein stilles Hochstufen); Pakete vergibt bis T7 ausschließlich ein Admin über
 * `PATCH /admin/users/:id/plan`. Idempotent; No-op bei frischer DB (dann legt `sync()` die Spalte
 * samt Default an).
 */
export const migrateUsersPlanColumn = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('plan')) {
		return;
	}

	await db.query("ALTER TABLE `users` ADD COLUMN `plan` VARCHAR(255) NOT NULL DEFAULT 'free'");
	console.log('Spalte plan an users nachgezogen.');
};

/**
 * Zieht die `selectedLlmProviderId`-Spalte (eigene Provider-Auswahl, #1548) auf einer
 * **bestehenden** `users`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog
 * `migrateUsersPlanColumn`. Bestandskonten starten ohne Auswahl (`NULL` = instanzweit aktiver
 * Provider). Idempotent (Spalte vorhanden → No-op); bei frischer DB ebenso No-op — `sync()`
 * legt Tabelle inkl. Spalte an.
 */
export const migrateUsersSelectedLlmProvider = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('users')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('selectedLlmProviderId')) {
		return;
	}

	await db.query('ALTER TABLE `users` ADD COLUMN `selectedLlmProviderId` INTEGER NULL');
	console.log('Spalte selectedLlmProviderId an users nachgezogen.');
};

/**
 * Zieht die `scope`-Spalte (Rechtestufe `'read'` | `'readwrite'`, #1356) auf einer **bestehenden**
 * `api_tokens`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog `migrateUsersRoleColumn`.
 * Bestandszeilen erhalten `'read'` (kein stilles Hochstufen bereits vergebener Tokens). Idempotent
 * (Spalte vorhanden → No-op); bei frischer DB ebenso No-op — `sync()` legt Tabelle inkl. Spalte an.
 */
export const migrateApiTokenScope = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('api_tokens')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('scope')) {
		return;
	}

	await db.query("ALTER TABLE `api_tokens` ADD COLUMN `scope` VARCHAR(255) NOT NULL DEFAULT 'read'");
	console.log('Spalte scope an api_tokens nachgezogen.');
};

/**
 * Zieht die nullbare `expiresAt`-Spalte (Pflicht-Ablaufdatum, #1357) auf einer **bestehenden**
 * `api_tokens`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog `migrateTaskCreatedById`.
 * Nullable, daher kein Default nötig: Bestandstokens bleiben ohne Ablaufdatum gültig (kein
 * rückwirkendes Entwerten, AK3). Idempotent (Spalte vorhanden → No-op); bei frischer DB ebenso
 * No-op — `sync()` legt die Spalte an.
 */
export const migrateApiTokenExpiresAt = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('api_tokens')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('expiresAt')) {
		return;
	}

	await db.query('ALTER TABLE `api_tokens` ADD COLUMN `expiresAt` DATETIME');
	console.log('Spalte expiresAt an api_tokens nachgezogen.');
};

/**
 * Zieht die `purpose`-Spalte (#1669) auf einer **bestehenden** `login_tokens`-Tabelle nach, bevor
 * `sequelize.sync()` läuft. Bestehende Zeilen sind Magic-Link-Tokens (`magic`). Idempotent
 * (Spalte vorhanden → No-op); bei frischer DB ebenso No-op — `sync()` legt die Spalte an.
 */
export const migrateLoginTokenPurpose = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('login_tokens')");
	const existing = new Set((columns as { name: string }[]).map((column) => column.name));

	if (existing.size === 0 || existing.has('purpose')) {
		return;
	}

	await db.query("ALTER TABLE `login_tokens` ADD COLUMN `purpose` VARCHAR(255) NOT NULL DEFAULT 'magic'");
	console.log('Spalte purpose an login_tokens nachgezogen.');
};

/**
 * Zieht die nullbare `createdById`-Spalte (Ersteller-Konto, #1213) auf einer **bestehenden**
 * `tasks`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog `migrateTaskAddress`. Nullable,
 * daher kein Default nötig; bestehende Tasks bleiben ohne Ersteller-Eintrag (`NULL`, AK6:
 * lesbar und unverändert). Idempotent (Spalte vorhanden → No-op); bei frischer DB ebenso
 * No-op — `sync()` legt die Spalte an.
 */
export const migrateTaskCreatedById = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0 || existing.includes('createdById')) {
		return;
	}
	await db.query('ALTER TABLE `tasks` ADD COLUMN `createdById` INTEGER');
	console.log('Spalte createdById an tasks nachgezogen (#1213).');
};

/**
 * Zieht die nullbare `categoryId`-Spalte (thematische Kategorie, 0..1) auf **bestehenden**
 * `tasks`- und `series`-Tabellen nach, BEVOR `sequelize.sync()` läuft — analog
 * `migrateTaskCreatedById`. Nullable, daher kein Default nötig: Bestandsdaten bleiben ohne
 * Kategorie (`NULL`). Idempotent (Spalte vorhanden → No-op); bei frischer DB ebenso No-op, dann
 * legt `sync()` Spalte und Tabelle `categories` selbst an.
 */
export const migrateCategoryIdColumns = async (db: Sequelize): Promise<void> => {
	for (const table of ['tasks', 'series'] as const) {
		const [columns] = await db.query(`PRAGMA table_info('${table}')`);
		const existing = (columns as { name: string }[]).map((column) => column.name);

		if (existing.length === 0 || existing.includes('categoryId')) {
			continue;
		}
		await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`categoryId\` INTEGER`);
		console.log(`Spalte categoryId an ${table} nachgezogen.`);
	}
};

/**
 * Zieht die Pin-Spalten (#1582) auf einer **bestehenden** `tasks`-Tabelle nach, BEVOR
 * `sequelize.sync()` läuft — analog `migrateUserGeoConfigColumns`. `pinned` ist `NOT NULL DEFAULT
 * 0` (ALTER TABLE ADD COLUMN NOT NULL erfordert einen DEFAULT-Wert), `pinnedAt` bleibt nullable
 * (nur beim Anpinnen gesetzt). Idempotent: bereits vorhandene Spalten werden übersprungen; bei
 * frischer DB No-op — `sync()` legt beide Spalten an.
 */
export const migrateTaskPinnedColumns = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('tasks')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0) {
		return;
	}
	if (!existing.includes('pinned')) {
		await db.query('ALTER TABLE `tasks` ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT 0');
		console.log('Spalte pinned an tasks nachgezogen.');
	}
	if (!existing.includes('pinnedAt')) {
		await db.query('ALTER TABLE `tasks` ADD COLUMN `pinnedAt` DATETIME');
		console.log('Spalte pinnedAt an tasks nachgezogen.');
	}
};

/**
 * Säulen-Neuberechnung fortsetzbar machen (#1614): `tasks.pillarsRecalculatedAt` (wann die
 * Verteilung einer Aufgabe zuletzt neu bestimmt wurde) und `users.pillarRecalcStartedAt` (Start des
 * letzten Laufs). Beide nullable. Idempotent; bei frischer DB No-op — `sync()` legt die Spalten an.
 */
export const migratePillarRecalcColumns = async (db: Sequelize): Promise<void> => {
	const [taskColumns] = await db.query("PRAGMA table_info('tasks')");
	const taskExisting = (taskColumns as { name: string }[]).map((column) => column.name);
	if (taskExisting.length > 0 && !taskExisting.includes('pillarsRecalculatedAt')) {
		await db.query('ALTER TABLE `tasks` ADD COLUMN `pillarsRecalculatedAt` DATETIME');
		console.log('Spalte pillarsRecalculatedAt an tasks nachgezogen.');
	}
	const [userColumns] = await db.query("PRAGMA table_info('users')");
	const userExisting = (userColumns as { name: string }[]).map((column) => column.name);
	if (userExisting.length > 0 && !userExisting.includes('pillarRecalcStartedAt')) {
		await db.query('ALTER TABLE `users` ADD COLUMN `pillarRecalcStartedAt` DATETIME');
		console.log('Spalte pillarRecalcStartedAt an users nachgezogen.');
	}
};

/**
 * Zieht die Pending-Plan-Spalten (#1505) und `firstFailureAt` (#1506) auf einer **bestehenden**
 * `subscriptions`-Tabelle nach, BEVOR `sequelize.sync()` läuft — analog
 * `migrateTaskPinnedColumns`. Alle drei sind nullable (kein DEFAULT nötig), Bestandsabos bleiben
 * ohne Vormerkung. Idempotent: bereits vorhandene Spalten werden übersprungen; bei frischer DB
 * No-op — `sync()` legt Tabelle inkl. Spalten an.
 */
export const migrateSubscriptionPendingPlanColumns = async (db: Sequelize): Promise<void> => {
	const [columns] = await db.query("PRAGMA table_info('subscriptions')");
	const existing = (columns as { name: string }[]).map((column) => column.name);

	if (existing.length === 0) {
		return;
	}
	if (!existing.includes('pendingPlan')) {
		await db.query('ALTER TABLE `subscriptions` ADD COLUMN `pendingPlan` VARCHAR(255)');
		console.log('Spalte pendingPlan an subscriptions nachgezogen.');
	}
	if (!existing.includes('pendingPlanEffectiveAt')) {
		await db.query('ALTER TABLE `subscriptions` ADD COLUMN `pendingPlanEffectiveAt` DATETIME');
		console.log('Spalte pendingPlanEffectiveAt an subscriptions nachgezogen.');
	}
	if (!existing.includes('firstFailureAt')) {
		await db.query('ALTER TABLE `subscriptions` ADD COLUMN `firstFailureAt` DATETIME');
		console.log('Spalte firstFailureAt an subscriptions nachgezogen.');
	}
};
