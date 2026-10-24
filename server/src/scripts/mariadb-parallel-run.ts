import { appendFileSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueryTypes, Sequelize } from 'sequelize';
// Registriert ALLE Modelle auf der Default-Instanz — ohne diesen Import ist `target.models` leer.
import '../models/index.js';
import sequelize from '../database.js';
import { sendMailToUser, type MailSender } from '../logics/mail.js';
import { copySqliteToMariadb } from './copy-sqlite-to-mariadb.js';
import { requireMariaDbTarget, verifyDbIdentity, type IdentityReport } from './verify-db-identity.js';

// Täglicher SQLite→MariaDB-Parallellauf (ADR 0026, #2928), Vertrag: docs/spec/issue-2928.md.
// Orchestriert #2827 (Kopie aus konsistentem Snapshot) + #2829 (Identity-Prüfung gegen die
// Produktiv-Datei), hängt je Lauf genau eine JSONL-Zeile an die Report-Datei und mailt bei rot
// die Admins. CLI-Aufruf (tsx): DB_DIALECT=mysql MARIADB_HOST=… MARIADB_USER=… MARIADB_PASSWORD=…
// MARIADB_DATABASE=… DATABASE_STORAGE=<Pfad zur SQLite-Datei> MARIADB_PARALLEL_REPORT=<Report-Pfad>
// node --import tsx src/scripts/mariadb-parallel-run.ts
// Exit-Code 0 nur bei grünem Lauf (Vertrag reportExitCode); die Produktiv-SQLite bleibt unangetastet.

export type ParallelRunResult = { exitCode: 0 | 1; cause?: string };

export type ParallelRunDeps = {
	/** Pfad zur Produktiv-SQLite-Datei (Env `DATABASE_STORAGE`). */
	sourceStorage: string;
	/** MariaDB-Schatten-DB als Sequelize-Instanz (Env `DB_DIALECT=mysql` + `MARIADB_*`). */
	target: Sequelize;
	/** Report-Datei (JSONL); Env `MARIADB_PARALLEL_REPORT`, Default `<app>/mariadb-parallel/runs.log`. */
	reportFile: string;
	/** Injektions-Seam (#1426-Muster): Default = konsistenter SQLite-Snapshot (VACUUM INTO) in eine Temp-Datei. */
	snapshot?: (sourceStorage: string) => Promise<string>;
	/** Injektions-Seam: Default = nodemailer-Versand (Muster startupStatusMail). Nur bei rot. */
	sendMail?: MailSender;
};

/** SQL-String-Literal (Pfad für VACUUM INTO), Anführungszeichen verdoppelt. */
const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** Konsistenter Snapshot der Quelldatei: `VACUUM INTO` liest die Produktiv-SQLite nur und schreibt
 * eine transaktionskonsistente Kopie (Node-Pendant zum `.backup` in maintenance.sh). */
const defaultSnapshot = async (sourceStorage: string): Promise<string> => {
	const snapshotFile = join(
		tmpdir(),
		`mariadb-parallel-snap-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
	);
	const source = new Sequelize({ dialect: 'sqlite', storage: sourceStorage, logging: false });
	try {
		await source.query(`VACUUM INTO ${sqlString(snapshotFile)}`);
	} finally {
		await source.close();
	}
	return snapshotFile;
};

/** Hängt genau eine JSONL-Zeile an; das Report-Verzeichnis entsteht bei Bedarf (erster Cron-Lauf). */
const appendReport = async (reportFile: string, line: Record<string, unknown>): Promise<void> => {
	mkdirSync(dirname(reportFile), { recursive: true });
	appendFileSync(reportFile, `${JSON.stringify(line)}\n`);
};

/** Status-Mail an alle Admins (Muster startupStatusMail) — nur bei rot; ein Versandfehler wird
 * bewusst geschluckt und ändert den Exit-Code nicht (AK5). */
const reportByMail = async (deps: ParallelRunDeps, cause: string): Promise<void> => {
	try {
		// Admins aus der PRODUKTIV-SQLite (roher Les-Zugriff auf deps.sourceStorage), nicht von der
		// Default-Instanz: im CLI-Betrieb (DB_DIALECT=mysql) ist diese die Schatten-DB — bei roten
		// Läufen mit leerer/teilweiser Schatten-DB bliebe die AK5-Mail sonst still aus.
		const prod = new Sequelize({ dialect: 'sqlite', storage: deps.sourceStorage, logging: false });
		let admins: Array<{ email: string }>;
		try {
			admins = (await prod.query(`SELECT email FROM users WHERE role = 'admin'`, {
				type: QueryTypes.SELECT,
			})) as Array<{ email: string }>;
		} finally {
			await prod.close();
		}
		for (const admin of admins) {
			await sendMailToUser(
				{ email: admin.email },
				{
					subject: `Balamentum Parallellauf rot (${new Date().toLocaleDateString('de-DE')})`,
					text: [
						'Der tägliche SQLite->MariaDB-Parallellauf ist fehlgeschlagen.',
						'',
						`Ursache: ${cause}`,
						`Report: ${deps.reportFile}`,
						'',
					].join('\n'),
				},
				deps.sendMail,
			);
		}
	} catch {
		// Mail-Fehlschlag überschreibt den Exit-Code nicht — rot bleibt rot.
	}
};

/**
 * Ein Parallellauf: Snapshot → Kopie (#2827) → Identity-Prüfung (#2829, gegen die Produktiv-Datei)
 * → genau eine Report-Zeile → bei rot Status-Mail. Wirft nie nach außen (AK3 — kein Lauf ohne
 * Report-Zeile); Exit-Code 0 nur bei `report.ok === true` (AK1).
 */
export const runParallelCopy = async (deps: ParallelRunDeps): Promise<ParallelRunResult> => {
	try {
		const snapshotFile = await (deps.snapshot ?? defaultSnapshot)(deps.sourceStorage);
		// Temp-Snapshot nach der Kopie löschen (täglicher Cron würde sonst in tmpdir() akkumulieren).
		try {
			const snapshotDb = new Sequelize({ dialect: 'sqlite', storage: snapshotFile, logging: false });
			try {
				await copySqliteToMariadb(snapshotDb, deps.target);
			} finally {
				await snapshotDb.close();
			}
		} finally {
			await rm(snapshotFile, { force: true });
		}
		// Identity-Prüfung gegen die PRODUKTIV-Datei (wie das CLI #2829): die Kopie muss dem
		// Produktionsstand entsprechen — eine Kopie aus einem veralteten/veränderten Snapshot fliegt auf.
		const live = new Sequelize({ dialect: 'sqlite', storage: deps.sourceStorage, logging: false });
		let identity: IdentityReport;
		try {
			identity = await verifyDbIdentity(live, deps.target);
		} finally {
			await live.close();
		}
		const tables = identity.tables.length;
		const rows = identity.tables.reduce((sum, entry) => sum + entry.source, 0);
		const mismatched = identity.tables.filter((entry) => !entry.match).length;
		const date = new Date().toISOString();
		if (identity.ok) {
			await appendReport(deps.reportFile, { date, ok: true, tables, rows, mismatched });
			return { exitCode: 0 };
		}
		const cause = `Identity-Mismatch: ${identity.tables
			.filter((entry) => !entry.match)
			.map((entry) => `${entry.table} (abweichende PKs: ${entry.differingPks.join(',') || '-'})`)
			.join('; ')}`;
		await appendReport(deps.reportFile, { date, ok: false, tables, rows, mismatched, cause });
		await reportByMail(deps, cause);
		return { exitCode: 1, cause };
	} catch (error) {
		const cause = error instanceof Error ? error.message : String(error);
		await appendReport(deps.reportFile, {
			date: new Date().toISOString(),
			ok: false,
			tables: 0,
			rows: 0,
			mismatched: 0,
			cause,
		});
		await reportByMail(deps, cause);
		return { exitCode: 1, cause };
	}
};

const main = async (): Promise<0 | 1> => {
	// Report-Pfad zuerst: auch Fehler VOR runParallelCopy (Env, Dialekt-Guard, authenticate) landen
	// im Rot-Pfad — genau eine Report-Zeile + Admin-Mail (AK3), sonst überhöht das `tail -n 7`-
	// Fenster den 7-Tage-Streak still (AK2).
	const reportFile = process.env.MARIADB_PARALLEL_REPORT?.trim() || join(process.cwd(), 'mariadb-parallel', 'runs.log');
	try {
		const storage = process.env.DATABASE_STORAGE;
		if (!storage) throw new Error('DATABASE_STORAGE setzen (Pfad zur SQLite-Quelldatei).');
		requireMariaDbTarget(sequelize);
		await sequelize.authenticate();
		const result = await runParallelCopy({ sourceStorage: storage, target: sequelize, reportFile });
		console.log(`ok=${result.exitCode === 0}${result.cause ? ` | ${result.cause}` : ''} | report: ${reportFile}`);
		return result.exitCode;
	} catch (error) {
		const cause = error instanceof Error ? error.message : String(error);
		await appendReport(reportFile, {
			date: new Date().toISOString(),
			ok: false,
			tables: 0,
			rows: 0,
			mismatched: 0,
			cause,
		});
		// Admin-Mail nur bei bekannter Produktiv-Datei (dort stehen die Empfänger); ohne sie bleibt
		// es bei der roten Zeile — der Versand ist bewusst best effort (AK5).
		const storage = process.env.DATABASE_STORAGE;
		if (storage) {
			await reportByMail({ sourceStorage: storage, target: sequelize, reportFile }, cause);
		}
		console.error(cause);
		return 1;
	} finally {
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
