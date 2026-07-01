import express from 'express';
import session from 'express-session';
import passport from 'passport';
import type { Store } from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { pillarsRouter } from './routes/pillars.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import { scoresRouter } from './routes/scores.js';
import { seriesRouter } from './routes/series.js';
import { authRouter } from './routes/auth.js';
import { transitRouter } from './routes/transit.js';
import type { PillarClassifier } from '../llm/mistral.js';
import { buildTaskForest } from '../logics/tree.js';
import { findNextImportantTask, findSuggestedTasks } from '../logics/find.js';
import { isEmailAllowed, getConfiguredEmails } from '../logics/allowedEmails.js';
import { requireAuth, getUserId } from './requireAuth.js';
import { User } from '../models/index.js';

const PORT = Number(process.env.PORT) || 3000;

type TaskTreeNodeDto = components['schemas']['TaskTreeNode'];
type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type HealthDto = components['schemas']['Health'];

/** Injizierbare Abhängigkeiten — erlaubt es Tests, den Mistral-Aufruf zu mocken. */
export interface AppDeps {
	pillarClassifier?: PillarClassifier;
	sessionStore?: Store;
}

export const createApp = (deps: AppDeps = {}) => {
	const app = express();
	app.set('trust proxy', 1);

	// JSON-Body parsen.
	app.use(express.json());

	// Session-Middleware (Store via AppDeps oder MemoryStore als Fallback).
	const sessionSecret = process.env.SESSION_SECRET;
	if (!sessionSecret && process.env.NODE_ENV === 'production') {
		throw new Error('SESSION_SECRET muss in Produktion gesetzt sein');
	}
	const rawTtl = process.env.SESSION_TTL ? parseInt(process.env.SESSION_TTL, 10) : undefined;
	const sessionMaxAge = rawTtl !== undefined && !isNaN(rawTtl) && rawTtl > 0 ? rawTtl * 1000 : undefined;
	app.use(
		session({
			secret: sessionSecret ?? 'dev-secret',
			store: deps.sessionStore,
			resave: false,
			saveUninitialized: false,
			cookie: {
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax' as const,
				httpOnly: true,
				...(sessionMaxAge !== undefined ? { maxAge: sessionMaxAge } : {}),
			},
		}),
	);

	// Passport initialisieren (ohne persistente Sessions — wir speichern den User in express-session).
	app.use(passport.initialize());

	// passport.authenticate() ruft nach Erfolg intern req.logIn() auf, was serializeUser/deserializeUser
	// voraussetzt — sonst wirft Passport "Failed to serialize user into session". Da der eigentliche
	// User-State manuell in req.session.user gehalten wird (s. routes/auth.ts), genügt ein Passthrough.
	passport.serializeUser((user, done) => done(null, user));
	passport.deserializeUser((user: Express.User, done) => done(null, user));

	// Google-OAuth-Strategie nur registrieren, wenn Credentials vorhanden.
	const clientID = process.env.GOOGLE_CLIENT_ID ?? '';
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
	const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:5173/auth/google/callback';

	// In Produktion muss die Allowlist gesetzt sein — getConfiguredEmails() wirft sonst.
	if (process.env.NODE_ENV === 'production') {
		getConfiguredEmails();
	}

	if (clientID && clientSecret) {
		// Einschränkung: `passport` ist ein Modul-Singleton. Mehrere createApp()-Aufrufe
		// im selben Prozess überschreiben diese globale Strategie gegenseitig — daher wird
		// pro Prozess nur eine App-Konfiguration unterstützt (ausreichend für unser Multi-User-Gate).
		passport.use(
			new GoogleStrategy(
				{ clientID, clientSecret, callbackURL },
				async (_accessToken, _refreshToken, profile, done) => {
					try {
						const email = (profile.emails?.[0]?.value ?? '').trim().toLowerCase();
						if (!isEmailAllowed(email)) {
							return done(null, false);
						}
						const displayName = profile.displayName ?? email;
						const avatarUrl = (profile.photos?.[0]?.value ?? null) as string | null;
						// OAuth-Nutzer haben kein Passwort — Sentinel verhindert bcrypt-Login über die /auth/login-Route.
						const [user, created] = await User.findOrCreate({
							where: { email },
							defaults: { email, passwordHash: '__oauth__', displayName, avatarUrl },
						});
						if (!created && user.avatarUrl !== avatarUrl) {
							await user.update({ avatarUrl });
						}
						return done(null, { id: user.id, email, displayName, avatarUrl });
					} catch (err) {
						return done(err as Error);
					}
				},
			),
		);
	}

	// Auth-Routen (öffentlich).
	app.use(authRouter);

	// GET /health — billiger Liveness-Check (ohne DB) für Post-Deploy & Monitoring.
	app.get('/health', (_req, res: express.Response<HealthDto>) => {
		res.json({ status: 'ok' });
	});

	// Öffentlicher CORS-Proxy für Transitous/MOTIS (Issue #224) — bewusst ohne requireAuth.
	app.use('/api/transit', transitRouter);

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

	// GET /forest — Aufgabenwald nach Wertschöpfung sortiert (auf den eingeloggten Nutzer gefiltert).
	app.get('/forest', async (req, res: express.Response<TaskTreeNodeDto[] | ErrorDto>) => {
		try {
			res.json(await buildTaskForest(getUserId(req)));
		} catch {
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	// GET /next — nächsten wichtigen Task ermitteln (oder null) — auf den eingeloggten Nutzer gefiltert.
	app.get('/next', async (req, res: express.Response<TaskDto | null | ErrorDto>) => {
		try {
			const task = await findNextImportantTask(getUserId(req));
			res.json(task ? serializeTask(task) : null);
		} catch {
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	// GET /suggestions — „Was ist jetzt dran?"-Vorschlagsliste (sortiert, post-gefiltert).
	app.get('/suggestions', async (req, res: express.Response<TaskDto[] | ErrorDto>) => {
		try {
			const tasks = await findSuggestedTasks(getUserId(req));
			res.json(tasks.map(serializeTask));
		} catch {
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	return app;
};

export const launchServer = async () => {
	const { createSessionStore } = await import('./session.js');
	const sessionStore = await createSessionStore();
	const app = createApp({ sessionStore });
	app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
};
