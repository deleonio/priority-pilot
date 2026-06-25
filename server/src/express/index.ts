import express from 'express';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { pillarsRouter } from './routes/pillars.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import { scoresRouter } from './routes/scores.js';
import { seriesRouter } from './routes/series.js';
import type { PillarClassifier } from '../llm/mistral.js';
import { buildTaskForest } from '../logics/tree.js';
import { findNextImportantTask, findSuggestedTasks } from '../logics/find.js';

const PORT = Number(process.env.PORT) || 3000;

type TaskTreeNodeDto = components['schemas']['TaskTreeNode'];
type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type HealthDto = components['schemas']['Health'];

/** Injizierbare Abhängigkeiten — erlaubt es Tests, den Mistral-Aufruf zu mocken. */
export interface AppDeps {
	pillarClassifier?: PillarClassifier;
}

export const createApp = (deps: AppDeps = {}) => {
	const app = express();

	// JSON-Body parsen.
	app.use(express.json());

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// Säulen-Routen: Gewichtung lesen/setzen (siehe routes/pillars.ts).
	app.use(pillarsRouter);

	// Mistral-gestützte Säulen-Klassifikation (siehe routes/suggestPillars.ts).
	app.use(createSuggestPillarsRouter(deps.pillarClassifier));

	// Gamification-Scoring: Punkte je Task lesen, Balance-Stand je Säule (siehe routes/scores.ts).
	app.use(scoresRouter);

	// Serienaufgaben: Vorlagen-CRUD + Generieren fälliger Instanzen (siehe routes/series.ts).
	app.use(seriesRouter);

	// GET /health — billiger Liveness-Check (ohne DB) für Post-Deploy & Monitoring.
	app.get('/health', (_req, res: express.Response<HealthDto>) => {
		res.json({ status: 'ok' });
	});

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

	// GET /suggestions — „Was ist jetzt dran?"-Vorschlagsliste (sortiert, post-gefiltert).
	app.get('/suggestions', async (_req, res: express.Response<TaskDto[] | ErrorDto>) => {
		try {
			const tasks = await findSuggestedTasks();
			res.json(tasks.map(serializeTask));
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
