import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type ModelStatic, QueryTypes, Sequelize } from 'sequelize';
// ROTER Spec-Test (#2830, docs/spec/issue-2830.md): Das Reverse-Kopierwerkzeug MariaDB→SQLite
// existiert noch nicht. Der Import schlägt fehl, bis `server/src/scripts/copy-mariadb-to-sqlite.ts`
// `copyMariadbToSqlite` und `assertReverseCliEnv` gemäß diesem Vertrag (AK1–AK4) bereitstellt.
import { assertReverseCliEnv, copyMariadbToSqlite } from './copy-mariadb-to-sqlite.js';
// Bericht, Blob-Stichprobe und Exit-Code kommen aus dem bestehenden Vorwärts-Werkzeug (#2827)
// und werden wiederverwendet, nicht dupliziert.
import { buildCopyReport, reportExitCode, verifyInvoiceBlobs } from './copy-sqlite-to-mariadb.js';
import sequelize from '../database.js';
import { Dependency, Invoice, Task, User } from '../models/index.js';

// Fixture wie #2827, Richtung gedreht: Quelle = Default-Instanz (im Test-Umfeld In-Memory-SQLite;
// im Produktivlauf die MariaDB), Ziel = frische, MODELLLOSE SQLite-Instanz — exakt die
// Reverse-Lage: das Ziel kennt keine Modelle, der Kern bekommt sie explizit übergeben (AK1).
const newTarget = (): Sequelize =>
	new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, pool: { max: 1 } });

const COPY_TABLES = ['dependencies', 'invoices', 'tasks', 'users'] as const;
const COPY_MODELS: ModelStatic<Model>[] = [User, Task, Dependency, Invoice];

const rawRows = async (db: Sequelize, sql: string): Promise<Array<Record<string, unknown>>> =>
	(await db.query(sql, { type: QueryTypes.SELECT })) as Array<Record<string, unknown>>;

const countRows = async (db: Sequelize, table: string): Promise<number> => {
	const rows = await rawRows(db, `SELECT COUNT(*) AS n FROM "${table}"`);
	return Number(rows[0]?.n ?? 0);
};

/** Prüft AK1: jede Quellzeile existiert im Ziel mit identischer id und identischen FK-Werten. */
const expectIdsAndFksPreserved = async (target: Sequelize): Promise<void> => {
	for (const table of COPY_TABLES) {
		const sourceRows = await rawRows(sequelize, `SELECT * FROM "${table}"`);
		const targetRows = await rawRows(target, `SELECT * FROM "${table}"`);
		assert.equal(targetRows.length, sourceRows.length, `${table}: Zeilenzahl Quelle/Ziel identisch`);
		// dependencies hat Komposit-PK und keine id-Spalte — Schlüssel über die echten PK-Felder.
		const pkFields: readonly string[] = table === 'dependencies' ? ['dependentTaskId', 'dependingTaskId'] : ['id'];
		const keyOf = (row: Record<string, unknown>): string => pkFields.map((field) => String(row[field])).join('|');
		const targetByKey = new Map(targetRows.map((row) => [keyOf(row), row]));
		for (const sourceRow of sourceRows) {
			const targetRow = targetByKey.get(keyOf(sourceRow));
			assert.ok(targetRow, `${table}: Zeile ${keyOf(sourceRow)} im Ziel vorhanden`);
			for (const [key, value] of Object.entries(sourceRow)) {
				if (key === 'id' || key.endsWith('Id')) {
					assert.equal(targetRow[key], value, `${table}.${key} bleibt erhalten`);
				}
			}
		}
	}
};

before(async () => {
	await sequelize.sync({ force: true });
	const user = await User.create({ email: 'reverse@example.org', passwordHash: 'hash' });
	const taskA = await Task.create({
		title: 'Quellaufgabe',
		userId: user.id,
		checklist: [{ id: 'c1', title: 'Ankreuzen', completed: false }],
	});
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
			lineItems: [{ label: `Position ${i}`, amountCents: 1000 + i }],
		});
	}
});

describe('copy-mariadb-to-sqlite — Reverse-Kopierkern (#2830)', () => {
	it('TF1 (AK1): baut das Ziel frisch aus den übergebenen Modellen und erhält alle IDs und FK-Werte', async () => {
		const target = newTarget();
		const report = await copyMariadbToSqlite(sequelize, target, COPY_MODELS);
		assert.deepEqual(
			report.tables.map((entry) => entry.table).sort(),
			[...COPY_TABLES].sort(),
			'alle Quell-Tabellen werden berichtet',
		);
		for (const entry of report.tables) {
			assert.equal(entry.target, entry.source, `${entry.table}: Quell- und Ziel-Zeilenzahl identisch`);
		}
		assert.equal(report.ok, true, 'sauberer Lauf meldet ok');
		await expectIdsAndFksPreserved(target);
	});

	it('TF2 (AK2): Schreib-Delta der Quelle landet im frischen Ziel; Abweichung → Exit-Code 1', async () => {
		// Delta seit dem ersten Lauf: bestehende Zeile ändern, neue Zeilen hinzufügen.
		await Task.update({ title: 'Geaendert nach Cutover' }, { where: { title: 'Quellaufgabe' } });
		const deltaUser = await User.create({ email: 'delta@example.org', passwordHash: 'hash' });
		await Task.create({ title: 'Nachtraeglich hinzugefuegt', userId: deltaUser.id });

		const target = newTarget();
		const report = await copyMariadbToSqlite(sequelize, target, COPY_MODELS);
		assert.equal(report.ok, true, 'Reverse-Lauf über das Delta meldet ok');
		assert.equal(reportExitCode(report), 0, 'sauberer Lauf → Exit-Code 0');
		const titles = (await rawRows(target, 'SELECT title FROM tasks')).map((row) => row.title);
		assert.ok(titles.includes('Geaendert nach Cutover'), 'geänderte Zeile ist im Ziel');
		assert.ok(titles.includes('Nachtraeglich hinzugefuegt'), 'hinzugefügte Zeile ist im Ziel');
		assert.equal(
			await countRows(target, 'tasks'),
			await countRows(sequelize, 'tasks'),
			'Zeilenzahl tasks Quelle/Ziel identisch',
		);

		// Jede Abweichung zwischen Quelle und Ergebnis → Exit-Code != 0.
		await target.query("DELETE FROM tasks WHERE title = 'Nachtraeglich hinzugefuegt'");
		const drifted = await buildCopyReport(sequelize, target);
		assert.equal(drifted.ok, false, 'Zeilenzahl-Differenz wird im Bericht markiert');
		assert.equal(reportExitCode(drifted), 1, 'Abweichung → Exit-Code 1');
	});

	it('TF3 (AK3): PDF-Stichprobe über die Reverse-Kopie ist bytegleich; Verfälschung wird erkannt', async () => {
		const target = newTarget();
		await copyMariadbToSqlite(sequelize, target, COPY_MODELS);
		const sample = await verifyInvoiceBlobs(sequelize, target);
		assert.ok(sample.checked >= 10, 'Stichprobe prüft mindestens 10 Rechnungen mit pdfBytes');
		assert.equal(sample.mismatched, 0, 'unverfälschte Kopie ist bytegleich');
		const sourceRows = await rawRows(
			sequelize,
			'SELECT id, pdfBytes FROM invoices WHERE id = (SELECT MIN(id) FROM invoices)',
		);
		const targetRows = await rawRows(target, `SELECT pdfBytes FROM invoices WHERE id = ${sourceRows[0].id}`);
		assert.ok(
			Buffer.from(targetRows[0].pdfBytes as Buffer).equals(sourceRows[0].pdfBytes as Buffer),
			'PDF-Bytes Quelle und Ziel sind identisch',
		);
		await target.query('UPDATE invoices SET pdfBytes = ? WHERE id = ?', {
			replacements: [Buffer.from('verfaelscht'), sourceRows[0].id],
		});
		const after = await verifyInvoiceBlobs(sequelize, target);
		assert.equal(after.mismatched, 1, 'ein verfälschtes Byte wird als Abweichung gemeldet');
	});

	it('TF4 (AK4): JSON-Spalten kommen einfach kodiert (geparst) an, nicht doppelt kodiert', async () => {
		const target = newTarget();
		await copyMariadbToSqlite(sequelize, target, COPY_MODELS);
		const taskRow = (await rawRows(target, 'SELECT checklist FROM tasks WHERE checklist IS NOT NULL'))[0];
		assert.deepEqual(
			JSON.parse(taskRow.checklist as string),
			[{ id: 'c1', title: 'Ankreuzen', completed: false }],
			'tasks.checklist ist einfach kodiert',
		);
		const invoiceRow = (await rawRows(target, 'SELECT lineItems FROM invoices ORDER BY id LIMIT 1'))[0];
		assert.deepEqual(
			JSON.parse(invoiceRow.lineItems as string),
			[{ label: 'Position 0', amountCents: 1000 }],
			'invoices.lineItems ist einfach kodiert',
		);
	});
});

describe('copy-mariadb-to-sqlite — CLI-Guard (#2830 AK4)', () => {
	it('TF5: gültige Reverse-Env (mysql-Quelle + DATABASE_STORAGE) wird akzeptiert', () => {
		assert.doesNotThrow(() => assertReverseCliEnv({ DB_DIALECT: 'mysql', DATABASE_STORAGE: './reverse.sqlite' }));
	});

	it('TF5: fehlender DATABASE_STORAGE (Zielpfad) wird mit klarer Meldung abgelehnt', () => {
		assert.throws(() => assertReverseCliEnv({ DB_DIALECT: 'mysql' }), /DATABASE_STORAGE/);
	});

	it('TF5: nicht-mysql-Quelle (auch bei fehlendem DB_DIALECT) wird mit klarer Meldung abgelehnt', () => {
		assert.throws(() => assertReverseCliEnv({ DB_DIALECT: 'sqlite', DATABASE_STORAGE: './reverse.sqlite' }), /mysql/i);
		assert.throws(() => assertReverseCliEnv({ DATABASE_STORAGE: './reverse.sqlite' }), /mysql/i);
	});
});
