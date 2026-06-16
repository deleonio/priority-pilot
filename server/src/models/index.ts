import Task from './task.js';
import Dependency from './dependency.js';
import Pillar from './pillar.js';

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

// Jeder Task gehört zu höchstens einer Säule (1:1-Annahme, FK nullable).
Task.belongsTo(Pillar, { foreignKey: 'pillarId' });
Pillar.hasMany(Task, { foreignKey: 'pillarId' });

export { Task, Dependency, Pillar };
