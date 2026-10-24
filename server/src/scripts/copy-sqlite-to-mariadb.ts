import { pathToFileURL } from 'node:url';
import { DataTypes, Model, ModelStatic, QueryTypes, Sequelize, Transaction } from 'sequelize';
// Registriert ALLE Modelle auf der Default-Instanz — ohne diesen Import ist `target.models` leer.
import '../models/index.js';
import sequelize from '../database.js';

// Einmaliges Kopierwerkzeug SQLite → MariaDB (ADR 0026, #2827), Vertrag: docs/spec/issue-2827.md.
// CLI-Aufruf (tsx): DB_DIALECT=mysql MARIADB_HOST=… MARIADB_USER=… MARIADB_PASSWORD=…
// MARIADB_DATABASE=… DATABASE_STORAGE=<Pfad zur SQLite-Datei> node --import tsx src/scripts/copy-sqlite-to-mariadb.ts
// Exit-Code 0 nur bei vollständiger Übereinstimmung (reportExitCode).

export type TableCount = { table: string; source: number; target: number };
export type BlobSample = { checked: number; mismatched: number };
export type CopyReport = { tables: TableCount[]; blobs: BlobSample; ok: boolean };

export const tableOf = (model: ModelStatic<Model>): string => {
	const name = model.getTableName();
	return typeof name === 'string' ? name : name.tableName;
};

const quoted = (db: Sequelize, table: string): string => db.getQueryInterface().quoteIdentifier(table);

const selectAll = async (db: Sequelize, sql: string): Promise<Array<Record<string, unknown>>> =>
	(await db.query(sql, { type: QueryTypes.SELECT })) as Array<Record<string, unknown>>;

const countRows = async (db: Sequelize, table: string): Promise<number> => {
	const rows = await selectAll(db, `SELECT COUNT(*) AS n FROM ${quoted(db, table)}`);
	return Number(rows[0]?.n ?? 0);
};

/** Tabellenauswahl = übergebene Modelle ∩ existierende Quell-Tabellen, FK-topologisch geordnet. */
export const selectedModels = async (
	source: Sequelize,
	models: ModelStatic<Model>[],
): Promise<ModelStatic<Model>[]> => {
	const sourceTables = new Set((await source.getQueryInterface().showAllTables()).map((name) => name.toLowerCase()));
	const selected = models.filter((model) => sourceTables.has(tableOf(model).toLowerCase()));
	// Voraussetzungen je Tabelle: Referenzierte Tabellen zuerst (BelongsTo/FK auf eigener Tabelle),
	// Join-Tabellen (BelongsToMany/Through) nach beiden Seiten des n:m.
	const prerequisites = new Map<string, Set<string>>(selected.map((model) => [tableOf(model), new Set<string>()]));
	for (const model of selected) {
		const own = tableOf(model);
		for (const association of Object.values(model.associations)) {
			if (association.associationType === 'BelongsTo') {
				const referenced = tableOf(association.target);
				if (referenced !== own && prerequisites.has(referenced)) prerequisites.get(own)?.add(referenced);
			} else if (association.associationType === 'BelongsToMany') {
				const through = (association as unknown as { through?: { model?: ModelStatic<Model> } }).through?.model;
				const throughTable = through ? tableOf(through) : '';
				const other = tableOf(association.target);
				if (throughTable && throughTable !== own && prerequisites.has(throughTable)) {
					prerequisites.get(throughTable)?.add(own);
					if (other !== own && prerequisites.has(other)) prerequisites.get(throughTable)?.add(other);
				}
			}
		}
	}
	const remaining = new Set(selected.map(tableOf));
	const byTable = new Map(selected.map((model) => [tableOf(model), model]));
	const order: ModelStatic<Model>[] = [];
	while (remaining.size > 0) {
		const ready = [...remaining].filter((table) =>
			[...(prerequisites.get(table) ?? [])].every((pre) => !remaining.has(pre)),
		);
		if (ready.length === 0) {
			// Zirkelreferenz: Rest in stabiler Reihenfolge anhängen (FK-Checks sind im Lauf aus).
			order.push(...[...remaining].map((table) => byTable.get(table) as ModelStatic<Model>));
			break;
		}
		for (const table of ready) {
			order.push(byTable.get(table) as ModelStatic<Model>);
			remaining.delete(table);
		}
	}
	return order;
};

/** Feld→Attribut-Remapping für Modelle mit underscored-Spalten (z. B. llmProvider). */
const columnToAttribute = (model: ModelStatic<Model>): Map<string, string> => {
	const map = new Map<string, string>();
	for (const [name, attribute] of Object.entries(model.getAttributes())) {
		if (typeof attribute.field === 'string' && attribute.field !== name) map.set(attribute.field, name);
	}
	return map;
};

/** Dialektabhängiges Session-Statement: mysql nur SET FOREIGN_KEY_CHECKS, sqlite nur PRAGMA.
 * SQLite-Sonderfall: PRAGMA foreign_keys ist INNERHALB einer Transaktion ein No-op — sqlite-Ziele
 * schalten die Checks deshalb connection-scoped VOR der Transaktion aus (eine Verbindung je
 * Lauf-Instanz, pool: { max: 1 }), mysql innerhalb der gepinnten Transaktion. */
export const setForeignKeyChecks = async (db: Sequelize, enable: boolean, transaction?: Transaction): Promise<void> => {
	const sql =
		db.getDialect() === 'mysql'
			? `SET FOREIGN_KEY_CHECKS = ${enable ? 1 : 0}`
			: `PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`;
	await db.query(sql, transaction ? { transaction } : undefined);
};

export const verifyInvoiceBlobs = async (source: Sequelize, target: Sequelize): Promise<BlobSample> => {
	const invoiceTable = Object.values(target.models).find((model) => tableOf(model) === 'invoices');
	const sourceTables = new Set((await source.getQueryInterface().showAllTables()).map((n) => n.toLowerCase()));
	if (!invoiceTable || !sourceTables.has('invoices')) return { checked: 0, mismatched: 0 };
	// Blob-Abgleich id-weise: vorab nur die IDs laden, die PDFs einzeln je Seite holen und vergleichen —
	// der Speicherbedarf bleibt auf einen Blob begrenzt (Produktionskopie: MEDIUMBLOB bis 16 MB).
	const ids = (
		await selectAll(source, `SELECT id FROM ${quoted(source, 'invoices')} WHERE pdfBytes IS NOT NULL ORDER BY id`)
	).map((row) => Number(row.id));
	let checked = 0;
	let mismatched = 0;
	for (const id of ids) {
		checked++;
		const sourceRows = await selectAll(source, `SELECT pdfBytes FROM ${quoted(source, 'invoices')} WHERE id = ${id}`);
		const targetRows = await selectAll(target, `SELECT pdfBytes FROM ${quoted(target, 'invoices')} WHERE id = ${id}`);
		const sourceBytes = sourceRows[0]?.pdfBytes == null ? null : Buffer.from(sourceRows[0].pdfBytes as Buffer);
		const targetBytes = targetRows[0]?.pdfBytes == null ? null : Buffer.from(targetRows[0].pdfBytes as Buffer);
		if (!sourceBytes || !targetBytes || !sourceBytes.equals(targetBytes)) mismatched++;
	}
	return { checked, mismatched };
};

export const buildCopyReport = async (source: Sequelize, target: Sequelize): Promise<CopyReport> => {
	const tables: TableCount[] = [];
	for (const model of await selectedModels(source, Object.values(target.models))) {
		const table = tableOf(model);
		tables.push({ table, source: await countRows(source, table), target: await countRows(target, table) });
	}
	const blobs = await verifyInvoiceBlobs(source, target);
	return {
		tables,
		blobs,
		ok: tables.every((entry) => entry.source === entry.target) && blobs.mismatched === 0,
	};
};

/** JSON-Spalten liegen in der rohen SQLite-Quelle als TEXT vor; ohne Parse würde Sequelize sie beim
 * Schreiben erneut stringify (Doppel-Encoding). Nicht-String-Werte (NULL, bereits geparst) bleiben unberührt. */
const decodeJsonAttributes = (model: ModelStatic<Model>, row: Record<string, unknown>): Record<string, unknown> => {
	for (const [name, attribute] of Object.entries(model.getAttributes())) {
		if (attribute.type instanceof DataTypes.JSON && typeof row[name] === 'string') {
			row[name] = JSON.parse(row[name] as string);
		}
	}
	return row;
};

/** Kopiert eine Tabelle batchweise: PK-geordnete Fenster lesen, je Fenster ein bulkCreate — Speicher
 * und Paketgröße (max_allowed_packet) bleiben begrenzt. Je Tabelle genau eine Transaktion: FK-Checks
 * aus/an greifen connection-scoped — die Transaktion pinnt eine Verbindung für beide Statements und
 * das bulkCreate. Geteilter Kern des Vorwärts- (#2827) und des Rückwärts-Laufs (#2830). */
export const copyTableRows = async (
	source: Sequelize,
	target: Sequelize,
	model: ModelStatic<Model>,
	chunkSize = 500,
): Promise<void> => {
	const table = tableOf(model);
	const remap = columnToAttribute(model);
	const pkColumns = (model as typeof Model).primaryKeyAttributes.map(
		(name) => model.getAttributes()[name]?.field ?? name,
	);
	const orderBy =
		pkColumns.length > 0 ? ` ORDER BY ${pkColumns.map((column) => quoted(source, column)).join(', ')}` : '';
	// FK-Checks aus: mysql session-scoped INNERHALB der Transaktion (pinnt die Verbindung), sqlite
	// PRAGMA wäre darin ein No-op — dort connection-scoped VOR der Transaktion (eine Verbindung je
	// Ziel-Instanz). Kein Re-Enable bei sqlite: das Anschalten liesse Folgestatements auf dem Ziel an
	// nicht mitkopierten FK-Eltern-Tabellen scheitern (Verbindungs-Default ist ohnehin ON).
	const isSqlite = target.getDialect() === 'sqlite';
	if (isSqlite) await setForeignKeyChecks(target, false);
	await target.transaction(async (transaction) => {
		if (!isSqlite) await setForeignKeyChecks(target, false, transaction);
		for (let offset = 0; ; offset += chunkSize) {
			const rows = await selectAll(
				source,
				`SELECT * FROM ${quoted(source, table)}${orderBy} LIMIT ${chunkSize} OFFSET ${offset}`,
			);
			if (rows.length === 0) break;
			await model.bulkCreate(
				rows.map((row) =>
					decodeJsonAttributes(
						model,
						remap.size === 0
							? row
							: Object.fromEntries(Object.entries(row).map(([key, value]) => [remap.get(key) ?? key, value])),
					),
				),
				{ transaction, individualHooks: false },
			);
			if (rows.length < chunkSize) break;
		}
		if (!isSqlite) await setForeignKeyChecks(target, true, transaction);
	});
};

export const copySqliteToMariadb = async (source: Sequelize, target: Sequelize): Promise<CopyReport> => {
	await target.sync({ force: true });
	for (const model of await selectedModels(source, Object.values(target.models))) {
		await copyTableRows(source, target, model);
	}
	return buildCopyReport(source, target);
};

export const reportExitCode = (report: CopyReport): 0 | 1 => (report.ok ? 0 : 1);

const main = async (): Promise<0 | 1> => {
	const storage = process.env.DATABASE_STORAGE;
	if (!storage) throw new Error('DATABASE_STORAGE setzen (Pfad zur SQLite-Quelldatei).');
	if (sequelize.getDialect() !== 'mysql') {
		throw new Error('Ziel muss MariaDB sein: DB_DIALECT=mysql und MARIADB_* setzen.');
	}
	const source = new Sequelize({ dialect: 'sqlite', storage, logging: false });
	try {
		await sequelize.authenticate();
		const report = await copySqliteToMariadb(source, sequelize);
		console.log(
			['tabelle\tquelle\tziel', ...report.tables.map((t) => `${t.table}\t${t.source}\t${t.target}`)].join('\n'),
		);
		console.log(`blobs: ${report.blobs.checked} geprueft, ${report.blobs.mismatched} abweichend | ok=${report.ok}`);
		return reportExitCode(report);
	} finally {
		await source.close();
		await sequelize.close();
	}
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	void main().then(
		(code) => {
			process.exitCode = code;
		},
		(error: unknown) => {
			console.error(error instanceof Error ? error.message : error);
			process.exitCode = 1;
		},
	);
}
