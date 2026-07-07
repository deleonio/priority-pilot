import Task from './task.js';
import Dependency from './dependency.js';
import Pillar from './pillar.js';
import TaskPillar from './taskPillar.js';
import PillarFeedback from './pillarFeedback.js';
import ScoreEntry from './scoreEntry.js';
import Series from './series.js';
import SeriesPillar from './seriesPillar.js';
import User from './user.js';
import PushSubscription from './pushSubscription.js';
import NotificationLog from './notificationLog.js';

Task.belongsToMany(Task, {
	as: 'dependencies',
	through: Dependency,
	foreignKey: 'dependentTaskId',
	otherKey: 'dependingTaskId',
});

Task.belongsToMany(Task, {
	as: 'dependents',
	through: Dependency,
	foreignKey: 'dependingTaskId',
	otherKey: 'dependentTaskId',
});

// Ein Task zahlt auf 0..n Säulen ein und eine Säule trägt 0..n Tasks (n:m). Die Join-Zeile in
// `task_pillars` hält `share` (100 %-Verteilung je Task) und `confidence` (siehe taskPillar.ts).
Task.belongsToMany(Pillar, { through: TaskPillar, foreignKey: 'taskId', otherKey: 'pillarId' });
Pillar.belongsToMany(Task, { through: TaskPillar, foreignKey: 'pillarId', otherKey: 'taskId' });

// Ein erledigter Task hat höchstens einen Gamification-Score-Eintrag (1:1 über `taskId`, unique).
Task.hasOne(ScoreEntry, { foreignKey: 'taskId' });
ScoreEntry.belongsTo(Task, { foreignKey: 'taskId' });

// Ein Serien-Template (`Series`) hat 0..n generierte Instanzen — jede Instanz ist ein vollwertiger
// `Task` mit `seriesId` (siehe #120). Die Instanz ist entkoppelt: Template-Änderungen wirken nur auf
// künftige Instanzen, Instanz-Änderungen (gesetztes `isException`) nicht aufs Template.
Series.hasMany(Task, { foreignKey: 'seriesId' });
Task.belongsTo(Series, { foreignKey: 'seriesId' });

// Ein Serien-Template trägt eine Säulen-**Vorlage** (n:m, #302): 0..n Säulen mit `share`/`confidence`
// in `series_pillars`. Analog zu Task↔Pillar, aber auf der Template-Ebene (siehe seriesPillar.ts).
Series.belongsToMany(Pillar, { through: SeriesPillar, foreignKey: 'seriesId', otherKey: 'pillarId' });
Pillar.belongsToMany(Series, { through: SeriesPillar, foreignKey: 'pillarId', otherKey: 'seriesId' });

// `pillar_feedback` steht für sich (keine Assoziation) — es speichert lose Korrektur-Samples
// (Titel/Beschreibung + bestätigte Säulen) für den Feedback-Loop der Klassifikation (siehe #45).
// `users` steht für sich (E-Mail-/Passwort-Auth, Issue #206) — keine Assoziationen nötig.
// `push_subscriptions` steht für sich (Web-Push, Issue #355) — pro Nutzer über `userId` gefiltert,
// ohne Sequelize-Assoziation (der Versand-Helper filtert direkt über die `userId`-Spalte).
// `notification_logs` steht für sich (fachlicher Push-Trigger, Issue #355) — die Isolation läuft über
// den `dedupeKey` der jeweiligen Auslöser-Entität, keine Assoziation nötig.
export {
	Task,
	Dependency,
	Pillar,
	TaskPillar,
	PillarFeedback,
	ScoreEntry,
	Series,
	SeriesPillar,
	User,
	PushSubscription,
	NotificationLog,
};
