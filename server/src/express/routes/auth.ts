import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { Op, UniqueConstraintError } from 'sequelize';
import { allowEmail, isDbEmailAllowed, isEmailAllowed } from '../../logics/allowedEmails.js';
import { spracheAusHeader } from '../../logics/careSuggestionData.js';
import sequelize from '../../database.js';
import { Pillar, Subscription, User } from '../../models/index.js';
import type { UserRole } from '../../models/user.js';
import { OPEN_SUBSCRIPTION_STATUSES, PAID_FIRST } from '../../models/subscription.js';
import { SEED_PILLARS } from '../../models/pillarData.js';
import { hashPassword, verifyPassword, resolveRole } from '../../logics/auth.js';
import { getEntitlements, PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { TERMS_VERSION } from '../../logics/legal.js';
import { applyDuePendingPlan, applyDueGracePeriod, GRACE_PERIOD_DAYS } from '../../logics/billing/lifecycle.js';
import { paypalGraceDeps } from '../../logics/paypal.js';
import { sanitizeReturnPath } from '../../logics/silentReturnPath.js';
import { consumeLoginToken, createNativeLoginCode, nativeLoginToken } from '../../logics/magicLink.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import { InvalidWaitlistEmailError, joinWaitlist } from '../../logics/waitlist.js';
import { deleteAccount } from '../../logics/deleteAccount.js';
import { sendError } from '../http-error.js';
import { hasGoogleOAuth, isAuthActive } from '../requireAuth.js';
import { establishSession } from '../establishSession.js';
import { issueAppToken } from '../apiTokenAuth.js';
import { ApiToken } from '../../models/index.js';
import { THROTTLED_MESSAGE } from './rateLimit.js';
import { playAccountIdFor } from '../../logics/googlePlay.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Timing-Normalisierung: bei unbekannter E-Mail bcrypt-Vergleich simulieren,
// damit Angreifer per Zeitmessung keine gültigen Adressen ermitteln können.
const DUMMY_HASH = await hashPassword('__dummy__');

const authRouter = Router();

// Rate-Limit gegen Brute-Force auf Login/Register/OAuth (CodeQL js/missing-rate-limiting), nach
// dem Muster der übrigen Limiter. Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
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

// POST /auth/register — E-Mail-/Passwort-Registrierung (Issue #206, AK 1), nur NODE_ENV=test (#2299).
// Legt einen neuen User an (409 bei bereits vergebener E-Mail), meldet ihn direkt
// per frisch regenerierter Session an und antwortet mit 201.
authRouter.post('/auth/register', async (req, res) => {
	// Nur in der Testumgebung (E2E `registerOwnSession`): in Produktion ginge sonst ein Passwortkonto
	// ohne Allowlist/E-Mail-Bestätigung auf eine fremde Adresse durch (Kontoübernahme, #2299).
	if (process.env.NODE_ENV !== 'test') {
		res.status(404).json({ message: 'Nicht gefunden.' });
		return;
	}
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
				SEED_PILLARS.map(({ key, name, description, weight }) => ({ key, name, description, weight, userId: user.id })),
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

// POST /auth/review-login — Prüfzugang für Google Play (#2426): Die Play-Prüfer melden ein festes
// Konto allein per Passwort an (kein Google-Konto, kein Postfach). Aus, solange `PLAY_REVIEW_PASSWORD`
// leer ist; je Anfrage gelesen. Das Konto umgeht Allowlist/Warteliste bewusst und bekommt bei jedem
// Login `pro` (ohne Kauf). Im Kanal `play` App-Token statt Session-Cookie (Muster magic-link/verify).
const PLAY_REVIEW_DEFAULT_EMAIL = 'google-play-review@balamentum.invalid';
// #2471: geteilter Helper — die Prüfkonto-Erkennung hängt an der E-Mail (jedes Review-Login setzt
// das Konto zurück, #2442; an der User-Id wäre sie nach dem Reset verloren) und wird in
// `/auth/review-login` UND `/auth/me` (demoHint) gebraucht. Je Anfrage gelesen, wie die Schalter.
const playReviewEmail = (): string => (process.env.PLAY_REVIEW_EMAIL || PLAY_REVIEW_DEFAULT_EMAIL).trim().toLowerCase();
// Anders als `authLimiter` auch außerhalb von production aktiv: 5 Fehlversuche je IP und 15 Minuten.
const reviewLoginLimiter = rateLimit({
	windowMs: 15 * 60_000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: THROTTLED_MESSAGE,
	skipSuccessfulRequests: true,
});
// Vergleich über SHA-256: gleich lange Puffer für `timingSafeEqual`, unabhängig von der Passwortlänge.
const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

authRouter.post('/auth/review-login', reviewLoginLimiter, async (req, res) => {
	const expected = process.env.PLAY_REVIEW_PASSWORD ?? '';
	const { password } = (req.body ?? {}) as { password?: unknown };
	if (expected === '' || typeof password !== 'string' || !timingSafeEqual(sha256(password), sha256(expected))) {
		sendError(res, 401, 'Ungültige Zugangsdaten.');
		return;
	}
	const email = playReviewEmail();
	// Jeder Login startet mit einem frischen Konto (#2442): Altkonto samt Daten löschen, neue Id.
	const previous = await User.findOne({ where: { email } });
	if (previous) {
		let result: Awaited<ReturnType<typeof deleteAccount>> | undefined;
		try {
			result = await deleteAccount(previous.id);
		} catch (error) {
			console.error('Zurücksetzen des Prüfkontos fehlgeschlagen:', error);
		}
		if (result !== 'deleted') {
			sendError(res, 500, 'Das Prüfkonto konnte nicht zurückgesetzt werden.');
			return;
		}
	}
	const account = await upsertOAuthUser({ email });
	// requireAuth prüft die Zulassung je Request erneut (#2456) — ohne DB-Eintrag scheiterte die
	// Prüf-Session auf Instanzen mit Allowlist an jedem Daten-Request. Idempotent; überlebt den
	// Reset je Login, da deleteAccount allowed_emails nicht anfasst.
	await allowEmail(email, 'pruefkonto');
	await User.update({ plan: 'pro' }, { where: { id: account.id } });
	const user = { ...account, plan: 'pro' as const };
	if (req.get('X-Client-Channel') === 'play') {
		res.json({ token: await issueAppToken(user.id) });
		return;
	}
	establishSession(req, user, (sessionErr) => {
		if (sessionErr) {
			sendError(res, 500, 'Session-Fehler.');
			return;
		}
		res.json({});
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
// Rücksprung in die App über ihr Custom Scheme (`appId` in native/capacitor.config.ts, Intent-Filter
// im AndroidManifest): öffnet die App ohne App-Link-Verifikation, also auch bei Play-signierten
// Installationen, deren Schlüssel assetlinks.json nicht kennt (ADR 0023).
const APP_SCHEME_LOGIN = 'balamentum.app://auth/native';

/** Beendet einen gescheiterten App-Login mit Rücksprung in die App statt auf die Fehlerseite im Browser. */
const redirectNativeFailure = (req: Request, res: Response, code: string): boolean => {
	if (!req.session?.nativeScheme) {
		return false;
	}
	delete req.session.nativeScheme;
	delete req.session.nativeState;
	res.redirect(`${APP_SCHEME_LOGIN}?error=${encodeURIComponent(code)}`);
	return true;
};

// GET /auth/google — startet den OAuth-Flow. `?client=app&state=…` markiert den Login aus der nativen
// App (ADR 0016): Er läuft im System-Browser, dessen Session der WebView der App nicht teilt. Der
// Einmal-Code wird an `state` gebunden, den nur die startende App kennt — ein fremder, per Link
// untergeschobener Code lässt sich so nicht in der App einlösen (Login-CSRF).
authRouter.get('/auth/google', requireGoogleStrategy, (req, res, next) => {
	delete req.session.nativeState;
	delete req.session.nativeScheme;
	if (req.query.lng === 'en') req.session.loginLng = 'en';
	else delete req.session.loginLng;
	if (req.query.client === 'app') {
		if (typeof req.query.state !== 'string' || !NATIVE_STATE.test(req.query.state)) {
			sendError(res, 400, 'state fehlt oder ist ungültig.');
			return;
		}
		req.session.nativeState = req.query.state;
		if (req.query.return === 'scheme') req.session.nativeScheme = true;
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
	delete req.session.nativeScheme;
	// Ebenso keine Sprachwahl aus einem abgebrochenen Website-Login.
	delete req.session.loginLng;
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
	// Englischer Website-Login: auch die Fehlerseite englisch; der Vermerk gilt nur für diesen Versuch.
	const lng = !silentPending && req.session?.loginLng === 'en' ? '&lng=en' : '';
	if (!req.query.code || req.query.error) delete req.session.loginLng;
	// Issue #1136: Ein Callback-Hit ohne Google-`code` ist kein gültiger OAuth-Abschluss —
	// Passport würde hier erneut einen Authorization-Redirect starten (ungenutzer Loop). Google
	// liefert einen Ablehnungsgrund als `error`-Parameter (z. B. `access_denied`); dieser Code wird
	// 1:1 an die Frontend-Fehler-Weiche durchgereicht, sonst `login_failed` als Sammelcode.
	if (!req.query.code) {
		const code = typeof req.query.error === 'string' && req.query.error !== '' ? req.query.error : 'login_failed';
		if (redirectNativeFailure(req, res, code)) {
			return;
		}
		res.redirect(
			silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=${encodeURIComponent(code)}${lng}`,
		);
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
				delete req.session.loginLng;
				if (redirectNativeFailure(req, res, 'login_failed')) {
					return;
				}
				res.redirect(silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=login_failed${lng}`);
				return;
			}
			// Return-Path (#1231) vor regenerate() sichern — die neue Session enthält die
			// Session-Daten des stillen Einstiegs nicht mehr.
			const silentReturnTo = sanitizeReturnPath(req.session?.silentReturnTo);
			const appRoot = req.session?.loginLng === 'en' ? `${APP_ROOT}?lng=en` : APP_ROOT;
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
				// Ohne Custom Scheme (ältere App-Stände) über den App Link wie bisher.
				const scheme = req.session.nativeScheme === true;
				delete req.session.nativeState;
				delete req.session.nativeScheme;
				createNativeLoginCode(user.email, nativeState).then(
					(code) =>
						res.redirect(`${scheme ? APP_SCHEME_LOGIN : `${APP_ROOT}auth/native`}?code=${encodeURIComponent(code)}`),
					() => res.redirect(`${scheme ? APP_SCHEME_LOGIN : APP_ROOT}?error=login_failed`),
				);
				return;
			}
			establishSession(req, user, (sessionErr) => {
				if (sessionErr) {
					res.redirect(silentPending ? `${APP_ROOT}?silent=unavailable` : `${APP_ROOT}?error=login_failed`);
					return;
				}
				res.redirect(silentReturnTo ?? appRoot);
			});
		},
	)(req, res, next);
});

// POST /auth/native/exchange — löst den Einmal-Code aus dem App-Login zusammen mit dem `state` der App
// ein und meldet den WebView der App an (#1669, ADR 0016). Die Allowlist wird erneut geprüft, wie beim
// Magic Link. Im Kanal `play` antwortet sie statt mit Session-Cookie mit einem App-Token (#2377).
authRouter.post('/auth/native/exchange', async (req, res) => {
	const { code, state } = (req.body ?? {}) as { code?: unknown; state?: unknown };
	const email =
		typeof code === 'string' && code !== '' && typeof state === 'string' && state !== ''
			? await consumeLoginToken(nativeLoginToken(code, state), 'native')
			: null;
	if (!email || (!(await isDbEmailAllowed(email)) && !isEmailAllowed(email))) {
		sendError(res, 400, 'Der Anmeldecode ist abgelaufen oder wurde schon benutzt.');
		return;
	}
	const user = await upsertOAuthUser({ email });
	if (req.get('X-Client-Channel') === 'play') {
		res.json({ token: await issueAppToken(user.id) });
		return;
	}
	establishSession(req, user, (sessionErr) => {
		if (sessionErr) {
			sendError(res, 500, 'Session-Fehler.');
			return;
		}
		res.status(204).end();
	});
});

// POST /auth/waitlist — Launch-Zugang über die Warteliste (#1982, ADR 0019). Öffentlich und
// sessionlos (läuft unter dem authLimiter oben): Unbekannte tragen sich selbst ein und erhalten
// sofort ihre 1-basierte Position im Referral-Rang plus persönlichen Empfehlungs-Code.
// Idempotent — wiederholter Aufruf derselben Adresse liefert denselben Eintrag, kein Duplikat.
authRouter.post('/auth/waitlist', async (req, res) => {
	const { email, ref } = (req.body ?? {}) as { email?: string; ref?: string };
	try {
		res.json(await joinWaitlist(String(email ?? ''), ref, spracheAusHeader(req.get('accept-language'))));
	} catch (err) {
		if (err instanceof InvalidWaitlistEmailError) {
			sendError(res, 400, 'Bitte gib eine gültige E-Mail-Adresse an.');
			return;
		}
		throw err;
	}
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
			// #1901 (AK8): ohne Auth-Kontext gibt es nichts zu bestätigen.
			termsAccepted: true,
			launchBanner: process.env.LAUNCH_BANNER_ENABLED === 'true',
			// #2471: Pass-Through-Nutzer sind nie das Prüfkonto — der Hinweis bleibt aus.
			demoHint: false,
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
	// #1901: zugestimmt nur zur aktuellen Fassung; im Pass-Through-Modus (auch mit Test-Session) immer.
	let termsAccepted: boolean;
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
		termsAccepted = !isAuthActive() || dbUser?.termsVersion === TERMS_VERSION;
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
	// #1494 (AK7): Abo-Status zusätzlich zu plan/entitlements — kein Abo → definierter Leerwert
	// `null`. Best-Effort: ein Lesefehler darf `/auth/me` nicht mit 500 reißen.
	let subscription: {
		provider: string;
		plan: string;
		period: string;
		status: string;
		currentPeriodEnd: Date;
		pendingPlan: string | null;
		pendingPlanEffectiveAt: Date | null;
		graceUntil: Date | null;
	} | null = null;
	try {
		// #1690: das laufende Abo zuerst; sonst das zuletzt angelegte (gekündigt oder abgelaufen). Ein
		// bezahltes Abo (auch mit Zahlungsrückstand) geht einem offenen Checkout vor (#2235, #2240).
		const dbSubscription =
			typeof user.id === 'number'
				? ((await Subscription.findOne({
						where: { userId: user.id, status: OPEN_SUBSCRIPTION_STATUSES },
						order: [PAID_FIRST, ['createdAt', 'DESC']],
					})) ?? (await Subscription.findOne({ where: { userId: user.id }, order: [['createdAt', 'DESC']] })))
				: null;
		if (dbSubscription) {
			const now = new Date();
			// #1495 (AK4): ein vorgemerkter Downgrade wirkt zum `currentPeriodEnd` — hier, beim Lesen,
			// wird er fällig angewendet, damit er nicht auf ein weiteres PayPal-Ereignis wartet.
			let planApplied = await applyDuePendingPlan(dbSubscription, now);
			// #1896: ein neuer, noch nicht bestätigter Checkout (approval_pending) bestimmt `User.plan`
			// noch nicht — die fällige Vormerkung des zuvor gekündigten Abos wirkt trotzdem.
			if (dbSubscription.status === 'approval_pending') {
				const previous = await Subscription.findOne({
					where: { userId: user.id, status: { [Op.notIn]: OPEN_SUBSCRIPTION_STATUSES } },
					order: [['createdAt', 'DESC']],
				});
				if (previous) {
					planApplied = (await applyDuePendingPlan(previous, now)) || planApplied;
				}
			}
			// Die Antwort trägt das gerade angewendete Paket, nicht den Stand vor dem Anwenden.
			if (planApplied) {
				plan = ((await User.findByPk(user.id as number))?.plan ?? plan) as Plan;
				user.plan = plan;
			}
			// #1506 (AK6): eine abgelaufene Kulanzfrist wird beim Lesen wirksam (Muster oben); #2234: sie
			// entzieht das Paket, die Antwort trägt es wie oben.
			if (await applyDueGracePeriod(dbSubscription, now, paypalGraceDeps())) {
				plan = ((await User.findByPk(user.id as number))?.plan ?? plan) as Plan;
				user.plan = plan;
			}
			// #2238: neben dem laufenden Abo kann ein ausstehendes Upgrade liegen (zweite Zeile,
			// `approval_pending`) — in der Anzeige als zahlungsgebundene Vormerkung führen, bis der
			// Zahlungseingang sie aktiviert (`pendingPlanEffectiveAt` null → „aktiv mit Zahlungseingang“).
			const pendingUpgrade =
				dbSubscription.status === 'active'
					? await Subscription.findOne({
							where: { userId: user.id, status: 'approval_pending' },
							order: [['createdAt', 'DESC']],
						})
					: null;
			const firstFailureAt = dbSubscription.get('firstFailureAt') as Date | null;
			subscription = {
				provider: dbSubscription.provider,
				plan: dbSubscription.plan,
				period: dbSubscription.period,
				status: dbSubscription.status,
				currentPeriodEnd: dbSubscription.currentPeriodEnd,
				// #1505 (AK6): vorgemerkter Wechsel bleibt nach dem etwaigen Anwenden oben `null`.
				// #2238: ein ausstehendes Upgrade (zweite Zeile) erscheint als zahlungsgebundene Vormerkung.
				pendingPlan: dbSubscription.pendingPlan ?? pendingUpgrade?.plan ?? null,
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
		entitlements: getEntitlements(plan),
		subscription,
		termsAccepted,
		// #2229: Server-Schalter des Einführungs-Banners, je Anfrage gelesen (Wechsel ohne Release).
		launchBanner: process.env.LAUNCH_BANNER_ENABLED === 'true',
		// #2471: Demo-Hinweis nur für das Play-Prüfkonto und nur bei aktivem Schalter — je Anfrage
		// gelesen (Muster launchBanner), Erkennung an der E-Mail (#2442), nicht an der User-Id.
		demoHint: process.env.DEMO_HINT_ENABLED === 'true' && user.email.trim().toLowerCase() === playReviewEmail(),
		...(user.id !== undefined ? { playAccountId: playAccountIdFor(user.id) } : {}),
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
	let result: Awaited<ReturnType<typeof deleteAccount>>;
	try {
		result = await deleteAccount(userId);
	} catch (error) {
		console.error('Kontolöschung fehlgeschlagen:', error);
		sendError(res, 500, 'Das Konto konnte nicht gelöscht werden.');
		return;
	}
	if (result === 'paypal_unavailable') {
		// Die Kündigung eines Abos mit Zahlungsrückstand scheiterte (#2240) — das Konto bleibt.
		sendError(res, 502, 'PayPal war nicht erreichbar.');
		return;
	}
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

// POST /auth/terms — Zustimmung zu Nutzungsbedingungen und Datenschutzerklärung speichern (#1901):
// Fassung (`TERMS_VERSION`) und Zeitpunkt am eigenen Konto. Beide Bestätigungen sind Pflicht.
authRouter.post('/auth/terms', async (req, res) => {
	const userId = req.session?.user?.id;
	if (typeof userId !== 'number') {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const { acceptTerms, acceptPrivacy } = (req.body ?? {}) as { acceptTerms?: unknown; acceptPrivacy?: unknown };
	if (acceptTerms !== true || acceptPrivacy !== true) {
		sendError(res, 400, 'Bitte Nutzungsbedingungen und Datenschutzerklärung bestätigen.');
		return;
	}
	await User.update({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }, { where: { id: userId } });
	res.status(204).end();
});

// POST /auth/logout — Session beenden; ein mitgeschicktes App-Token wird zurückgezogen (#2377).
authRouter.post('/auth/logout', async (req, res) => {
	if (req.apiTokenKind === 'app') {
		await ApiToken.update({ revokedAt: new Date() }, { where: { id: req.apiTokenId } });
	}
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
		const { email, displayName, avatarUrl, role, plan } = req.body as {
			email?: string;
			displayName?: string;
			avatarUrl?: string | null;
			/** Rollensystem admin/member: Tests dürfen die Rolle direkt setzen (nur NODE_ENV=test). */
			role?: UserRole;
			/** Paket direkt setzen, z. B. Pro für e2e-Specs paketgebundener Funktionen (#1936). */
			plan?: Plan;
		};

		// Multi-User-Gate (Issue #193, AK-8): nicht-erlaubte E-Mail → 401.
		// Issue #1136: Ohne konfigurierte Allowlist (Pass-Through-Modus, siehe `isAuthActive`) ist
		// jede Adresse erlaubt — sonst bliebe der Endpunkt in einer auth-losen E2E-Umgebung unbenutzbar.
		// #2471: Das Play-Prüfkonto umgeht Allowlist/Warteliste bewusst (#2426) — auch hier, damit
		// Tests eine Session mit der Prüfkontakt-E-Mail anlegen können (Session-Quelle für demoHint).
		const hasAllowlist = !!(process.env.GOOGLE_ALLOWED_EMAILS?.trim() || process.env.GOOGLE_ALLOWED_EMAIL?.trim());
		if (
			!email ||
			(hasAllowlist &&
				!(await isDbEmailAllowed(email)) &&
				!isEmailAllowed(email) &&
				email.trim().toLowerCase() !== playReviewEmail())
		) {
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
		if (plan !== undefined && PLAN_VALUES.includes(plan) && plan !== dbUser.plan) {
			await dbUser.update({ plan });
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
