import type { Sequelize } from 'sequelize';

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
