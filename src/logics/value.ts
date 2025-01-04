import { Task } from '../models/index.js';

export const calculateValueContribution = async (task: Task): Promise<number> => {
	const dependencies = await task.getDependents();
	let value = 0;
	for (const dependency of dependencies) {
		const dependencyValue = await calculateValueContribution(dependency);
		const weight = dependency.Dependency?.dataValues?.weight || 1;
		value += dependencyValue * weight;
	}
	return (value + task.priority) / (dependencies.length + 1);
};

export const calculateAllTaskValues = async (): Promise<void> => {
	// Alle Tasks abrufen, die offen oder in Bearbeitung sind
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
	});

	console.log('Wertschöpfung aller Tasks:');
	for (const task of tasks) {
		// Wertschöpfung für jeden Task berechnen
		const value = await calculateValueContribution(task);
		console.log(`Task: ${task.title}, Wertschöpfung: ${value.toFixed(1)}`);
	}
};
