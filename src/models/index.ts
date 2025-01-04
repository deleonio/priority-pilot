import Task from './task.js';
import Dependency from './dependency.js';

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

export { Task, Dependency };
