import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataTypes, Model, QueryTypes, Sequelize } from 'sequelize';
// ROTER Spec-Test (#2827, docs/spec/issue-2827.md): Das Kopierwerkzeug SQLite→MariaDB existiert
// noch nicht. Der Import schlägt fehl, bis `server/src/scripts/copy-sqlite-to-mariadb.ts`
// `copySqliteToMariadb`, `buildCopyReport`, `verifyInvoiceBlobs`, `reportExitCode` und
// `setForeignKeyChecks` gemäß diesem Vertrag (AK1–AK4) bereitstellt.
import {
	buildCopyReport,
	copySqliteToMariadb,
	reportExitCode,
	setForeignKeyChecks,
	verifyInvoiceBlobs,
} from './copy-sqlite-to-mariadb.js';
import sequelize from '../database.js';
import { Dependency, Invoice, Task, User } from '../models/index.js';

// Fixture: Quelle = rohe In-Memory-SQLite-Instanz, Ziel = Default-Instanz (im Test-Umfeld
// ebenfalls In-Memory-SQLite, DATABASE_STORAGE=:memory:) — exakt die Produktionsrichtung
// (AK4). Die Quell-Tabellen entstehen aus den echten Modell-Attributen, die Zeilen werden über
// die Modelle erzeugt und 1:1 in die Quelle eingefügt; der Lauf droppt/synct das Ziel und
// kopiert daraus zurück.
const source = new Sequelize({
	dialect: 'sqlite',
	storage: ':memory:',
	logging: false,
	pool: { max: 1 },
});

const COPY_TABLES = ['dependencies', 'invoices', 'tasks', 'users'] as const;

const TABLE_MODELS = [
	['users', User],
	['tasks', Task],
	['dependencies', Dependency],
	['invoices', Invoice],
] as const;

const countRows = async (db: Sequelize, table: string): Promise<number> => {
	const rows = (await db.query(`SELECT COUNT(*) AS n FROM "${table}"`, {
		type: QueryTypes.SELECT,
	})) as Array<{ n: number }>;
	return rows[0].n;
};

/** Prüft AK4: jede Quellzeile existiert im Ziel mit identischer id und identischen FK-Werten. */
const expectIdsAndFksPreserved = async (): Promise<void> => {
	for (const [table, model] of TABLE_MODELS) {
		const sourceRows = (await source.query(`SELECT * FROM "${table}"`, {
			type: QueryTypes.SELECT,
		})) as Array<Record<string, unknown>>;
		assert.ok(sourceRows.length > 0, `${table} hat Quelldaten`);
		// dependencies hat Komposit-PK und keine id-Spalte — Lookup über die echten PK-Attribute.
		const pkFields: readonly string[] = (model as typeof Model).primaryKeyAttributes;
		for (const row of sourceRows) {
			const target = await (model as typeof Model).findOne({
				where: Object.fromEntries(pkFields.map((field) => [field, row[field]])),
			});
			assert.ok(
				target,
				`${table}: Zeile ${JSON.stringify(Object.fromEntries(pkFields.map((f) => [f, row[f]])))} im Ziel vorhanden`,
			);
			const plain = target.get({ plain: true }) as Record<string, unknown>;
			for (const [key, value] of Object.entries(row)) {
				if (key === 'id' || key.endsWith('Id')) {
					assert.equal(plain[key], value, `${table}.${key} bleibt erhalten`);
				}
			}
		}
	}
};

before(async () => {
	await sequelize.sync({ force: true });
	// Teil-Schema: die Quell-Instanz kennt nur die 4 Fixture-Tabellen; die FK-Eltern-Existenzprüfung
	// (z. B. tasks → categories) würde jeden Insert schon an fehlenden Eltern-Tabellen scheitern lassen.
	await source.query('PRAGMA foreign_keys = OFF');
	const user = await User.create({ email: 'copy@example.org', passwordHash: 'hash' });
	const taskA = await Task.create({ title: 'Quellaufgabe', userId: user.id });
	const taskB = await Task.create({ title: 'Abhängige Aufgabe', userId: user.id });
	await Dependency.create({
		dependentTaskId: taskB.id,
		dependingTaskId: taskA.id,
		weight: 0.5,
	});
	for (let i = 0; i < 12; i++) {
		await Invoice.create({
			userId: user.id,
			subscriptionId: 1,
			number: `INV-2026-${String(i).padStart(6, '0')}`,
			periodStart: new Date(Date.UTC(2026, i, 1)),
			periodEnd: new Date(Date.UTC(2026, i, 28)),
			amountCents: 1000 + i,
			pdfBytes: Buffer.from(`pdf-${i}-${'x'.repeat(i + 1)}`),
		});
	}
	for (const [table, model] of TABLE_MODELS) {
		await source.getQueryInterface().createTable(table, (model as typeof Model).getAttributes());
		// JSON-Spalten (tasks.checklist, invoices.lineItems) vor dem rohen bulkInsert stringifizieren —
		// der sqlite-Dialekt serialisiert Arrays in bulkInsert sonst zu `` statt '[]' (SQL-Fehler).
		const jsonFields = Object.entries((model as typeof Model).getAttributes())
			.filter(([, attribute]) => attribute.type instanceof DataTypes.JSON)
			.map(([name]) => name);
		const rows = (await (model as typeof Model).findAll()).map((row) => {
			const plain = row.get({ plain: true }) as Record<string, unknown>;
			for (const field of jsonFields) {
				if (plain[field] != null) plain[field] = JSON.stringify(plain[field]);
			}
			return plain;
		});
		await source.getQueryInterface().bulkInsert(table, rows, { logging: false });
	}
});

describe('copy-sqlite-to-mariadb — Kopierkern (#2827)', () => {
	it('TF1 (AK4): kopiert alle Tabellen und erhält alle IDs und FK-Werte', async () => {
		const report = await copySqliteToMariadb(source, sequelize);
		assert.deepEqual(
			report.tables.map((entry) => entry.table).sort(),
			[...COPY_TABLES].sort(),
			'alle Quell-Tabellen werden berichtet',
		);
		for (const entry of report.tables) {
			assert.equal(entry.target, entry.source, `${entry.table}: Quell- und Ziel-Zeilenzahl identisch`);
		}
		assert.equal(report.ok, true, 'sauberer Lauf meldet ok');
		assert.equal(report.blobs.checked, 12, 'alle 12 Rechnungen mit pdfBytes geprüft');
		await expectIdsAndFksPreserved();
	});

	it('TF2 (AK2): zweiter Lauf droppt, synct neu und erzeugt keine Duplikate', async () => {
		const first = await copySqliteToMariadb(source, sequelize);
		const second = await copySqliteToMariadb(source, sequelize);
		assert.equal(second.ok, true, 'auch der zweite Lauf meldet ok');
		assert.deepEqual(second.tables, first.tables, 'identische Zeilenzahlen nach zweitem Lauf');
		assert.equal(
			await countRows(sequelize, 'tasks'),
			await countRows(source, 'tasks'),
			'keine duplizierten Tasks im Ziel',
		);
	});

	it('TF3 (AK3): Rechnungs-PDFs kommen bytegleich an; verfälschte Bytes werden erkannt', async () => {
		await copySqliteToMariadb(source, sequelize);
		const sample = await verifyInvoiceBlobs(source, sequelize);
		assert.ok(sample.checked >= 10, 'Stichprobe prüft mindestens 10 Rechnungen mit pdfBytes');
		assert.equal(sample.mismatched, 0, 'unverfälschte Kopie ist bytegleich');
		const sourceRows = (await source.query(
			'SELECT id, pdfBytes FROM invoices WHERE id = (SELECT MIN(id) FROM invoices)',
			{ type: QueryTypes.SELECT },
		)) as Array<{ id: number; pdfBytes: Buffer }>;
		const targetInvoice = await Invoice.findByPk(sourceRows[0].id);
		assert.ok(targetInvoice?.pdfBytes, 'Ziel-Rechnung trägt pdfBytes');
		assert.ok(
			Buffer.from(sourceRows[0].pdfBytes).equals(targetInvoice.pdfBytes),
			'PDF-Bytes Quelle und Ziel sind identisch',
		);
		await Invoice.update({ pdfBytes: Buffer.from('verfaelscht') }, { where: { id: targetInvoice.id } });
		const after = await verifyInvoiceBlobs(source, sequelize);
		assert.equal(after.mismatched, 1, 'ein verfälschtes Byte wird als Abweichung gemeldet');
	});

	it('TF4 (AK1): Zeilenzahl-Differenz Quelle/Ziel erzeugt Fehler- und Exit-Signal', async () => {
		const fresh = await copySqliteToMariadb(source, sequelize);
		assert.equal(reportExitCode(fresh), 0, 'sauberer Lauf → Exit-Code 0');
		await sequelize.query('DELETE FROM tasks');
		const drifted = await buildCopyReport(source, sequelize);
		assert.equal(drifted.ok, false, 'Abweichung wird im Bericht markiert');
		assert.equal(reportExitCode(drifted), 1, 'Abweichung → Exit-Code 1');
	});
});

describe('copy-sqlite-to-mariadb — Dialekt-Guard (#2827 TF5)', () => {
	type QueryRecordingSequelize = {
		getDialect: () => 'mysql' | 'sqlite';
		query: (sql: string) => Promise<unknown>;
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

	it('mysql sendet nur SET FOREIGN_KEY_CHECKS, niemals PRAGMA/sqlite_master', async () => {
		const spy = spySequelize('mysql');
		await setForeignKeyChecks(spy as unknown as Sequelize, false);
		await setForeignKeyChecks(spy as unknown as Sequelize, true);
		assert.ok(spy.queries.length >= 2, 'Aus und An werden gesendet');
		for (const sql of spy.queries) {
			assert.match(sql, /FOREIGN_KEY_CHECKS/);
			assert.doesNotMatch(sql, /PRAGMA|sqlite_master/i);
		}
	});

	it('sqlite sendet nur PRAGMA foreign_keys, niemals SET FOREIGN_KEY_CHECKS', async () => {
		const spy = spySequelize('sqlite');
		await setForeignKeyChecks(spy as unknown as Sequelize, false);
		await setForeignKeyChecks(spy as unknown as Sequelize, true);
		assert.ok(spy.queries.length >= 2, 'Aus und An werden gesendet');
		for (const sql of spy.queries) {
			assert.match(sql, /PRAGMA\s+foreign_keys\s*=\s*(OFF|ON)/i);
			assert.doesNotMatch(sql, /FOREIGN_KEY_CHECKS|sqlite_master/i);
		}
	});
});
