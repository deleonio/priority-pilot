import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { UniqueConstraintError } from 'sequelize';
import { isEmailAllowed } from '../../logics/allowedEmails.js';
import sequelize from '../../database.js';
import { Pillar, Subscription, User } from '../../models/index.js';
import type { UserRole } from '../../models/user.js';
import { SEED_PILLARS } from '../../models/pillarData.js';
import { hashPassword, verifyPassword, resolveRole } from '../../logics/auth.js';
import { getEntitlements, type Plan } from '../../logics/plans.js';
import { applyDuePendingPlan, applyDueGracePeriod, GRACE_PERIOD_DAYS } from '../../logics/paypal.js';
import { sanitizeReturnPath } from '../../logics/silentReturnPath.js';
import { consumeLoginToken, createNativeLoginCode, nativeLoginToken } from '../../logics/magicLink.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import { deleteAccount } from '../../logics/deleteAccount.js';
import { sendError } from '../http-error.js';
import { hasGoogleOAuth, isAuthActive } from '../requireAuth.js';
import { establishSession } from '../establishSession.js';
import { getAiUsageCount } from '../aiQuotaMeter.js';
import { THROTTLED_MESSAGE } from './rateLimit.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Timing-Normalisierung: bei unbekannter E-Mail bcrypt-Vergleich simulieren,
// damit Angreifer per Zeitmessung keine gültigen Adressen ermitteln können.
const DUMMY_HASH = await hashPassword('__dummy__');

const authRouter = Router();

// Rate-Limit gegen Brute-Force auf Login/Register/OAuth (CodeQL js/missing-rate-limiting), nach
// dem Muster des Transit-Limiters. Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
const authLimiter = rateLimit({
	windowMs: 60_000,
	max: 30,
	standardHeaders: true,
	legacyHeaders: false,
	// Antwortkörper nach dem Fehlervertrag, identisch zum CRUD-Limiter (#1479).
	message: THROTTLED_MESSAGE,
	skip: () => process.env.NODE_ENV !== 'production',
});
// Der Pfad `/auth` ist Pflicht (#1479): Dieser Router hängt per `app.use(authRouter)` an der Wurzel
// und steht vor allen anderen Routern. Pfadlos registriert lief der Limiter deshalb für JEDE
// Anfrage mit und deckelte die gesamte API auf 30 Anfragen pro Minute und IP — ein Seitenaufbau
// kostet 14, ein Löschen weitere 7, entsprechend kam kurz nach dem Löschen auf alles ein 429.
authRouter.use('/auth', authLimiter);

// POST /auth/register — E-Mail-/Passwort-Registrierung (Issue #206, AK 1).
// Legt einen neuen User an (409 bei bereits vergebener E-Mail), meldet ihn direkt
// per frisch regenerierter Session an und antwortet mit 201.
authRouter.post('/auth/register', async (req, res) => {
	const { email, password } = req.body as { email?: string; password?: string };
	if (!email || !password || !password.trim()) {
		res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich.' });
		return;
	}
	if (password.trim().length < 8 || password.length > 72) {
		res.status(400).json({ message: 'Passwort muss 8–72 Zeichen lang sein.' });
		return;
	}
	const normalizedEmail = email.trim().toLowerCase();

	const existing = await User.findOne({ where: { email: normalizedEmail } });
	if (existing) {
		res.status(409).json({ message: 'E-Mail ist bereits registriert.' });
		return;
	}

	const passwordHash = await hashPassword(password);
	let created: User;
	try {
		created = await sequelize.transaction(async (t) => {
			const user = await User.create(
				{ email: normalizedEmail, passwordHash, displayName: normalizedEmail, role: resolveRole(normalizedEmail) },
				{ transaction: t },
			);
			// Säulen pro Nutzer (#421, AK4): dem frisch angelegten Nutzer seine eigenen fünf Standard-Säulen
			// säen (je 20 %). Atomisch mit User.create — kein halbfertiger Account möglich.
			await Pillar.bulkCreate(
				SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight, userId: user.id })),
				{ transaction: t },
			);
			return user;
		});
	} catch (err) {
		// Race Condition: zwei parallele Registrierungen passieren beide den findOne-Check
		// (beide null). Die DB-Unique-Constraint fängt den Konflikt ab → 409 statt 500.
		if (err instanceof UniqueConstraintError) {
			res.status(409).json({ message: 'E-Mail ist bereits registriert.' });
			return;
		}
		throw err;
	}

	// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
	req.session.regenerate((err) => {
		if (err) {
			res.status(500).json({ message: 'Session-Fehler.' });
			return;
		}
		req.session.user = {
			id: created.id,
			email: normalizedEmail,
			displayName: normalizedEmail,
			avatarUrl: null,
			role: created.role,
			// #1456: Paket wie die Rolle eager in den Snapshot — sonst sieht ein Guard, der
			// `req.session.user.plan` direkt liest, bis zum ersten `/auth/me` `undefined`.
			plan: created.plan,
		};
		req.session.save((saveErr) => {
			if (saveErr) {
				res.status(500).json({ message: 'Session konnte nicht gespeichert werden.' });
				return;
			}
			res.status(201).json({ email: normalizedEmail, displayName: normalizedEmail });
		});
	});
});

// POST /auth/login — E-Mail-/Passwort-Login (Issue #206, AK 2).
// 401 bei unbekannter E-Mail oder falschem Passwort (kein Unterschied nach außen,
// um E-Mail-Enumeration zu vermeiden). Bei Erfolg frische Session + 200.
authRouter.post('/auth/login', async (req, res) => {
	const { email, password } = req.body as { email?: string; password?: string };
	if (!email || !password || !password.trim()) {
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}
	const normalizedEmail = email.trim().toLowerCase();

	const user = await User.findOne({ where: { email: normalizedEmail } });
	if (!user) {
		await verifyPassword(password, DUMMY_HASH); // Timing normalisieren — verhindert E-Mail-Enumeration
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}

	const passwordOk = await verifyPassword(password, user.passwordHash);
	if (!passwordOk) {
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}

	// Rollensystem admin/member: ADMIN_EMAILS bei jedem Login neu abgleichen (nur Beförderung).
	const effectiveRole = resolveRole(normalizedEmail, user.role);
	if (effectiveRole !== user.role) {
		await user.update({ role: effectiveRole });
	}
	const sessionUser = {
		id: user.id,
		email: user.email,
		displayName: user.displayName,
		avatarUrl: null,
		role: effectiveRole,
		// #1456: Paket wie die Rolle eager in den Snapshot — sonst sieht ein Guard, der
		// `req.session.user.plan` direkt liest, bis zum ersten `/auth/me` `undefined`.
		plan: user.plan,
	};
	// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
	req.session.regenerate((err) => {
		if (err) {
			res.status(500).json({ message: 'Session-Fehler.' });
			return;
		}
		req.session.user = sessionUser;
		req.session.save((saveErr) => {
			if (saveErr) {
				res.status(500).json({ message: 'Session konnte nicht gespeichert werden.' });
				return;
			}
			res.status(200).json(sessionUser);
		});
	});
});

// Die App liegt unter /app/, die Wurzel gehört der öffentlichen Website (ADR 0015). Alle
// Login-Redirects zielen deshalb auf die App-Wurzel, nicht auf „/".
const APP_ROOT = '/app/';

// ADR 0015 Punkt 4: Lesbares Merk-Cookie „angemeldet", mit dem die statische Startseite angemeldete
// Nutzer vor dem ersten Rendern in die App schickt (`SIGNED_IN_REDIRECT` in website/src/render.ts).
// Es trägt nur „1", die Session selbst bleibt httpOnly. `/auth/me` läuft bei jedem App-Start und hält
// es damit im Takt der rollenden Session; 401 und Logout löschen es.
const SIGNED_IN_COOKIE = 'bm_signed_in';
const signedInCookieOptions = { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } as const;

// GET /auth/error — Ziel des OAuth-failureRedirect, liefert eindeutiges Fehler-Feedback statt SPA-Fallback/404.
authRouter.get('/auth/error', (_req, res) => {
	res.status(400).json({ error: 'Login fehlgeschlagen. Bitte prüfe deine Zugangsberechtigung.' });
});

// Guard: passport.authenticate('google') darf nur laufen, wenn die 'google'-Strategie registriert
// wurde. Ohne Client-Credentials ist sie das nicht (siehe express/index.ts) — dann würde Passport
// synchron "Unknown authentication strategy 'google'" werfen (ungefangener 500). Dasselbe kanonische
// Prädikat (hasGoogleOAuth) steuert Registrierung UND Guard, sodass beide nie auseinanderlaufen.
const requireGoogleStrategy: RequestHandler = (_req, res, next) => {
	if (!hasGoogleOAuth()) {
		res.status(503).json({ error: 'Google-OAuth ist nicht konfiguriert.' });
		return;
	}
	next();
};

// Zufallswert der App für den nativen Login (ADR 0016), Alphabet wie base64url.
const NATIVE_STATE = /^[\w-]{16,128}$/;

// GET /auth/google — startet den OAuth-Flow. `?client=app&state=…` markiert den Login aus der nativen
// App (ADR 0016): Er läuft im System-Browser, dessen Session der WebView der App nicht teilt. Der
// Einmal-Code wird an `state` gebunden, den nur die startende App kennt — ein fremder, per Link
// untergeschobener Code lässt sich so nicht in der App einlösen (Login-CSRF).
authRouter.get('/auth/google', requireGoogleStrategy, (req, res, next) => {
	delete req.session.nativeState;
	if (req.query.client === 'app') {
		if (typeof req.query.state !== 'string' || !NATIVE_STATE.test(req.query.state)) {
			sendError(res, 400, 'state fehlt oder ist ungültig.');
			return;
		}
		req.session.nativeState = req.query.state;
	}
	passport.authenticate('google', { scope: ['email', 'profile'] })(req, res, next);
});

// GET /auth/google/silent — stiller Google-Login via prompt=none (Issue #396 PR B).
// Ein Nutzer mit gültiger Google-Session wird so ohne eigenen Klick angemeldet. Ist kein OAuth
// konfiguriert, ist ein stiller Login nicht möglich → Weiterleitung auf die manuelle Login-Seite
// (/?silent=unavailable). Der Session-Marker `silentPending` signalisiert dem gemeinsamen Callback,
// einen Interaktionsfehler (login_required u. ä.) ebenfalls als „silent unavailable" zu behandeln.
authRouter.get('/auth/google/silent', (req, res, next) => {
	if (!hasGoogleOAuth()) {
		res.redirect(`${APP_ROOT}?silent=unavailable`);
		return;
	}
	req.session.silentPending = true;
	// Der stille Login ist immer Web-Kontext: ein Vermerk aus einem abgebrochenen App-Login (#1669)
	// darf ihn nicht auf den App Link umleiten.
	delete req.session.nativeState;
	// #1231: Route, von der der stille Login angestoßen wurde, aufnehmen — der Erfolgs-Callback
	// leitet darauf zurück statt fix auf „/". Sanitisiert (Open-Redirect-Schutz); ungültig/fehlend
	// → kein Return-Path.
	const returnTo = sanitizeReturnPath(req.query.returnTo);
	if (returnTo !== null) {
		req.session.silentReturnTo = returnTo;
	}
	passport.authenticate('google', { scope: ['email', 'profile'], prompt: 'none' })(req, res, next);
});

// GET /auth/google/callback — Google leitet nach Authentifizierung hierher zurück. Der gemeinsame
// Callback bedient den normalen UND den stillen OAuth-Einstieg (Issue #396 PR B): war der Auslöser
// ein stiller Versuch (Session-Marker `silentPending`), leiten Interaktionsfehler auf
// /?silent=unavailable weiter, damit das Frontend die manuelle Login-Seite zeigt.
// Issue #1136: Der MANUELLE Pfad adressiert die Frontend-Fehler-Weiche /?error=<code> statt der
// rohen JSON-Route /auth/error — LoginPage rendert dafür bereits eine Meldung (Fallback für
// unbekannte Codes). /auth/error bleibt als API-Fallback erhalten.
authRouter.get('/auth/google/callback', requireGoogleStrategy, (req, res, next) => {
	const silentPending = req.session?.silentPending === true;
	// Issue #1136: Ein Callback-Hit ohne Google-`code` ist kein gültiger OAuth-Abschluss —
	// Passport würde hier erneut einen Authorization-Redirect starten (ungenutzer Loop). Google
	// liefert einen Ablehnungsgrund als `error`-Parameter (z. B. `access_denied`); dieser Code wird
	// 1:1 an die Frontend-Fehler-Weiche durchgereicht, sonst `login_failed` als Sammelcode.
	if (!req.query.code) {
		const code = typeof req.query.error === 'string' && req.query.error !== '' ? req.query.error : 'login_failed';
		res.redirect(silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=${encodeURIComponent(code)}`);
		return;
	}
	// Eigene Callback-Signatur statt `failureRedirect`-Option: `failureRedirect` greift nur bei
	// Ablehnung (`done(null, false)`), NICHT bei technischen Fehlern (`done(err)`) — die liefen sonst
	// über `next(err)` an Express' Default-Error-Handler (rohe 500-Seite statt Redirect ins Frontend,
	// keine Session gesetzt). Mit eigenem Callback fangen wir beide Fälle einheitlich ab.
	passport.authenticate(
		'google',
		(
			err: Error | null,
			user:
				| { id: number; email: string; displayName: string; avatarUrl?: string | null; role: UserRole; plan: Plan }
				| false,
		) => {
			if (err) {
				console.error('Google-OAuth-Callback fehlgeschlagen:', err);
			}
			if (err || !user) {
				// Marker löschen: sonst landet nach einem gescheiterten stillen Login auch der nächste
				// manuelle Login-Fehler fälschlich auf /?silent=unavailable statt /?error=login_failed.
				if (req.session?.silentPending) {
					delete req.session.silentPending;
				}
				if (req.session?.silentReturnTo) {
					delete req.session.silentReturnTo;
				}
				res.redirect(silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=login_failed`);
				return;
			}
			// Return-Path (#1231) vor regenerate() sichern — die neue Session enthält die
			// Session-Daten des stillen Einstiegs nicht mehr.
			const silentReturnTo = sanitizeReturnPath(req.session?.silentReturnTo);
			if (req.session?.silentPending) {
				delete req.session.silentPending;
			}
			if (req.session?.silentReturnTo) {
				delete req.session.silentReturnTo;
			}
			// Login aus der nativen App (#1669): keine Session im System-Browser, sondern ein Einmal-Code,
			// den der WebView der App über den App Link einlöst (POST /auth/native/exchange).
			const nativeState = req.session?.nativeState;
			if (nativeState) {
				delete req.session.nativeState;
				createNativeLoginCode(user.email, nativeState).then(
					(code) => res.redirect(`${APP_ROOT}auth/native?code=${encodeURIComponent(code)}`),
					() => res.redirect(`${APP_ROOT}?error=login_failed`),
				);
				return;
			}
			establishSession(req, user, (sessionErr) => {
				if (sessionErr) {
					res.redirect(silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=login_failed`);
					return;
				}
				res.redirect(silentReturnTo ?? APP_ROOT);
			});
		},
	)(req, res, next);
});

// POST /auth/native/exchange — löst den Einmal-Code aus dem App-Login zusammen mit dem `state` der App
// ein und meldet den WebView der App an (#1669, ADR 0016). Die Allowlist wird erneut geprüft, wie beim
// Magic Link.
authRouter.post('/auth/native/exchange', async (req, res) => {
	const { code, state } = (req.body ?? {}) as { code?: unknown; state?: unknown };
	const email =
		typeof code === 'string' && code !== '' && typeof state === 'string' && state !== ''
			? await consumeLoginToken(nativeLoginToken(code, state), 'native')
			: null;
	if (!email || !isEmailAllowed(email)) {
		sendError(res, 400, 'Der Anmeldecode ist abgelaufen oder wurde schon benutzt.');
		return;
	}
	const user = await upsertOAuthUser({ email });
	establishSession(req, user, (sessionErr) => {
		if (sessionErr) {
			sendError(res, 500, 'Session-Fehler.');
			return;
		}
		res.status(204).end();
	});
});

// GET /auth/me — gibt die aktuelle Session zurück (oder 401). Die Rolle kommt frisch aus der DB
// (nicht aus dem Session-Snapshot): So wirken Beförderung und Rückstufung über die Admin-API
// sofort auf den Tab „Nutzerverwaltung“, und Alt-Sessions von vor dem Rollensystem (ohne `role`)
// erhalten ihre echte Rolle statt `undefined`. Anzeigefelder bleiben bewusst Session-Daten.
authRouter.get('/auth/me', async (req, res) => {
	// Pass-Through-Modus: Ist überhaupt kein Auth-Kontext konfiguriert (siehe `isAuthActive`), lässt
	// `requireAuth` jede API-Route ungehindert durch — dann darf `/auth/me` nicht 401 melden. Sonst
	// zeigt das Frontend eine Login-Seite, hinter die niemand kommt: ohne OAuth-Credentials ist weder
	// `/auth/google` noch `/auth/google/silent` registriert. Der synthetische Nutzer trägt keine Id,
	// bleibt damit ohne Eigentümer-Bindung (`ownerScope`) und sieht wie bisher alle Ressourcen.
	if (!req.session?.user && !isAuthActive()) {
		// #1456: auch hier Paket + Entitlement-Map — der synthetische Nutzer hat keine DB-Zeile
		// (und keine Id), ist damit paketlos und bekommt 'free'.
		// #1494 (AK7): der synthetische Nutzer hat keine Id und damit auch kein Abo — definierter
		// Leerwert `null`, ohne DB-Zugriff.
		res.json({
			email: 'dev@localhost',
			displayName: 'Lokaler Modus',
			name: 'Lokaler Modus',
			avatarUrl: null,
			plan: 'free',
			entitlements: getEntitlements('free'),
			subscription: null,
		});
		return;
	}
	if (!req.session || !req.session.user) {
		res.clearCookie(SIGNED_IN_COOKIE, signedInCookieOptions);
		res.status(401).json({ message: 'Nicht eingeloggt.' });
		return;
	}
	const user = req.session.user;
	let role: UserRole;
	// #1456: Paket wie die Rolle frisch aus der DB — eine Änderung über die Admin-API wirkt damit
	// sofort, ohne Neu-Login. Alt-Sessions ohne `plan` fallen auf 'free'.
	let plan: Plan;
	try {
		const dbUser = typeof user.id === 'number' ? await User.findByPk(user.id) : undefined;
		// Konto inzwischen gelöscht (#1671, z. B. auf einem anderen Gerät): Session beenden.
		if (dbUser === null) {
			req.session.destroy(() => {
				res.clearCookie(SIGNED_IN_COOKIE, signedInCookieOptions);
				res.status(401).json({ message: 'Nicht eingeloggt.' });
			});
			return;
		}
		role = dbUser?.role ?? user.role ?? 'member';
		plan = dbUser?.plan ?? user.plan ?? 'free';
	} catch {
		res.status(500).json({ message: 'Interner Serverfehler.' });
		return;
	}
	// Snapshot nachziehen, damit Alt-Sessions ab jetzt eine Rolle tragen (self-healing).
	if (user.role !== role) {
		user.role = role;
	}
	if (user.plan !== plan) {
		user.plan = plan;
	}
	// #1459: Das Restkontingent der KI-Unterstützung ist verbrauchsabhängig — der Monatszähler
	// kommt aus `ai_usage` (Best-Effort: ein Lesefehler darf `/auth/me` nicht mit 500 reißen).
	let aiAssistConsumed = 0;
	try {
		aiAssistConsumed = typeof user.id === 'number' ? await getAiUsageCount(user.id) : 0;
	} catch (error) {
		console.warn('KI-Verbrauch konnte nicht gelesen werden — quotaRemaining zeigt das volle Kontingent.', error);
	}
	// #1494 (AK7): Abo-Status zusätzlich zu plan/entitlements — kein Abo → definierter Leerwert
	// `null`. Best-Effort wie der KI-Verbrauch: ein Lesefehler darf `/auth/me` nicht mit 500 reißen.
	let subscription: {
		plan: string;
		period: string;
		status: string;
		currentPeriodEnd: Date;
		pendingPlan: string | null;
		pendingPlanEffectiveAt: Date | null;
		graceUntil: Date | null;
	} | null = null;
	try {
		const dbSubscription =
			typeof user.id === 'number' ? await Subscription.findOne({ where: { userId: user.id } }) : null;
		if (dbSubscription) {
			const now = new Date();
			// #1495 (AK4): ein vorgemerkter Downgrade wirkt zum `currentPeriodEnd` — hier, beim Lesen,
			// wird er fällig angewendet, damit er nicht auf ein weiteres PayPal-Ereignis wartet.
			await applyDuePendingPlan(dbSubscription, now);
			// #1506 (AK6): eine abgelaufene Kulanzfrist wird beim Lesen wirksam (Muster oben).
			await applyDueGracePeriod(dbSubscription, now);
			const firstFailureAt = dbSubscription.get('firstFailureAt') as Date | null;
			subscription = {
				plan: dbSubscription.plan,
				period: dbSubscription.period,
				status: dbSubscription.status,
				currentPeriodEnd: dbSubscription.currentPeriodEnd,
				// #1505 (AK6): vorgemerkter Wechsel bleibt nach dem etwaigen Anwenden oben `null`.
				pendingPlan: dbSubscription.pendingPlan ?? null,
				pendingPlanEffectiveAt: dbSubscription.pendingPlanEffectiveAt ?? null,
				// #1506 (AK7): während laufender Kulanzfrist firstFailureAt + Frist, sonst null.
				graceUntil: firstFailureAt ? new Date(firstFailureAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS) : null,
			};
		}
	} catch (error) {
		console.warn('Abo-Status konnte nicht gelesen werden — subscription zeigt null.', error);
	}
	res.cookie(SIGNED_IN_COOKIE, '1', {
		...signedInCookieOptions,
		maxAge: req.session.cookie.originalMaxAge ?? undefined,
	});
	res.json({
		id: user.id,
		email: user.email,
		displayName: user.displayName,
		avatarUrl: user.avatarUrl ?? null,
		role,
		plan,
		entitlements: getEntitlements(plan, aiAssistConsumed),
		subscription,
	});
});

// DELETE /auth/me — eigenes Konto samt persönlichen Daten löschen (#1671, Play-Pflicht). 409 mit
// Begründung bei laufendem Abo oder als letzter Admin einer Gruppe mit weiteren Mitgliedern; danach
// endet die Session wie beim Logout.
authRouter.delete('/auth/me', async (req, res) => {
	const userId = req.session?.user?.id;
	if (typeof userId !== 'number') {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const result = await deleteAccount(userId);
	// `code` lässt die App den Grund in der Sprache des Nutzers erklären; `message` bleibt für API-Clients.
	if (result === 'subscription_active') {
		res
			.status(409)
			.json({ message: 'Bitte kündige zuerst dein Abo. Danach kannst du dein Konto löschen.', code: result });
		return;
	}
	if (result === 'last_group_admin') {
		res.status(409).json({
			message:
				'Du bist der letzte Admin einer Gruppe mit weiteren Mitgliedern. Ernenne zuerst eine andere Person zum Admin oder löse die Gruppe auf.',
			code: result,
		});
		return;
	}
	req.session.destroy(() => {
		res.clearCookie(SIGNED_IN_COOKIE, signedInCookieOptions);
		res.status(204).end();
	});
});

// POST /auth/logout — Session beenden
authRouter.post('/auth/logout', (req, res) => {
	req.session.destroy(() => {
		res.clearCookie(SIGNED_IN_COOKIE, signedInCookieOptions);
		res.json({ message: 'Ausgeloggt.' });
	});
});

// POST /auth/test-login — nur in NODE_ENV=test registriert.
// Ermöglicht Tests, eine Session ohne echten Google-OAuth-Flow anzulegen.
// Konditionale Registrierung (statt Runtime-Guard) eliminiert das Auth-Bypass-Risiko
// bei versehentlichem Deploy einer test-Konfiguration.
if (process.env.NODE_ENV === 'test') {
	authRouter.post('/auth/test-login', async (req, res) => {
		const { email, displayName, avatarUrl, role } = req.body as {
			email?: string;
			displayName?: string;
			avatarUrl?: string | null;
			/** Rollensystem admin/member: Tests dürfen die Rolle direkt setzen (nur NODE_ENV=test). */
			role?: UserRole;
		};

		// Multi-User-Gate (Issue #193, AK-8): nicht-erlaubte E-Mail → 401.
		// Issue #1136: Ohne konfigurierte Allowlist (Pass-Through-Modus, siehe `isAuthActive`) ist
		// jede Adresse erlaubt — sonst bliebe der Endpunkt in einer auth-losen E2E-Umgebung unbenutzbar.
		const hasAllowlist = !!(process.env.GOOGLE_ALLOWED_EMAILS?.trim() || process.env.GOOGLE_ALLOWED_EMAIL?.trim());
		if (!email || (hasAllowlist && !isEmailAllowed(email))) {
			res.status(401).json({ message: 'Nicht eingeloggt.' });
			return;
		}

		const resolvedDisplayName = displayName ?? email;
		// Test-Nutzer ohne Passwort: find/create analog zum OAuth-Pfad.
		const [dbUser] = await User.findOrCreate({
			where: { email },
			defaults: { email, passwordHash: '__test__', displayName: resolvedDisplayName, role: role ?? resolveRole(email) },
		});
		const effectiveRole = role ?? resolveRole(email, dbUser.role);
		if (effectiveRole !== dbUser.role) {
			await dbUser.update({ role: effectiveRole });
		}

		// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
		req.session.regenerate((err) => {
			if (err) {
				res.status(500).json({ message: 'Session-Fehler.' });
				return;
			}
			req.session.user = {
				id: dbUser.id,
				email,
				displayName: resolvedDisplayName,
				avatarUrl: avatarUrl ?? null,
				role: effectiveRole,
				// #1456: Paket wie die Rolle eager in den Snapshot — sonst sieht ein Guard, der
				// `req.session.user.plan` direkt liest, bis zum ersten `/auth/me` `undefined`.
				plan: dbUser.plan,
			};
			req.session.save(() => {
				res.json({ message: 'Eingeloggt.' });
			});
		});
	});
}

export { authRouter };
