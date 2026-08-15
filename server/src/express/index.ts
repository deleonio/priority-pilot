import express from 'express';
import session from 'express-session';
import passport from 'passport';
import type { Store } from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { components } from '../api';
import { tasksRouter, serializeTask } from './routes/tasks.js';
import { pillarsRouter } from './routes/pillars.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import { createParseTasksRouter } from './routes/parseTasks.js';
import { createPillarAdvisorRouter } from './routes/pillarAdvisor.js';
import { scoresRouter } from './routes/scores.js';
import { seriesRouter } from './routes/series.js';
import { authRouter } from './routes/auth.js';
import { transitRouter } from './routes/transit.js';
import { createPushRouter } from './routes/push.js';
import { llmConfigRouter } from './routes/llmConfig.js';
import { lektoratRouter } from './routes/lektorat.js';
import { handleServerError } from './server-error-handler.js';
import type { PillarClassifier, ParseTaskParser, ActivityAdvisor } from '../llm/llm.js';
import type { PushSender } from '../logics/push.js';
import { buildTaskForest } from '../logics/tree.js';
import { findNextImportantTask, findSuggestedTasks } from '../logics/find.js';
import { isEmailAllowed, getConfiguredEmails } from '../logics/allowedEmails.js';
import { requireAuth, getUserId, hasGoogleOAuth } from './requireAuth.js';
import { User } from '../models/index.js';

type TaskTreeNodeDto = components['schemas']['TaskTreeNode'];
type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type HealthDto = components['schemas']['Health'];

/** Injizierbare Abhängigkeiten — erlaubt es Tests, den Mistral-Aufruf zu mocken. */
export interface AppDeps {
	pillarClassifier?: PillarClassifier;
	taskTextParser?: ParseTaskParser;
	activityAdvisor?: ActivityAdvisor;
	sessionStore?: Store;
	pushSender?: PushSender;
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
	// Verbindlicher Code-Default: ohne SESSION_TTL lebt die Session 7 Tage (Issue #396 PR A). Ein
	// reines Session-Cookie (früher: maxAge undefined) verfällt beim Browser-Schließen und erzwingt
	// bei jedem Neustart ein erneutes Login — das „immer neu einloggen" aus #396.
	const SEVEN_DAYS_MS = 604800 * 1000;
	const rawTtl = process.env.SESSION_TTL ? parseInt(process.env.SESSION_TTL, 10) : undefined;
	const sessionMaxAge = rawTtl !== undefined && !isNaN(rawTtl) && rawTtl > 0 ? rawTtl * 1000 : SEVEN_DAYS_MS;

	// express-session 1.19 überträgt die Cookie-Laufzeit nur als `Expires`, nicht als `Max-Age`: sein
	// interner data-Getter liefert `originalMaxAge`, doch die `cookie`-Bibliothek ignoriert dieses Feld
	// und erwartet `maxAge` → der Browser sieht nur `Expires`. `Max-Age` ist jedoch das robustere Attribut
	// (unabhängig von einer abweichenden lokalen Uhr) und wird vom Spec-Test (Issue #396 PR A, AK1b)
	// eingefordert. Wir ergänzen es daher auf dem Session-Cookie. Bewusst VOR session() registriert:
	// express-session nutzt intern `on-headers`, das writeHead-Wrapper in umgekehrter Registrierungs-
	// reihenfolge ausführt — dadurch läuft dieses Rewrite ZUVERLÄSSIG erst, nachdem express-session den
	// Cookie gesetzt hat (und nicht vorher, wo er noch fehlen würde).
	const SESSION_MAX_AGE_SECONDS = Math.round(sessionMaxAge / 1000);
	app.use((_req, res, next) => {
		const rewriteSessionCookieMaxAge = (): void => {
			const cookies = res.getHeader('set-cookie');
			if (cookies === undefined) return;
			const list = Array.isArray(cookies) ? cookies : [String(cookies)];
			const patched = list.map((raw) => {
				const value = String(raw);
				if (/max-age=/i.test(value) || !/expires=/i.test(value)) return value;
				return `${value.replace(/;\s*$/, '')}; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
			});
			res.setHeader('set-cookie', patched);
		};
		const originalWriteHead = res.writeHead.bind(res) as typeof res.writeHead;
		res.writeHead = ((...args: Parameters<typeof originalWriteHead>) => {
			rewriteSessionCookieMaxAge();
			return originalWriteHead(...args);
		}) as typeof res.writeHead;
		next();
	});

	app.use(
		session({
			secret: sessionSecret ?? 'dev-secret',
			store: deps.sessionStore,
			resave: false,
			saveUninitialized: false,
			// rolling: Jede authentifizierte Antwort sendet ein aktualisiertes Set-Cookie mit voller
			// Laufzeit → die Session verlängert sich bei Aktivität statt beim ersten Login einzufrieren.
			rolling: true,
			cookie: {
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax' as const,
				httpOnly: true,
				maxAge: sessionMaxAge,
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
	const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/google/callback';

	// In Produktion muss die Allowlist gesetzt sein — getConfiguredEmails() wirft sonst.
	if (process.env.NODE_ENV === 'production') {
		getConfiguredEmails();
	}

	// Registrierungs-Bedingung teilt sich dasselbe kanonische Prädikat wie der Route-Guard in
	// routes/auth.ts (hasGoogleOAuth), damit Sender und Empfänger nie auseinanderlaufen können.
	if (hasGoogleOAuth()) {
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

	// Lektorat-Endpunkt (Issue #680) — triggert die bezahlte LLM-Kaskade, daher Session-Pflicht
	// (Mensch-Entscheidung im Review von PR #682: kein öffentlicher DOS-/Kostenhebel).
	app.use(lektoratRouter());

	// Task-CRUD- & Dependency-Routen (siehe routes/tasks.ts).
	app.use(tasksRouter);

	// Säulen-Routen: Gewichtung lesen/setzen (siehe routes/pillars.ts).
	app.use(pillarsRouter);

	// Mistral-gestützte Säulen-Klassifikation (siehe routes/suggestPillars.ts).
	app.use(createSuggestPillarsRouter(deps.pillarClassifier));

	// Mistral-gestützte Task-Schnellerfassung: Freitext → strukturierte Felder (siehe routes/parseTasks.ts).
	app.use(createParseTasksRouter(deps.taskTextParser));

	// Mistral-gestützter Aktivitäten-Berater: welche Aktivitäten zahlen auf welche Säulen ein
	// (siehe routes/pillarAdvisor.ts).
	app.use(createPillarAdvisorRouter(deps.activityAdvisor));

	// Gamification-Scoring: Punkte je Task lesen, Balance-Stand je Säule (siehe routes/scores.ts).
	app.use(scoresRouter);

	// Serienaufgaben (Habits): Template-CRUD + Instanz-Generierung (siehe routes/series.ts).
	app.use(seriesRouter);

	// Web-Push: Subscription an-/abmelden + öffentlichen VAPID-Schlüssel ausliefern (siehe routes/push.ts).
	// Bewusst kein client-aufrufbarer „send"-Endpunkt — der Versand läuft server-intern (logics/push.ts).
	app.use(createPushRouter(deps.pushSender));

	// LLM-Provider-Konfiguration (#640): Keys/Modell der Mistral/OpenRouter-Kaskade lesen/speichern.
	app.use(llmConfigRouter);

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
	// PORT zur Aufruf-Zeit lesen (nicht schon beim Modul-Import) — sonst ließe sich der Port
	// aus Tests/Umgebungen nicht mehr steuern, in denen process.env.PORT erst nach dem Import gesetzt wird.
	const port = Number(process.env.PORT) || 3000;
	const { createSessionStore } = await import('./session.js');
	const sessionStore = await createSessionStore();
	const app = createApp({ sessionStore });
	const server = app.listen(port, () => console.log(`Server läuft auf http://localhost:${port}`));

	// AK4 — Error-Callback für app.listen (z.B. EADDRINUSE bei belegtem Port).
	// Behandlung in server-error-handler.ts, damit der Spec-Test die Funktion direkt aufrufen kann,
	// ohne express/index.ts (und damit src/logics) importieren zu müssen.
	server.on('error', (error: NodeJS.ErrnoException) => handleServerError(error, port));
};
