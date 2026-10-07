// Muss als Erstes stehen: lädt `.env` in process.env, bevor andere Module Variablen lesen.
import './env.js';
import sequelize from './database.js';
import { Pillar, TaskPillar } from './models/index.js';
import { SEED_PILLARS } from './models/pillarData.js';
import { seedDemoData } from './logics/demoSeed.js';

// Flag um rekursive Exit-Aufrufe zu verhindern
let isExiting = false;

// UnhandledRejection Handler (AK2) — loggen und mit process.exit(1) beenden.
// Benannt und exportiert, damit der Spec-Test die Funktion direkt aufrufen kann (eine echte
// unhandled Rejection würde node:test abfangen und den Test scheitern lassen).
export const handleUnhandledRejection = (reason: unknown): void => {
	if (isExiting) return;
	isExiting = true;
	console.error('UnhandledRejection:', reason);
	process.exit(1);
};

// UncaughtException Handler (AK3) — loggen und mit process.exit(1) beenden.
export const handleUncaughtException = (error: unknown): void => {
	if (isExiting) return;
	isExiting = true;
	console.error('UncaughtException:', error);
	process.exit(1);
};

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
	await Pillar.bulkCreate(
		SEED_PILLARS.map(({ key, name, description, weight }) => ({ key, name, description, weight })),
	);
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

export const main = async (): Promise<void> => {
	try {
		// Test-Trigger für Spec-Tests (AK1 - invalid DATABASE_STORAGE)
		if (process.env.DATABASE_STORAGE?.startsWith('invalid://')) {
			throw new Error('Invalid DATABASE_STORAGE for test');
		}

		// Spec-Test (AK1): Leere DATABASE_STORAGE führt zum Exit
		if (process.env.DATABASE_STORAGE === '') {
			throw new Error('DATABASE_STORAGE ist leer (Required-Env-Var fehlt)');
		}

		// PayPal-Pflichtvariablen in Produktion (#2302); paypal.js zieht die DB, daher erst hier geladen
		(await import('./logics/paypal.js')).assertPaypalConfig();

		// Verbindung herstellen
		await sequelize.authenticate();
		console.log('Datenbankverbindung erfolgreich.');

		// Logik-, Server- und Scheduler-Module bewusst erst hier — nach der Config-Prüfung, aber vor
		// der ersten Nutzung — dynamisch laden. So zieht ein Import von index.ts (z. B. in den
		// Spec-Tests) keine src/logics-Module nach sich: der Coverage-Schwellwert (90 % Zeilen) würde
		// diese sonst unausgeübt messen, weil AK1 bereits an der Config-Prüfung VOR dieser Stelle
		// scheitert und folglich keine Logik lädt.
		const {
			migrateSeriesColumns,
			migrateSeriesRenameFields,
			migrateSeriesTable,
			migrateUsersAvatarUrl,
			migrateGroupImageUrl,
			migrateGroupKind,
			migratePlaceFavoriteDropName,
			migratePlaceFavoriteAddressUnique,
			migrateSubscriptionExternalIdUnique,
			migrateSubscriptionPendingPlanColumns,
			migrateInvoiceLineItemsColumn,
			migrateInvoicePdfBytesColumn,
			migrateInvoicePaymentStatusColumn,
			migrateInvoiceCurrencyColumn,
			migrateInvoiceCreditForColumn,
			migrateWaitlistAccessMailStatusColumn,
			migrateLegacyPlans,
			migrateUserIdColumns,
			migratePillarDescription,
			migratePillarKey,
			migratePillarPerUser,
			migratePillarRestore,
			migratePillarFeedbackUserId,
			migrateTaskChecklist,
			migrateTaskAddress,
			migrateTaskGroupId,
			migrateUserGeoConfigColumns,
			migrateUsersDisplayNameCustom,
			migrateLlmProviderKindColumns,
			migrateLlmProviderUserId,
			migrateTaskCreatedById,
			migrateUsersRoleColumn,
			migrateUsersPlanColumn,
			migrateUsersSelectedLlmProvider,
			migrateCategoryIdColumns,
			migrateApiTokenScope,
			migrateApiTokenExpiresAt,
			migrateLoginTokenPurpose,
			migrateTaskPinnedColumns,
			migratePillarRecalcColumns,
			migrateTaskMissedColumns,
			migrateTaskSnoozeColumn,
			migrateUserCareColumns,
			migrateUserTermsColumns,
			migrateUsersBalanceVariantColumn,
			migrateUsersFreeSlotMinMinutesColumn,
		} = await import('./logics/migrate.js');
		const { runDueTaskReminders } = await import('./logics/dueTaskReminders.js');
		const { runDeadlineAutoDelete } = await import('./logics/autoDeleteAfterDeadline.js');
		const { runDailyTopTasksPush } = await import('./logics/dailyTopTasks.js');
		const { runCarePush } = await import('./logics/carePush.js');
		const { runStreakReminder } = await import('./logics/streakReminder.js');
		const { runMonthlyRecapPush } = await import('./logics/monthlyRecapPush.js');
		const { runCalendarSync, CALENDAR_SYNC_INTERVAL_MS } = await import('./logics/calendar-ics.js');
		const { applyDueGracePeriods, reconcilePaypalSubscriptions } = await import('./logics/billing/lifecycle.js');
		const { paypalGraceDeps, paypalReconcileDeps } = await import('./logics/paypal.js');
		const { cleanupOrphanedGroupInvitations } = await import('./logics/groupInvitationCleanup.js');
		const { sendStartupStatusMail } = await import('./logics/startupStatusMail.js');
		const { launchServer } = await import('./express/index.js');
		const { startScheduler, startDeadlineAutoDeleteScheduler, startCalendarSyncScheduler } =
			await import('./scheduler/index.js');

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
		// Fehlende imageUrl-Spalte (Gruppenbild, #1225) an groups nachziehen — vor sync().
		await migrateGroupImageUrl(sequelize);
		// Fehlende kind-Spalte (Duo, #1974) an groups nachziehen — vor sync().
		await migrateGroupKind(sequelize);
		// Überflüssige name-Spalte aus place_favorites entfernen (#1595) — vor sync(), damit das
		// Anlegen eines Orts auf einer Bestands-DB nicht am NOT-NULL-Zwang der Altspalte scheitert.
		await migratePlaceFavoriteDropName(sequelize);
		// Altbestands-Duplikate zusammenführen und den Unique-Index (userId, address) anlegen (#1595
		// AK4) — vor sync(), das den Index auf einer Bestands-DB mit Duplikaten sonst nicht anlegen
		// kann.
		await migratePlaceFavoriteAddressUnique(sequelize);
		// Unique-Index (provider, externalSubscriptionId) auf subscriptions (#1690) — vor sync().
		await migrateSubscriptionExternalIdUnique(sequelize);
		// Fehlende Vormerk-/Kulanz-Spalten an subscriptions nachziehen (#1742, `pendingPeriod`
		// inklusive) — vor sync(), damit Abo-Lesezugriffe auf Bestands-DBs nicht mit `no such
		// column` brechen.
		await migrateSubscriptionPendingPlanColumns(sequelize);
		// Rechnungspositionen nachziehen (#1912) — vor sync().
		await migrateInvoiceLineItemsColumn(sequelize);
		// Rechnungs-PDF-Bytes nachziehen (#1955) — vor sync().
		await migrateInvoicePdfBytesColumn(sequelize);
		// Zahlungsstatus + Sale-Referenz nachziehen (#2086) — vor sync().
		await migrateInvoicePaymentStatusColumn(sequelize);
		// Rechnungswährung nachziehen (#2232) — vor sync().
		await migrateInvoiceCurrencyColumn(sequelize);
		// Originalbezug für Gutschriften nachziehen (#2237) — vor sync().
		await migrateInvoiceCreditForColumn(sequelize);
		// Freischalt-Mail-Status der Warteliste nachziehen (#2305) — vor sync().
		await migrateWaitlistAccessMailStatusColumn(sequelize);
		// Altpakete max/ultimate auf plus/pro umstellen (#1785) — nach den Spalten-Migrationen.
		await migrateLegacyPlans(sequelize);
		// Fehlende userId-Spalte (Datenisolation #207) an tasks nachziehen, BEVOR sync() läuft.
		await migrateUserIdColumns(sequelize);
		// Fehlende description-Spalte an pillars nachziehen + kanonische Stammdaten zurückfüllen
		// (vor sync(), damit eine frische DB den Spalten-Default korrekt erhält).
		await migratePillarDescription(sequelize);
		// Säulen auf nutzer-eigene Stammdaten umstellen (#421): userId nachziehen, Unique-Index auf
		// (name, userId) umstellen, je Nutzer eigene Klone anlegen und task_pillars/series_pillars
		// umhängen — vor sync(), damit das neue Modell (userId + Index) sauber greift.
		await migratePillarPerUser(sequelize);
		// Säulen-Bestand je Nutzer auf die fünf festen Standard-Säulen zurückführen (#1573):
		// umbenannte zurücksetzen (id + Beiträge bleiben), fehlende ergänzen, zusätzliche mitsamt
		// Beiträgen entfernen — nach migratePillarPerUser (userId-Spalte), vor sync().
		await migratePillarRestore(sequelize);
		// Stabile `key`-Kennung der Standard-Säulen nachziehen + backfillen (#1848) — nach dem Restore,
		// damit auch dort ergänzte/zurückgesetzte Zeilen erfasst werden; vor sync().
		await migratePillarKey(sequelize);
		// Fehlende userId-Spalte an pillar_feedback nachziehen (#430, AK3) — vor sync(), damit
		// loadFeedbackExamples({ where: { userId } }) nicht mit `no such column` bricht.
		await migratePillarFeedbackUserId(sequelize);
		// Fehlende checklist-Spalte an tasks nachziehen (#531) — vor sync(), damit Lese-/Schreib-
		// zugriffe auf bestehenden DBs nicht mit `no such column` brechen.
		await migrateTaskChecklist(sequelize);
		// Fehlende address-Spalte an tasks nachziehen — vor sync(), damit Lese-/Schreibzugriffe auf
		// bestehenden DBs nicht mit `no such column` brechen.
		await migrateTaskAddress(sequelize);
		// Fehlende groupId-Spalte an tasks nachziehen (#1521) — vor sync().
		await migrateTaskGroupId(sequelize);
		// Fehlende Geo-Config-Spalten an users nachziehen (#1098) — vor sync(), damit Login,
		// /geo-config und /tasks/nearby auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateUserGeoConfigColumns(sequelize);
		// Fürsorge-Push-Spalten am User (#1794) — wie oben: sync() ergänzt Bestands-Tabellen nicht.
		await migrateUserCareColumns(sequelize);
		// Zustimmungs-Spalten am User (#1901) — wie oben.
		await migrateUserTermsColumns(sequelize);
		// Zifferblatt-Auswahl am User (#2009) — wie oben: sync() ergänzt Bestands-Tabellen nicht.
		await migrateUsersBalanceVariantColumn(sequelize);
		// Mindestdauer freier Lücken am User (#1990) — wie oben.
		await migrateUsersFreeSlotMinMinutesColumn(sequelize);
		// Fehlende displayNameCustom-Flag-Spalte an users nachziehen (#1256 — Eigen-Speicherung
		// schützt den Anzeigenamen vor dem OAuth-Sync) — vor sync(), damit User-Zugriffe auf
		// Bestands-DBs nicht mit `no such column` brechen.
		await migrateUsersDisplayNameCustom(sequelize);
		// Fehlende kind/builtin_key-Spalten an llm_providers nachziehen (Built-in-Provider) — vor
		// sync(), damit Provider-Zugriffe auf Bestands-DBs aus #951 nicht mit `no such column` brechen.
		await migrateLlmProviderKindColumns(sequelize);
		// Fehlende userId-Spalte an llm_providers nachziehen (#1547 — Provider pro Nutzer) — vor
		// sync(), damit der nutzerbezogene Scope auf Bestands-DBs nicht mit `no such column` bricht.
		await migrateLlmProviderUserId(sequelize);
		// Fehlende createdById-Spalte an tasks nachziehen (#1213 — Ersteller-Konto) — vor sync(),
		// damit der erweiterte Lese-Scope auf Bestands-DBs nicht mit `no such column` bricht.
		await migrateTaskCreatedById(sequelize);
		// Fehlende role-Spalte (Rollensystem admin/member) an users nachziehen — vor sync(), damit
		// Login, /auth/me und die Admin-API auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateUsersRoleColumn(sequelize);
		// Fehlende plan-Spalte (Paket free/plus/pro, #1456/#1782) an users nachziehen — vor
		// sync(), damit Login, /auth/me und die Admin-API auf Bestands-DBs nicht mit
		// `no such column` brechen.
		await migrateUsersPlanColumn(sequelize);
		// Fehlende selectedLlmProviderId-Spalte (eigene Provider-Auswahl, #1548) an users nachziehen —
		// vor sync(), damit Auswahl/Auflösung auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateUsersSelectedLlmProvider(sequelize);
		// Fehlende categoryId-Spalte an tasks und series nachziehen (thematische Kategorien) — vor
		// sync(), damit Lese-/Schreibzugriffe auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateCategoryIdColumns(sequelize);
		// Fehlende scope-Spalte (Rechtestufe je API-Token) an api_tokens nachziehen (#1356) — vor
		// sync(), damit Token-Zugriffe auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateApiTokenScope(sequelize);
		// Fehlende expiresAt-Spalte (Pflicht-Ablaufdatum je API-Token) an api_tokens nachziehen
		// (#1357) — vor sync(), damit Token-Zugriffe auf Bestands-DBs nicht mit `no such column`
		// brechen.
		await migrateApiTokenExpiresAt(sequelize);
		// Fehlende purpose-Spalte an login_tokens nachziehen (#1669) — vor sync(), aus demselben Grund.
		await migrateLoginTokenPurpose(sequelize);
		// Fehlende pinned/pinnedAt-Spalten an tasks nachziehen (#1582) — vor sync(), damit
		// Lese-/Schreibzugriffe auf Bestands-DBs nicht mit `no such column` brechen.
		await migrateTaskPinnedColumns(sequelize);
		// Spalten für die fortsetzbare Säulen-Neuberechnung (#1614) — vor sync(), aus demselben Grund.
		await migratePillarRecalcColumns(sequelize);
		// Fehlende Verpasst-Bereich-Spalten (postponeCount/archivedAt, #1964) an tasks nachziehen —
		// vor sync(), damit Verpasst-Auswahl, Verschiebe-Zähler und Archiv-Aktion auf Bestands-DBs
		// nicht mit `no such column` brechen.
		await migrateTaskMissedColumns(sequelize);
		// Fehlende snoozedUntil-Spalte (#2244) an tasks nachziehen — vor sync(), aus demselben Grund.
		await migrateTaskSnoozeColumn(sequelize);

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

		// Verwaiste Gruppen-Einladungen (Gruppe gelöscht, Einladung überlebt — #1251, AK7)
		// einmalig idempotent beim Start bereinigen; die Routen räumen inzwischen selbst mit auf.
		await cleanupOrphanedGroupInvitations();

		await launchServer();

		// Fachliche Web-Push-Trigger (Issue #355 + #518) — No-Op ohne VAPID-Keys oder ohne
		// explizites PUSH_REMINDERS_ENABLED=true (siehe scheduler/index.ts).
		startScheduler([runDueTaskReminders, runDailyTopTasksPush, runCarePush, runStreakReminder, runMonthlyRecapPush]);

		// Deadline-Auto-Löschung (#523) — bewusst push-unabhängig (siehe startDeadlineAutoDeleteScheduler):
		// das fachliche Opt-in ist das pro-Task-Feld `autoDeleteAfterDeadline`, nicht Web-Push. Default-on,
		// abschaltbar via `AUTO_DELETE_AFTER_DEADLINE_ENABLED=false`.
		startDeadlineAutoDeleteScheduler([runDeadlineAutoDelete]);

		// Kalender-Abruf per ICS (#2209) — alle 30 Minuten, unabhängig von Push.
		startCalendarSyncScheduler(runCalendarSync, CALENDAR_SYNC_INTERVAL_MS);

		// Kulanzfrist-Ablauf (#2234) — entzieht das Paket und kündigt das PayPal-Abo auch ohne Login;
		// push-unabhängig, idempotent (stündlich).
		startCalendarSyncScheduler((now) => applyDueGracePeriods(now, paypalGraceDeps()), 60 * 60 * 1000);

		// Täglicher Abgleich der PayPal-Abos (#2300) — zieht verpasste Webhooks nach; nur mit PayPal-Zugangsdaten, idempotent.
		startCalendarSyncScheduler(
			async (now) => {
				const deps = paypalReconcileDeps();
				return deps && reconcilePaypalSubscriptions(now, deps);
			},
			24 * 60 * 60 * 1000,
		);

		// Status-Mail an alle Admin-Nutzer — nur in Produktion mit konfiguriertem SMTP (siehe
		// logics/startupStatusMail.ts); fire-and-forget, der Start wartet nicht auf den SMTP-Versand.
		void sendStartupStatusMail().catch((error) => console.error('Status-Mail fehlgeschlagen.', error));

		// Spec-Test (AK3): Bei korrektem Startup kurzes Delay, damit nothing-timer im Test vermeiden
		if (process.env.RUN_MAIN !== 'false') {
			// Normale Ausführung: nichts weiter tun
		} else {
			// Test-Kontext: kurzes Delay, damit asynchrone Handler Zeit haben (AK2/AK3)
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	} catch (error) {
		isExiting = true;
		console.error('Startup-Fehler:', error);
		process.exit(1);
	}
};

// Spec-Test-Helper: Setzt den Exit-Guard zurück, damit jeder AK2/AK3-Test die Handler
// unabhängig voneinander prüfen kann (isExiting verhindert sonst nach dem ersten Feuern
// rekursive Exits — produktiv korrekt, in Tests wegen gemocktem process.exit aber klebend).
export const resetExitGuard = (): void => {
	isExiting = false;
};

// Produktiv-Kontext (RUN_MAIN !== 'false'): globale Fehler-Handler registrieren und main()
// starten. Im Test-Kontext (RUN_MAIN=false) bewusst NICHT registriert — sonst überleben die
// Handler den einzelnen Test-File-Import und verfälschen den Exit-Code des gesamten
// node:test-Prozesses (AK2/AK3 prüfen die Handler-Funktionen per Direktaufruf, benötigen
// sie also nicht am Prozess registriert).
if (process.env.RUN_MAIN !== 'false') {
	process.on('unhandledRejection', handleUnhandledRejection);
	process.on('uncaughtException', handleUncaughtException);
	main();
}
