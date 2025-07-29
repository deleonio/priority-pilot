import express from 'express';
import { Task } from '../models/index.js';
import { calculateValueContribution } from '../logics/value.js';

const checkForCycle = async (dependentTask: Task, newDependency: Task): Promise<boolean> => {
	if (dependentTask.id === newDependency.id) {
		return true;
	}
	const dependencies = await newDependency.getDependencies();
	for (const dependency of dependencies) {
		if (await checkForCycle(dependentTask, dependency)) {
			return true;
		}
	}
	return false;
};

export const launchServer = async () => {
	const app = express();
	app.use(express.json());

	app.get('/tasks', async (_req, res) => {
		const tasks = await Task.findAll();
		res.json(tasks);
	});

	app.post('/tasks', async (req, res) => {
		const task = await Task.create(req.body);
		res.status(201).json(task);
	});

	app.put('/tasks/:id', async (req, res) => {
		const task = await Task.findByPk(req.params.id);
		if (!task) return res.sendStatus(404);
		await task.update(req.body);
		res.json(task);
	});

	app.delete('/tasks/:id', async (req, res) => {
		const task = await Task.findByPk(req.params.id);
		if (!task) return res.sendStatus(404);
		await task.destroy();
		res.sendStatus(204);
	});

	app.post('/tasks/:id/dependencies', async (req, res) => {
		const { dependencyId } = req.body;
		const dependentTask = await Task.findByPk(req.params.id);
		const dependencyTask = await Task.findByPk(dependencyId);
		if (!dependentTask || !dependencyTask) return res.sendStatus(404);
		const hasCycle = await checkForCycle(dependentTask, dependencyTask);
		if (hasCycle) return res.status(400).json({ message: 'Cycle detected' });
		await dependentTask.addDependency(dependencyTask, { through: { weight: 1 } });
		res.sendStatus(204);
	});

	app.delete('/tasks/:id/dependencies/:dependencyId', async (req, res) => {
		const dependentTask = await Task.findByPk(req.params.id);
		const dependencyTask = await Task.findByPk(req.params.dependencyId);
		if (!dependentTask || !dependencyTask) return res.sendStatus(404);
		await dependentTask.removeDependency(dependencyTask);
		res.sendStatus(204);
	});

	app.get('/tasks/top', async (_req, res) => {
		const tasks = await Task.findAll({
			where: { status: ['Open', 'In process'] },
		});
		const tasksWithValues: any[] = [];
		for (const task of tasks) {
			const value = await calculateValueContribution(task);
			const dependents = await task.getDependents();
			let totalTime = task.estimatedEffort;
			for (const dependent of dependents) {
				totalTime += dependent.estimatedEffort;
			}
			tasksWithValues.push({ ...task.toJSON(), value, totalTime });
		}
		tasksWithValues.sort((a, b) => b.value - a.value);
		res.json(tasksWithValues.slice(0, 5));
	});

	app.listen(8080, () => console.log('Server läuft auf http://localhost:8080'));
};
