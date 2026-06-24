import Task from './task.js';
import Dependency from './dependency.js';
import Pillar from './pillar.js';
import TaskPillar from './taskPillar.js';
import PillarFeedback from './pillarFeedback.js';
import ScoreEntry from './scoreEntry.js';

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

// `pillar_feedback` steht für sich (keine Assoziation) — es speichert lose Korrektur-Samples
// (Titel/Beschreibung + bestätigte Säulen) für den Feedback-Loop der Klassifikation (siehe #45).
export { Task, Dependency, Pillar, TaskPillar, PillarFeedback, ScoreEntry };
