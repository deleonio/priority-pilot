import Task from './task.js';
import Dependency from './dependency.js';
import Pillar from './pillar.js';
import TaskPillar from './taskPillar.js';

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

export { Task, Dependency, Pillar, TaskPillar };
