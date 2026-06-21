import express from 'express';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { pillarsRouter } from './routes/pillars.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import type { PillarClassifier } from '../llm/mistral.js';
import { buildTaskForest } from '../logics/tree.js';
import { findNextImportantTask } from '../logics/find.js';

const PORT = Number(process.env.PORT) || 3000;

type TaskTreeNodeDto = components['schemas']['TaskTreeNode'];
type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];

/** Injizierbare Abhängigkeiten — erlaubt es Tests, den Mistral-Aufruf zu mocken. */
export interface AppDeps {
	pillarClassifier?: PillarClassifier;
}

export const createApp = (deps: AppDeps = {}) => {
	const app = express();
	app.use(express.json());

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// Säulen-Routen: Gewichtung lesen/setzen (siehe routes/pillars.ts).
	app.use(pillarsRouter);

	// Mistral-gestützte Säulen-Klassifikation (siehe routes/suggestPillars.ts).
	app.use(createSuggestPillarsRouter(deps.pillarClassifier));

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
