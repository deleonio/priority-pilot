import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataTypes, Model, QueryTypes, Sequelize } from 'sequelize';
// Vertragstest (#2829, docs/spec/issue-2829.md): `server/src/scripts/verify-db-identity.ts`
// stellt `verifyDbIdentity`, `canonicalRowHash`, `requireMariaDbTarget` und `reportExitCode`
// gemäß diesem Vertrag (AK1–AK4) bereit.
import { canonicalRowHash, reportExitCode, requireMariaDbTarget, verifyDbIdentity } from './verify-db-identity.js';
import sequelize from '../database.js';
import { Dependency, Invoice, Task, User } from '../models/index.js';

// Fixture wie Kopierer-Test (#2827): Quelle = rohe In-Memory-SQLite-Instanz, Ziel = Default-Instanz
// (im Test-Umfeld ebenfalls In-Memory-SQLite, DATABASE_STORAGE=:memory:). Die Quell-Tabellen
// entstehen aus den echten Modell-Attributen, die Zeilen über die Modelle erzeugt und 1:1 roh in
// die Quelle eingefügt — der Verifikationslauf selbst darf nichts schreiben.
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

let taskQuell = 0;
let taskAbhaengig = 0;
let invoiceA = 0;
let invoiceB = 0;

/** Mutiert eine Ziel-Zeile spaltenweise, erwartet die erkannte Abweichung und stellt den
 * Ursprungswert wieder her — die Varianten von TF2 bleiben so unabhängig voneinander. */
const expectMutationDetected = async (table: string, column: string, value: unknown, id: number): Promise<void> => {
	const rows = (await sequelize.query(`SELECT * FROM "${table}" WHERE id = :id`, {
		replacements: { id },
		type: QueryTypes.SELECT,
	})) as Array<Record<string, unknown>>;
	const original = rows[0]?.[column];
	await sequelize.query(`UPDATE "${table}" SET "${column}" = :value WHERE id = :id`, {
		replacements: { id, value },
		type: QueryTypes.UPDATE,
	});
	const report = await verifyDbIdentity(source, sequelize);
	const entry = report.tables.find((t) => t.table === table);
	assert.equal(report.ok, false, `${table}.${column}: Abweichung wird gemeldet`);
	assert.equal(reportExitCode(report), 1, `${table}.${column}: Exit-Code 1`);
	assert.ok(entry, `Bericht enthält Tabelle ${table}`);
	assert.equal(entry?.match, false, `${table}.${column}: Hashvergleich schlägt an`);
	assert.ok(entry?.differingPks.includes(String(id)), `${table}: Meldung nennt PK ${id} der abweichenden Zeile`);
	await sequelize.query(`UPDATE "${table}" SET "${column}" = :value WHERE id = :id`, {
		replacements: { id, value: original },
		type: QueryTypes.UPDATE,
	});
};

before(async () => {
	await sequelize.sync({ force: true });
	await source.query('PRAGMA foreign_keys = OFF');
	const user = await User.create({ email: 'verify@example.org', passwordHash: 'hash' });
	const taskA = await Task.create({
		title: 'Quellaufgabe',
		userId: user.id,
		checklist: [{ id: 'c1', title: 'Ankreuzen', completed: false }],
	});
	const taskB = await Task.create({ title: 'Abhängige Aufgabe', userId: user.id });
	await Dependency.create({ dependentTaskId: taskB.id, dependingTaskId: taskA.id, weight: 0.5 });
	const invoices = [];
	for (let i = 0; i < 12; i++) {
		invoices.push(
			await Invoice.create({
				userId: user.id,
				subscriptionId: 1,
				number: `INV-2026-${String(i).padStart(6, '0')}`,
				periodStart: new Date(Date.UTC(2026, i, 1)),
				periodEnd: new Date(Date.UTC(2026, i, 28)),
				amountCents: 1000 + i,
				pdfBytes: Buffer.from(`pdf-${i}-${'x'.repeat(i + 1)}`),
				lineItems: [{ label: `Position ${i}`, amountCents: 1000 + i }],
			}),
		);
	}
	taskQuell = taskA.id;
	taskAbhaengig = taskB.id;
	invoiceA = invoices[0].id;
	invoiceB = invoices[1].id;
	for (const [table, model] of TABLE_MODELS) {
		await source.getQueryInterface().createTable(table, (model as typeof Model).getAttributes());
		// JSON-Spalten vor dem rohen bulkInsert stringifizieren — die rohe SQLite-Quelle hält sie
		// als TEXT (Produktionsdarstellung vor der Migration).
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

describe('verify-db-identity — Lauf über identische Kopie (#2829 TF1, AK1)', () => {
	it('endet mit ok und Exit 0, Bericht nennt je Tabelle Zeilenzahl und Hashvergleich', async () => {
		const report = await verifyDbIdentity(source, sequelize);
		assert.deepEqual(
			report.tables.map((entry) => entry.table).sort(),
			[...COPY_TABLES].sort(),
			'alle Quell-Tabellen werden berichtet',
		);
		const counts: Record<string, number> = { users: 1, tasks: 2, dependencies: 1, invoices: 12 };
		for (const entry of report.tables) {
			assert.equal(entry.source, counts[entry.table], `${entry.table}: Quell-Zeilenzahl wird wirklich gelesen`);
			assert.equal(entry.target, entry.source, `${entry.table}: Ziel-Zeilenzahl identisch`);
			assert.equal(entry.match, true, `${entry.table}: Zeilenhashes identisch`);
			assert.deepEqual(entry.differingPks, [], `${entry.table}: keine abweichenden Zeilen`);
		}
		assert.equal(report.ok, true, 'identischer Inhalt meldet ok');
		assert.equal(reportExitCode(report), 0, 'identischer Inhalt → Exit-Code 0');
	});
});

describe('verify-db-identity — veränderte Kopie (#2829 TF2, AK2)', () => {
	it('Text: geänderter Titel führt zu Exit 1 mit Tabelle + PK', async () => {
		await expectMutationDetected('tasks', 'title', 'Veraenderte Quelle Aufgabe', taskQuell);
	});

	it('Datum: geändertes periodStart führt zu Exit 1 mit Tabelle + PK', async () => {
		await expectMutationDetected('invoices', 'periodStart', '2020-05-05T05:05:05.000Z', invoiceB);
	});

	it('Boolean: gesetztes pinned (0 → 1) führt zu Exit 1 mit Tabelle + PK', async () => {
		await expectMutationDetected('tasks', 'pinned', 1, taskAbhaengig);
	});

	it('JSON: geänderte checklist führt zu Exit 1 mit Tabelle + PK', async () => {
		await expectMutationDetected(
			'tasks',
			'checklist',
			'[{"id":"c1","title":"Geaendert","completed":false}]',
			taskQuell,
		);
	});

	it('BLOB: verfälschte pdfBytes führen zu Exit 1 mit Tabelle + PK', async () => {
		await expectMutationDetected('invoices', 'pdfBytes', Buffer.from('verfaelscht'), invoiceA);
	});
});

describe('verify-db-identity — Dialekt-Guard (#2829 TF3, AK3)', () => {
	it('Ziel ohne mysql-Dialekt wirft klare Fehlermeldung, mysql läuft weiter', () => {
		assert.throws(
			() => requireMariaDbTarget({ getDialect: () => 'sqlite' }),
			(error: unknown) =>
				error instanceof Error && /DB_DIALECT=mysql/.test(error.message) && /MARIADB_/.test(error.message),
			'Fehlermeldung nennt DB_DIALECT=mysql und MARIADB_*',
		);
		assert.doesNotThrow(() => requireMariaDbTarget({ getDialect: () => 'mysql' }));
	});
});

describe('verify-db-identity — Kanonisierung (#2829 TF4, AK4)', () => {
	const hash = (row: Record<string, unknown>): string => canonicalRowHash(row);

	it('Datum: Sequelize-SQLite-Textform, Date-Objekt, ISO-String → gleicher Hash', () => {
		const withMs = hash({ d: '2026-03-05T12:34:56.789Z' });
		assert.equal(
			hash({ d: '2026-03-05 12:34:56.789 +00:00' }),
			withMs,
			'SQLite-Textform (Offset nach Leerzeichen) = ISO-UTC',
		);
		assert.equal(hash({ d: new Date('2026-03-05T12:34:56.789Z') }), withMs, 'Date-Objekt = ISO-String');
		assert.equal(
			hash({ d: '2026-03-05T12:34:56Z' }),
			hash({ d: '2026-03-05T12:34:56.000Z' }),
			'ohne Millisekunden = explizite .000-Millisekunden',
		);
	});

	it('DATEONLY: Datumstext (SQLite) = Mitternachts-Date (MariaDB) → gleicher Hash', () => {
		assert.equal(
			hash({ d: '2026-03-05' }),
			hash({ d: new Date('2026-03-05T00:00:00.000Z') }),
			'Datumstext = Mitternachts-Date',
		);
		assert.equal(
			hash({ d: '2026-03-05' }),
			hash({ d: '2026-03-05T00:00:00.000Z' }),
			'Datumstext = Mitternacht als ISO-UTC',
		);
	});

	it('Boolean: 1/true und 0/false → gleicher Hash', () => {
		assert.equal(hash({ b: 1 }), hash({ b: true }), '1 = true');
		assert.equal(hash({ b: 0 }), hash({ b: false }), '0 = false');
	});

	it('JSON: Text mit anderer Key-Reihenfolge = geparstes Objekt → gleicher Hash', () => {
		assert.equal(
			hash({ j: '{"b":2,"a":[1,{"z":3}]}' }),
			hash({ j: { a: [1, { z: 3 }], b: 2 } }),
			'JSON-Text (sortierte Keys) = geparst',
		);
	});

	it('BLOB: Buffer = Hex-String derselben Bytes → gleicher Hash', () => {
		assert.equal(
			hash({ blob: Buffer.from('pdf-0') }),
			hash({ blob: Buffer.from('pdf-0').toString('hex') }),
			'Buffer = Hex',
		);
	});

	it('Gegenproben: verschiedene logische Werte → verschiedener Hash', () => {
		assert.notEqual(hash({ t: 'a' }), hash({ t: 'b' }), 'unterschiedlicher Text');
		assert.notEqual(
			hash({ d: '2026-03-05T12:34:56.789Z' }),
			hash({ d: '2026-03-06T12:34:56.789Z' }),
			'unterschiedliches Datum',
		);
		assert.notEqual(
			hash({ d: '2026-03-05T12:34:56.789Z' }),
			hash({ d: '2026-03-05T12:34:56Z' }),
			'Sub-Sekunden-Differenz (Millisekunden bleiben erhalten)',
		);
		assert.notEqual(hash({ d: '2026-03-05' }), hash({ d: '2026-03-06' }), 'unterschiedliches DATEONLY-Datum');
		assert.notEqual(hash({ b: 1 }), hash({ b: 2 }), 'unterschiedlicher Zahlenwert');
		assert.notEqual(hash({ j: '{"a":1}' }), hash({ j: '{"a":2}' }), 'unterschiedliches JSON');
		assert.notEqual(hash({ blob: '00' }), hash({ blob: '01' }), 'unterschiedliche Bytes');
		assert.notEqual(hash({ t: 'a', extra: 1 }), hash({ t: 'a' }), 'zusätzliche Spalte ändert den Hash');
	});
});
