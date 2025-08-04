import Task from './task.js';
import Dependency from './dependency.js';

/**
 * Definiert die Beziehungen zwischen den Modellen.
 * Tasks können gegenseitige Abhängigkeiten haben, die über die
 * Zwischentabelle `Dependency` abgebildet werden.
 */

// Abhängigkeiten: Task A hängt von Task B ab
Task.belongsToMany(Task, {
	as: 'dependencies',
	through: Dependency,
	foreignKey: 'dependentTaskId',
	otherKey: 'dependingTaskId',
});

// Umkehrrelation: auf welche Tasks wirkt sich dieser Task aus
Task.belongsToMany(Task, {
	as: 'dependents',
	through: Dependency,
	foreignKey: 'dependingTaskId',
	otherKey: 'dependentTaskId',
});

export { Task, Dependency };
