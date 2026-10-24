import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Model, ModelStatic, QueryTypes, Sequelize } from 'sequelize';
// Registriert ALLE Modelle auf der Default-Instanz — ohne diesen Import ist `target.models` leer.
import '../models/index.js';
import sequelize from '../database.js';

// Identitätsprüfung SQLite-Quelle ↔ MariaDB-Kopie (ADR 0026, #2829), Vertrag: docs/spec/issue-2829.md.
// Strikt read-only — kein sync(), kein Schreibzugriff auf eine der beiden DBs.
// Einzeiler auf dem Host (täglicher Parallellauf), Env wie Kopierer #2827:
// DB_DIALECT=mysql MARIADB_HOST=… MARIADB_USER=… MARIADB_PASSWORD=… MARIADB_DATABASE=…
// DATABASE_STORAGE=<Pfad zur SQLite-Datei> node --import tsx src/scripts/verify-db-identity.ts
// Exit-Code 0 nur bei voller Übereinstimmung (reportExitCode).

export type TableIdentity = {
	table: string;
	source: number;
	target: number;
	match: boolean;
	differingPks: string[];
};
export type IdentityReport = { tables: TableIdentity[]; ok: boolean };

const WINDOW_SIZE = 500;
type Row = Record<string, unknown>;

const tableOf = (model: ModelStatic<Model>): string => {
	const name = model.getTableName();
	return typeof name === 'string' ? name : name.tableName;
};

const quoted = (db: Sequelize, identifier: string): string => db.getQueryInterface().quoteIdentifier(identifier);

const selectAll = async (db: Sequelize, sql: string): Promise<Row[]> =>
	(await db.query(sql, { type: QueryTypes.SELECT })) as Row[];

const countRows = async (db: Sequelize, table: string): Promise<number> => {
	const rows = await selectAll(db, `SELECT COUNT(*) AS n FROM ${quoted(db, table)}`);
	return Number(rows[0]?.n ?? 0);
};

/** Kanonisierung eines Einzelwerts: beide Dialekt-Darstellungen (SQLite/MariaDB) desselben logischen
 * Werts müssen auf denselben Kanon laufen (AK4) — Sekunden-Präzision (MariaDB DATETIME ohne
 * Bruchteile), Booleans als 0/1, JSON geparst + key-sortiert, BLOBs als Hex. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/.source;

const canonicalJson = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(canonicalJson);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Row)
				.sort()
				.map((key) => [key, canonicalJson((value as Row)[key])]),
		);
	}
	return canonicalize(value);
};

const canonicalize = (value: unknown): unknown => {
	if (value == null) return null;
	if (value instanceof Date) return canonicalTimestamp(value.toISOString());
	if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString('hex');
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		if (new RegExp(ISO_DATE).test(value)) return canonicalTimestamp(value);
		if (value.startsWith('{') || value.startsWith('[')) {
			try {
				return canonicalJson(JSON.parse(value));
			} catch {
				// Kein gültiges JSON → als Text behandeln.
			}
		}
		return value;
	}
	if (typeof value === 'object') return canonicalJson(value);
	return String(value);
};

/** ISO-8601 UTC auf Sekunden normalisiert — Datum mit/ohne Millisekunden kanonisieren gleich (AK4). */
const canonicalTimestamp = (value: string): string => {
	const normalized = `${value.replace(' ', 'T')}${/[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? '' : 'Z'}`;
	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) return value;
	return `${parsed.toISOString().slice(0, 19)}Z`;
};

/** SHA-256 über die kanonisierte Zeile — Spaltenreihenfolge ist irrelevant, Inhalt entscheidet. */
export const canonicalRowHash = (row: Row): string => {
	const canonical = Object.keys(row)
		.sort()
		.map((key) => [key, canonicalize(row[key])]);
	return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
};

export const requireMariaDbTarget = (db: { getDialect(): string }): void => {
	if (db.getDialect() !== 'mysql') {
		throw new Error('Ziel muss MariaDB sein: DB_DIALECT=mysql und MARIADB_* setzen.');
	}
};

export const reportExitCode = (report: IdentityReport): 0 | 1 => (report.ok ? 0 : 1);

/** Tabellenauswahl = Ziel-Modelle ∩ existierende Quell-Tabellen (Muster Kopierer). Der Lauf liest
 * nur — die FK-topologische Ordnung des Kopierers ist hier ohne Wirkung und entfällt. */
const selectedModels = async (source: Sequelize, target: Sequelize): Promise<ModelStatic<Model>[]> => {
	const sourceTables = new Set(
		(await source.getQueryInterface().showAllTables()).map((name) => String(name).toLowerCase()),
	);
	return Object.values(target.models).filter((model) => sourceTables.has(tableOf(model).toLowerCase()));
};

const pkColumns = (model: ModelStatic<Model>): string[] =>
	model.primaryKeyAttributes.map((name) => model.getAttributes()[name]?.field ?? name);

const pkOf = (row: Row, columns: string[]): string =>
	row[columns[0]] === undefined
		? ''
		: String(columns.length === 1 ? row[columns[0]] : columns.map((column) => row[column]).join(':'));

/** PK-Vergleich für den Merge-Join über die beidseitig PK-geordneten Zeilen. */
const comparePk = (a: Row, b: Row, columns: string[]): number => {
	for (const column of columns) {
		const av = a[column];
		const bv = b[column];
		if (av === bv) continue;
		const an = Number(av);
		const bn = Number(bv);
		if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an < bn ? -1 : 1;
		return String(av) < String(bv) ? -1 : 1;
	}
	return 0;
};

async function* readRows(db: Sequelize, sql: string): AsyncGenerator<Row> {
	for (let offset = 0; ; offset += WINDOW_SIZE) {
		const rows = await selectAll(db, `${sql} LIMIT ${WINDOW_SIZE} OFFSET ${offset}`);
		for (const row of rows) yield row;
		if (rows.length < WINDOW_SIZE) return;
	}
}

const compareTable = async (
	source: Sequelize,
	target: Sequelize,
	model: ModelStatic<Model>,
): Promise<TableIdentity> => {
	const table = tableOf(model);
	const columns = pkColumns(model);
	const sourceCount = await countRows(source, table);
	const targetCount = await countRows(target, table);
	const orderBy = (db: Sequelize) =>
		columns.length > 0 ? ` ORDER BY ${columns.map((column) => quoted(db, column)).join(', ')}` : '';
	const sourceRows = readRows(source, `SELECT * FROM ${quoted(source, table)}${orderBy(source)}`);
	const targetRows = readRows(target, `SELECT * FROM ${quoted(target, table)}${orderBy(target)}`);
	const differingPks: string[] = [];
	let sourceNext = await sourceRows.next();
	let targetNext = await targetRows.next();
	while (!sourceNext.done || !targetNext.done) {
		const sourceRow = sourceNext.done ? undefined : sourceNext.value;
		const targetRow = targetNext.done ? undefined : targetNext.value;
		if (targetRow === undefined || (sourceRow !== undefined && comparePk(sourceRow, targetRow, columns) < 0)) {
			differingPks.push(pkOf(sourceRow as Row, columns));
			sourceNext = await sourceRows.next();
		} else if (sourceRow === undefined || comparePk(sourceRow, targetRow, columns) > 0) {
			differingPks.push(pkOf(targetRow, columns));
			targetNext = await targetRows.next();
		} else {
			if (canonicalRowHash(sourceRow) !== canonicalRowHash(targetRow)) differingPks.push(pkOf(sourceRow, columns));
			sourceNext = await sourceRows.next();
			targetNext = await targetRows.next();
		}
	}
	return { table, source: sourceCount, target: targetCount, match: differingPks.length === 0, differingPks };
};

export const verifyDbIdentity = async (source: Sequelize, target: Sequelize): Promise<IdentityReport> => {
	const tables: TableIdentity[] = [];
	for (const model of await selectedModels(source, target)) {
		tables.push(await compareTable(source, target, model));
	}
	return { tables, ok: tables.every((entry) => entry.match) };
};

const main = async (): Promise<0 | 1> => {
	const storage = process.env.DATABASE_STORAGE;
	if (!storage) throw new Error('DATABASE_STORAGE setzen (Pfad zur SQLite-Quelldatei).');
	requireMariaDbTarget(sequelize);
	const source = new Sequelize({ dialect: 'sqlite', storage, logging: false });
	try {
		await sequelize.authenticate();
		const report = await verifyDbIdentity(source, sequelize);
		console.log(
			[
				'tabelle\tquelle\tziel\tidentisch\tabweichende-pks',
				...report.tables.map(
					(entry) =>
						`${entry.table}\t${entry.source}\t${entry.target}\t${entry.match ? 'ja' : 'nein'}\t${entry.differingPks.join(',')}`,
				),
			].join('\n'),
		);
		console.log(`ok=${report.ok}`);
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
