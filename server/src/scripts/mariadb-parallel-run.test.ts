import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
// ROTER Spec-Test (#2928, docs/spec/issue-2928.md): Der tägliche Parallellauf-Orchestrator
// existiert noch nicht. Der Import schlägt fehl, bis `server/src/scripts/mariadb-parallel-run.ts`
// `runParallelCopy` gemäß diesem Vertrag (AK1–AK5) bereitstellt: Snapshot → Kopie (#2827) →
// Identity-Prüfung (#2829) → genau eine JSONL-Report-Zeile → Status-Mail bei rot.
import { runParallelCopy } from './mariadb-parallel-run.js';
import type { MailSender } from '../logics/mail.js';
import sequelize from '../database.js';
import { Task, User } from '../models/index.js';

// Fixture: Quelle = dateibasierte SQLite im Temp-Verzeichnis (TF5 braucht eine Checksumme),
// Ziel = Default-Instanz (im Test-Umfeld In-Memory) — exakt die Produktionsrichtung (AK4).
const workDir = mkdtempSync(join(tmpdir(), 'mariadb-parallel-'));
const sourceFile = join(workDir, 'quelle.sqlite');
const source = new Sequelize({
	dialect: 'sqlite',
	storage: sourceFile,
	logging: false,
	pool: { max: 1 },
});

const reportPath = (name: string): string => join(workDir, `${name}.jsonl`);

const readReport = (file: string): Array<Record<string, unknown>> =>
	readFileSync(file, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line) as Record<string, unknown>);

const sha256 = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Snapshot-Injektion (Spec-Seam): Byte-Kopie der Quelle + fachliche Mutation auf der Kopie —
 * deterministische Trigger für Rot-Läufe und den Snapshot-Nachweis, ohne die Produktiv-Datei
 * anzutasten. Echte Modell-Attribute, damit JS-Defaults intakt bleiben. */
const snapshotWith =
	(mutate: (snap: Sequelize) => Promise<void>) =>
	async (storage: string): Promise<string> => {
		const snapFile = join(workDir, `snap-${Math.random().toString(36).slice(2)}.sqlite`);
		copyFileSync(storage, snapFile);
		const snap = new Sequelize({ dialect: 'sqlite', storage: snapFile, logging: false });
		snap.define('users', User.getAttributes());
		snap.define('tasks', Task.getAttributes());
		await mutate(snap);
		await snap.close();
		return snapFile;
	};

/** Roter Trigger für TF3a/TF4: dem Snapshot fehlt eine Aufgabe → Identity-Mismatch. */
const snapshotMissingRow = snapshotWith(async (snap) => {
	await snap.models.tasks.destroy({ where: { title: 'Quellaufgabe C' } });
});

const run = (overrides: Partial<Parameters<typeof runParallelCopy>[0]> = {}) =>
	runParallelCopy({ sourceStorage: sourceFile, target: sequelize, reportFile: reportPath('tmp'), ...overrides });

before(async () => {
	await sequelize.sync({ force: true });
	// Teil-Schema in der Quelldatei: nur users + tasks; FK-Eltern-Prüfung der rawen Inserts aus.
	await source.query('PRAGMA foreign_keys = OFF');
	await source.getQueryInterface().createTable('users', User.getAttributes());
	await source.getQueryInterface().createTable('tasks', Task.getAttributes());
	// Seed über die echten Modelle (Ziel-Instanz), dann roh in die Quelldatei — Muster #2827.
	const admin = await User.create({
		email: 'parallel-admin@example.org',
		passwordHash: 'hash',
		role: 'admin',
	});
	await User.create({ email: 'parallel-user@example.org', passwordHash: 'hash' });
	await Task.create({ title: 'Quellaufgabe A', userId: admin.id });
	await Task.create({ title: 'Quellaufgabe B', userId: admin.id });
	await Task.create({ title: 'Quellaufgabe C', userId: admin.id });
	for (const [table, model] of [
		['users', User],
		['tasks', Task],
	] as const) {
		const jsonFields = Object.entries(model.getAttributes())
			.filter(([, attribute]) => attribute.type instanceof DataTypes.JSON)
			.map(([name]) => name);
		const rows = (await model.findAll()).map((row) => {
			const plain = row.get({ plain: true }) as Record<string, unknown>;
			for (const field of jsonFields) {
				if (plain[field] != null) plain[field] = JSON.stringify(plain[field]);
			}
			return plain;
		});
		await source.getQueryInterface().bulkInsert(table, rows, { logging: false });
	}
});

describe('mariadb-parallel-run — Orchestrierung (#2928)', () => {
	it('TF1 (AK1): ein Aufruf = Kopie + Identity-Prüfung, grüner Lauf → Exit 0', async () => {
		const result = await run({ reportFile: join(workDir, 'runs', 'tf1.jsonl') });
		assert.equal(result.exitCode, 0, 'identische Kopie → Exit 0');
		const lines = readReport(join(workDir, 'runs', 'tf1.jsonl'));
		assert.equal(lines.length, 1, 'genau eine Report-Zeile; Verzeichnis wurde neu angelegt');
		assert.equal(lines[0].ok, true);
		assert.equal(lines[0].tables, 2, 'users + tasks geprüft');
		assert.equal(lines[0].rows, 5, '2 Nutzer + 3 Aufgaben');
		assert.equal(lines[0].mismatched, 0);
	});

	it('TF2 (AK2): zwei Läufe → genau zwei JSON-Zeilen mit Datum und Kennzahlen', async () => {
		const report = reportPath('tf2');
		await run({ reportFile: report });
		await run({ reportFile: report });
		const lines = readReport(report);
		assert.equal(lines.length, 2, 'je Lauf genau eine Zeile, sonst nichts');
		for (const line of lines) {
			for (const key of ['date', 'ok', 'tables', 'rows', 'mismatched']) {
				assert.ok(key in line, `Feld ${key} vorhanden`);
			}
			assert.equal(line.ok, true);
			assert.ok(!Number.isNaN(Date.parse(line.date as string)), 'Datum maschinenlesbar (7-Tage-Streak)');
		}
	});

	it('TF3a (AK3): veränderte Kopie → Exit 1 und rote Zeile mit Ursache', async () => {
		const report = reportPath('tf3a');
		const result = await run({ reportFile: report, snapshot: await snapshotMissingRow });
		assert.equal(result.exitCode, 1, 'Identity-Mismatch → Exit 1');
		const lines = readReport(report);
		assert.equal(lines.length, 1, 'auch der rote Lauf schreibt genau eine Zeile');
		assert.equal(lines[0].ok, false);
		assert.equal(lines[0].mismatched, 1, 'eine Tabelle weicht ab');
		assert.equal(typeof lines[0].cause, 'string', 'Ursache steht in der Zeile');
		assert.ok((lines[0].cause as string).length > 0, 'Ursache ist nicht leer');
	});

	it('TF3b (AK3): Kopier-Exception → rote Zeile + Exit != 0, kein Wurf nach außen', async () => {
		const report = reportPath('tf3b');
		const snapshot = async (): Promise<string> => {
			throw new Error('Backup fehlgeschlagen (Test)');
		};
		const result = await run({ reportFile: report, snapshot });
		assert.equal(result.exitCode, 1, 'Exception → Exit 1');
		const lines = readReport(report);
		assert.equal(lines.length, 1, 'kein Lauf ohne Report-Zeile');
		assert.equal(lines[0].ok, false);
		assert.ok((lines[0].cause as string).length > 0, 'Ursache steht auch bei Exception in der Zeile');
	});

	it('TF4 (AK5): Status-Mail nur bei rot; Mail-Fehlschlag ändert den Exit-Code nicht', async () => {
		const redCalls: unknown[] = [];
		const redSpy: MailSender = async (payload) => {
			redCalls.push(payload);
		};
		const red = await run({ reportFile: reportPath('tf4-red'), snapshot: await snapshotMissingRow, sendMail: redSpy });
		assert.equal(red.exitCode, 1);
		assert.ok(redCalls.length >= 1, 'roter Lauf mailt');

		const greenCalls: unknown[] = [];
		const greenSpy: MailSender = async (payload) => {
			greenCalls.push(payload);
		};
		const green = await run({ reportFile: reportPath('tf4-green'), sendMail: greenSpy });
		assert.equal(green.exitCode, 0);
		assert.equal(greenCalls.length, 0, 'grüner Lauf mailt nicht');

		const failingSpy: MailSender = async () => {
			throw new Error('SMTP nicht erreichbar');
		};
		const stillRed = await run({
			reportFile: reportPath('tf4-mailfail'),
			snapshot: await snapshotMissingRow,
			sendMail: failingSpy,
		});
		assert.equal(stillRed.exitCode, 1, 'Mail-Fehlschlag überschreibt den Exit-Code nicht');
	});
});

describe('mariadb-parallel-run — Produktschutz (#2928 TF5)', () => {
	it('TF5a (AK4): Produktiv-SQLite bleibt byte-identisch (Checksumme vor/nach)', async () => {
		const before = sha256(sourceFile);
		const result = await run({ reportFile: reportPath('tf5a') });
		assert.equal(result.exitCode, 0);
		assert.equal(sha256(sourceFile), before, 'Quelldatei vom Lauf unangetastet');
	});

	it('TF5b (AK4): Kopie liest aus dem Snapshot, nicht aus der Live-Datei', async () => {
		const snapshot = snapshotWith(async (snap) => {
			const admin = await snap.models.users.findOne({ where: { email: 'parallel-admin@example.org' } });
			const adminId = (admin?.get({ plain: true }) as { id: number } | undefined)?.id;
			assert.ok(adminId, 'Admin im Snapshot vorhanden');
			await snap.models.tasks.create({ title: 'Nur im Snapshot', userId: adminId });
		});
		const result = await run({ reportFile: reportPath('tf5b'), snapshot });
		const onlyInSnapshot = await Task.findOne({ where: { title: 'Nur im Snapshot' } });
		assert.ok(onlyInSnapshot, 'Ziel-DB enthält die nur im Snapshot existierende Aufgabe — Kopie liest den Snapshot');
		assert.equal(result.exitCode, 1, 'die Live-Datei kennt die Aufgabe nicht → Mismatch wird gemeldet');
	});
});
