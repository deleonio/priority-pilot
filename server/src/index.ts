// Muss als Erstes stehen: lädt `.env` in process.env, bevor andere Module Variablen lesen.
import './env.js';
import { logEnvConfig } from './env-startup-log.js';
import sequelize from './database.js';
import { launchServer } from './express/index.js';
import {
	migrateSeriesColumns,
	migrateSeriesRenameFields,
	migrateSeriesTable,
	migrateUsersAvatarUrl,
	migrateUserIdColumns,
	migratePillarDescription,
	migratePillarPerUser,
	migratePillarFeedbackUserId,
} from './logics/migrate.js';
import { buildTaskForest } from './logics/tree.js';
import { runDueTaskReminders } from './logics/dueTaskReminders.js';
import { runDeadlineAutoDelete } from './logics/autoDeleteAfterDeadline.js';
import { runDailyTopTasksPush } from './logics/dailyTopTasks.js';
import { Pillar, Task, TaskPillar } from './models/index.js';
import { SEED_PILLARS } from './models/pillarData.js';
import { startScheduler, startDeadlineAutoDeleteScheduler } from './scheduler/index.js';

// Daten nur auf ausdrücklichen Wunsch zurücksetzen (sonst kein stiller Datenverlust).
const shouldReset = process.env.DB_RESET === 'true';

// Demo-Seed (`seedDemoData`) gezielt abschaltbar (`DB_SEED=false`), z. B. für die E2E-Tests, die von
// einem leeren, definierten Zustand starten sollen. Der Säulen-Seed (`seedPillars`) bleibt davon
// unberührt — die fünf Lebensbalance-Säulen sind Stammdaten, keine Demo-Daten.
const shouldSeedDemo = process.env.DB_SEED !== 'false';

// Die fünf festen Lebensbalance-Säulen als kanonische Stammdaten (Name + Kurzbeschreibung +
// Default-Gewichtung). Globale Daten — für alle Nutzer identisch (siehe SEED_PILLARS).

const seedPillars = async (): Promise<void> => {
	const existing = await Pillar.count();
	if (existing > 0) {
		return;
	}
	await Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight })));
};

/**
 * Migriert Bestandsdaten von der früheren Einzel-Säule (`tasks.pillarId`, n:1) auf die n:m-Beiträge
 * in `task_pillars`. `sequelize.sync()` ohne `alter` lässt eine vorhandene `pillarId`-Spalte stehen,
 * statt sie zu entfernen — die alten Zuordnungen würden sonst verwaisen. Einmalig (nur solange
 * `task_pillars` leer ist) jede gesetzte `pillarId` mit `share = 100` / `confidence = 100`
 * (volle Einzahlung, volle Sicherheit) überführen. Bei `DB_RESET=true` existiert die Altspalte nicht
 * mehr, die Migration ist dann ein No-op.
 */
const migrateLegacySinglePillar = async (): Promise<void> => {
	if ((await TaskPillar.count()) > 0) {
		return;
	}
	const [columns] = await sequelize.query("PRAGMA table_info('tasks')");
	const hasLegacyColumn = (columns as { name: string }[]).some((column) => column.name === 'pillarId');
	if (!hasLegacyColumn) {
		return;
	}
	await sequelize.query(
		'INSERT INTO task_pillars (taskId, pillarId, share, confidence) ' +
			'SELECT id, pillarId, 100, 100 FROM tasks WHERE pillarId IS NOT NULL',
	);
	console.log('Bestehende Einzel-Säulen-Zuordnungen nach task_pillars migriert.');
};

const seedDemoData = async (): Promise<void> => {
	const existing = await Task.count();
	if (existing > 0) {
		return;
	}

	const pillarByName = new Map((await Pillar.findAll()).map((pillar) => [pillar.name, pillar]));

	const task1 = await Task.create({
		title: 'Task 1',
		status: 'Open',
		priority: 1,
		estimatedEffort: 1,
		deadline: new Date('2025-01-15'),
	});
	const task2 = await Task.create({ title: 'Task 2', status: 'In process', priority: 2, estimatedEffort: 0.5 });
	const task3 = await Task.create({
		title: 'Task 3',
		status: 'Open',
		priority: 3,
		estimatedEffort: 0.75,
		deadline: new Date('2025-01-20'),
	});
	const task4 = await Task.create({ title: 'Task 4', status: 'Open', priority: 4, estimatedEffort: 1 });

	await task1.addDependency(task2, { through: { weight: 0.5 } });
	await task1.addDependency(task3, { through: { weight: 0.1 } });
	await task4.addDependency(task3, { through: { weight: 1.0 } });

	// Beispielhafte Mehrfach-Einzahlung: Task 1 verteilt 70/30 auf zwei Säulen (mit Konfidenz),
	// Task 3 zahlt voll auf eine Säule ein. Übrige Tasks bleiben ohne Säule (neutral).
	const wirksamkeit = pillarByName.get('Wirksamkeit');
	const sinn = pillarByName.get('Sinn');
	const koerper = pillarByName.get('Körper');
	if (wirksamkeit && sinn) {
		await task1.addPillar(wirksamkeit.id, { through: { share: 70, confidence: 90 } });
		await task1.addPillar(sinn.id, { through: { share: 30, confidence: 60 } });
	}
	if (koerper) {
		await task3.addPillar(koerper.id, { through: { share: 100, confidence: 100 } });
	}
};

const main = async (): Promise<void> => {
	logEnvConfig();
	try {
		// Verbindung herstellen
		await sequelize.authenticate();
		console.log('Datenbankverbindung erfolgreich.');

		// Fehlende Serien-Spalten auf einer Bestands-DB nachziehen, BEVOR sync() den Unique-Index
		// auf (seriesId, seriesOccurrence) anlegt (sonst SQLITE_ERROR: no such column, siehe #146).
		await migrateSeriesColumns(sequelize);
		// Serien-Spalten defaultPriority/defaultEstimatedEffort → priority/estimatedEffort umbenennen
		// (#300). MUSS vor migrateSeriesTable und sync() laufen: liefe migrateSeriesTable mit den neuen
		// Spaltennamen zuerst, legte es auf einer Bestands-DB mit Alt-Spalten leere Neu-Spalten an →
		// das RENAME schlüge fehl.
		await migrateSeriesRenameFields(sequelize);
		// Fehlende Spalten der series-Tabelle nachziehen (#163).
		await migrateSeriesTable(sequelize);
		// Fehlende avatarUrl-Spalte in users nachziehen (#217).
		await migrateUsersAvatarUrl(sequelize);
		// Fehlende userId-Spalte (Datenisolation #207) an tasks nachziehen, BEVOR sync() läuft.
		await migrateUserIdColumns(sequelize);
		// Fehlende description-Spalte an pillars nachziehen + kanonische Stammdaten zurückfüllen
		// (vor sync(), damit eine frische DB den Spalten-Default korrekt erhält).
		await migratePillarDescription(sequelize);
		// Säulen auf nutzer-eigene Stammdaten umstellen (#421): userId nachziehen, Unique-Index auf
		// (name, userId) umstellen, je Nutzer eigene Klone anlegen und task_pillars/series_pillars
		// umhängen — vor sync(), damit das neue Modell (userId + Index) sauber greift.
		await migratePillarPerUser(sequelize);
		// Fehlende userId-Spalte an pillar_feedback nachziehen (#430, AK3) — vor sync(), damit
		// loadFeedbackExamples({ where: { userId } }) nicht mit `no such column` bricht.
		await migratePillarFeedbackUserId(sequelize);

		// Datenbank synchronisieren (force nur bei DB_RESET=true)
		await sequelize.sync({ force: shouldReset });
		console.log('Modelle synchronisiert.');

		// Die fünf Säulen in eine leere DB säen (idempotent)
		await seedPillars();

		// Bestehende Einzel-Säulen-Zuordnungen einmalig auf die n:m-Beiträge migrieren
		await migrateLegacySinglePillar();

		// Beispiel-Daten nur anlegen, wenn die Datenbank leer ist (und der Demo-Seed nicht via
		// `DB_SEED=false` abgeschaltet wurde).
		if (shouldSeedDemo) {
			await seedDemoData();
		}

		console.log(JSON.stringify(await buildTaskForest(), null, 2));
		await launchServer();

		// Fachliche Web-Push-Trigger (Issue #355 + #518) — No-Op ohne VAPID-Keys oder ohne
		// explizites PUSH_REMINDERS_ENABLED=true (siehe scheduler/index.ts).
		startScheduler([runDueTaskReminders, runDailyTopTasksPush]);

		// Deadline-Auto-Löschung (#523) — bewusst push-unabhängig (siehe startDeadlineAutoDeleteScheduler):
		// das fachliche Opt-in ist das pro-Task-Feld `autoDeleteAfterDeadline`, nicht Web-Push. Default-on,
		// abschaltbar via `AUTO_DELETE_AFTER_DEADLINE_ENABLED=false`.
		startDeadlineAutoDeleteScheduler([runDeadlineAutoDelete]);
	} catch (error) {
		console.error('Fehler:', error);
	}
};

main();
