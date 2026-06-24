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
type HealthDto = components['schemas']['Health'];

/** Injizierbare Abhängigkeiten — erlaubt es Tests, den Mistral-Aufruf zu mocken. */
export interface AppDeps {
	pillarClassifier?: PillarClassifier;
}

export const createApp = (deps: AppDeps = {}) => {
	const app = express();

	// JSON-Body parsen, aber einen Parse-Fehler (malformed JSON) **nicht** an Express'
	// Default-Handler (HTML) durchreichen, sondern dem Fehler-Vertrag entsprechend als
	// `{ message }` beantworten — sonst erhielte das Frontend bei kaputtem Body eine nicht
	// anzeigbare HTML-Seite (Issue #117: alle Fehlerfälle liefern eine anzeigbare Meldung).
	const jsonParser = express.json();
	app.use((req, res, next) => {
		jsonParser(req, res, (err: unknown) => {
			if (err) {
				const body: ErrorDto = { message: 'Ungültiger JSON-Body.' };
				res.status(400).json(body);
				return;
			}
			next();
		});
	});

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// Säulen-Routen: Gewichtung lesen/setzen (siehe routes/pillars.ts).
	app.use(pillarsRouter);

	// Mistral-gestützte Säulen-Klassifikation (siehe routes/suggestPillars.ts).
	app.use(createSuggestPillarsRouter(deps.pillarClassifier));

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

	// Unbekannte Route → 404 mit Fehler-Vertrag statt Express' Default-HTML, damit auch dieser
	// Fehlerfall im Frontend anzeigbar ist (Issue #117).
	app.use((_req, res: express.Response<ErrorDto>) => {
		res.status(404).json({ message: 'Ressource nicht gefunden.' });
	});

	return app;
};

export const launchServer = async () => {
	const app = createApp();
	app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
};
