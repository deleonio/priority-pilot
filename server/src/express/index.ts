import express from 'express';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { buildTaskForest } from '../logics/tree.js';
import { findNextImportantTask } from '../logics/find.js';

const PORT = Number(process.env.PORT) || 3000;

type TaskTreeNodeDto = components['schemas']['TaskTreeNode'];
type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];

export const createApp = () => {
	const app = express();
	app.use(express.json());

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// GET /forest — Aufgabenwald nach Wertschöpfung sortiert.
	app.get('/forest', async (_req, res: express.Response<TaskTreeNodeDto[] | ErrorDto>) => {
		try {
			res.json(await buildTaskForest());
		} catch {
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	// GET /next — nächsten wichtigen Task ermitteln (oder null).
	app.get('/next', async (_req, res: express.Response<TaskDto | null | ErrorDto>) => {
		try {
			const task = await findNextImportantTask();
			res.json(task ? serializeTask(task) : null);
		} catch {
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	return app;
};

export const launchServer = async () => {
	const app = createApp();
	app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
};
