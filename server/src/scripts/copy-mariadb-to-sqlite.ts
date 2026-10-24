import { pathToFileURL } from 'node:url';
import { type Model, ModelStatic, Sequelize } from 'sequelize';
import sequelize from '../database.js';
// Registriert ALLE Modelle auf der Default-Instanz (= Quelle im Reverse-Lauf) — die CLI übergibt
// sie von dort als explizites Modell-Set an den Kopierkern.
import '../models/index.js';
import {
	buildCopyReport,
	copyTableRows,
	reportExitCode,
	selectedModels,
	tableOf,
	type CopyReport,
} from './copy-sqlite-to-mariadb.js';

// Einmaliges Rückkopierwerkzeug MariaDB → SQLite (ADR 0026, #2830), Vertrag: docs/spec/issue-2830.md.
// CLI-Aufruf (tsx): DB_DIALECT=mysql MARIADB_HOST=… MARIADB_USER=… MARIADB_PASSWORD=…
// MARIADB_DATABASE=… DATABASE_STORAGE=<Pfad der neuen SQLite-Datei> node --import tsx src/scripts/copy-mariadb-to-sqlite.ts
// Exit-Code 0 nur bei vollständiger Übereinstimmung (reportExitCode).

/** CLI-Guard: die Quelle muss MariaDB sein (Default-Instanz via DB_DIALECT=mysql + MARIADB_*),
 * DATABASE_STORAGE trägt den Pfad der neuen SQLite-Zieldatei. */
export const assertReverseCliEnv = (env: { DB_DIALECT?: string; DATABASE_STORAGE?: string }): void => {
	if (!env.DATABASE_STORAGE) throw new Error('DATABASE_STORAGE setzen (Pfad der neuen SQLite-Zieldatei).');
	if (env.DB_DIALECT !== 'mysql') throw new Error('Quelle muss MariaDB sein: DB_DIALECT=mysql und MARIADB_* setzen.');
};

export const copyMariadbToSqlite = async (
	source: Sequelize,
	target: Sequelize,
	models: ModelStatic<Model>[],
): Promise<CopyReport> => {
	// Modelle für den Lauf auf dem Ziel registrieren: gleiche Attribute/Optionen (tableName, underscored,
	// BLOB/JSON-Typen), aber an die Ziel-Instanz gebunden — ohne Registrierung bleibt target.models leer
	// (die Vorwärts-Berichte sähen 0 Tabellen) und modellgebundene Schreibaufrufe würden in die Quelle laufen.
	const targetModels = models.map((model) => target.define(model.name, model.getAttributes(), model.options));
	await target.sync({ force: true });
	// FK-topologische Reihenfolge aus den Original-Modellen (sie tragen die Assoziationen); geschrieben
	// wird mit dem zielgebundenen Zwilling derselben Tabelle.
	const targetByTable = new Map(targetModels.map((model) => [tableOf(model), model]));
	for (const original of await selectedModels(source, models)) {
		await copyTableRows(source, target, targetByTable.get(tableOf(original)) as ModelStatic<Model>);
	}
	return buildCopyReport(source, target);
};

const main = async (): Promise<0 | 1> => {
	assertReverseCliEnv(process.env);
	// foreignKeys: false — der sqlite-Connection-Manager setzt sonst auf jeder neu geöffneten
	// Verbindung FOREIGN_KEYS=ON; Transaktionen pinnen eine eigene Verbindung, der Lauf hinge dann
	// allein an der FK-topologischen Ordnung. Option ist in den v6-Typen ungetippt (Spread).
	const target = new Sequelize({
		dialect: 'sqlite',
		storage: process.env.DATABASE_STORAGE,
		logging: false,
		...{ foreignKeys: false },
	});
	try {
		await sequelize.authenticate();
		const report = await copyMariadbToSqlite(sequelize, target, Object.values(sequelize.models));
		console.log(
			['tabelle\tquelle\tziel', ...report.tables.map((t) => `${t.table}\t${t.source}\t${t.target}`)].join('\n'),
		);
		console.log(`blobs: ${report.blobs.checked} geprueft, ${report.blobs.mismatched} abweichend | ok=${report.ok}`);
		return reportExitCode(report);
	} finally {
		await target.close();
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
