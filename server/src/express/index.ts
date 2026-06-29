import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request, Response, NextFunction } from 'express';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { pillarsRouter } from './routes/pillars.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import { scoresRouter } from './routes/scores.js';
import { seriesRouter } from './routes/series.js';
import { authRouter } from './routes/auth.js';
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

/** Middleware: Anfrage ohne gültige Session abweisen.
 * Nur aktiv wenn GOOGLE_ALLOWED_EMAIL gesetzt ist — ohne Konfiguration kein Gate. */
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
	if (!process.env.GOOGLE_ALLOWED_EMAIL) {
		next();
		return;
	}
	const user = (req.session as { user?: unknown }).user;
	if (!user) {
		res.status(401).json({ message: 'Nicht eingeloggt.' });
		return;
	}
	next();
};

export const createApp = (deps: AppDeps = {}) => {
	const app = express();
	app.set('trust proxy', 1);

	// JSON-Body parsen.
	app.use(express.json());

	// Session-Middleware (In-Memory-Store — für Single-User-Gate ausreichend).
	const sessionSecret = process.env.SESSION_SECRET;
	if (!sessionSecret && process.env.NODE_ENV === 'production') {
		throw new Error('SESSION_SECRET muss in Produktion gesetzt sein');
	}
	app.use(
		session({
			secret: sessionSecret ?? 'dev-secret',
			resave: false,
			saveUninitialized: false,
			cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const },
		}),
	);

	// Passport initialisieren (ohne persistente Sessions — wir speichern den User in express-session).
	app.use(passport.initialize());

	// Google-OAuth-Strategie nur registrieren, wenn Credentials vorhanden.
	const clientID = process.env.GOOGLE_CLIENT_ID ?? '';
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
	const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/google/callback';
	const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL ?? '';

	if (!allowedEmail && process.env.NODE_ENV === 'production') {
		throw new Error('GOOGLE_ALLOWED_EMAIL muss in Produktion gesetzt sein');
	}

	if (clientID && clientSecret) {
		passport.use(
			new GoogleStrategy({ clientID, clientSecret, callbackURL }, (_accessToken, _refreshToken, profile, done) => {
				const email = (profile.emails?.[0]?.value ?? '').trim().toLowerCase();
				if (email !== allowedEmail.trim().toLowerCase()) {
					return done(null, false);
				}
				const displayName = profile.displayName ?? email;
				return done(null, { email, displayName });
			}),
		);
	}

	// Auth-Routen (öffentlich).
	app.use(authRouter);

	// GET /health — billiger Liveness-Check (ohne DB) für Post-Deploy & Monitoring.
	app.get('/health', (_req, res: express.Response<HealthDto>) => {
		res.json({ status: 'ok' });
	});

	// Alle folgenden Routen benötigen eine gültige Session.
	app.use(requireAuth);

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// Säulen-Routen: Gewichtung lesen/setzen (siehe routes/pillars.ts).
	app.use(pillarsRouter);

	// Mistral-gestützte Säulen-Klassifikation (siehe routes/suggestPillars.ts).
	app.use(createSuggestPillarsRouter(deps.pillarClassifier));

	// Gamification-Scoring: Punkte je Task lesen, Balance-Stand je Säule (siehe routes/scores.ts).
	app.use(scoresRouter);

	// Serienaufgaben (Habits): Template-CRUD + Instanz-Generierung (siehe routes/series.ts).
	app.use(seriesRouter);

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
