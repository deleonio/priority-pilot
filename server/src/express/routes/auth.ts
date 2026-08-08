import { Router, type RequestHandler } from 'express';
import passport from 'passport';
import { UniqueConstraintError } from 'sequelize';
import { isEmailAllowed } from '../../logics/allowedEmails.js';
import sequelize from '../../database.js';
import { Pillar, User } from '../../models/index.js';
import { SEED_PILLARS } from '../../models/pillarData.js';
import { hashPassword, verifyPassword } from '../../logics/auth.js';
import { hasGoogleOAuth } from '../requireAuth.js';

// Timing-Normalisierung: bei unbekannter E-Mail bcrypt-Vergleich simulieren,
// damit Angreifer per Zeitmessung keine gültigen Adressen ermitteln können.
const DUMMY_HASH = await hashPassword('__dummy__');

const authRouter = Router();

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
				{ email: normalizedEmail, passwordHash, displayName: normalizedEmail },
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
		req.session.user = { id: created.id, email: normalizedEmail, displayName: normalizedEmail, avatarUrl: null };
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

	const sessionUser = { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: null };
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

// GET /auth/google — startet den OAuth-Flow
authRouter.get('/auth/google', requireGoogleStrategy, passport.authenticate('google', { scope: ['email', 'profile'] }));

// GET /auth/google/silent — stiller Google-Login via prompt=none (Issue #396 PR B).
// Ein Nutzer mit gültiger Google-Session wird so ohne eigenen Klick angemeldet. Ist kein OAuth
// konfiguriert, ist ein stiller Login nicht möglich → Weiterleitung auf die manuelle Login-Seite
// (/?silent=unavailable). Der Session-Marker `silentPending` signalisiert dem gemeinsamen Callback,
// einen Interaktionsfehler (login_required u. ä.) ebenfalls als „silent unavailable" zu behandeln.
authRouter.get('/auth/google/silent', (req, res, next) => {
	if (!hasGoogleOAuth()) {
		res.redirect('/?silent=unavailable');
		return;
	}
	req.session.silentPending = true;
	passport.authenticate('google', { scope: ['email', 'profile'], prompt: 'none' })(req, res, next);
});

// GET /auth/google/callback — Google leitet nach Authentifizierung hierher zurück. Der gemeinsame
// Callback bedient den normalen UND den stillen OAuth-Einstieg (Issue #396 PR B): war der Auslöser
// ein stiller Versuch (Session-Marker `silentPending`), leiten Interaktionsfehler auf
// /?silent=unavailable statt auf /auth/error weiter, damit das Frontend die manuelle Login-Seite zeigt.
authRouter.get(
	'/auth/google/callback',
	requireGoogleStrategy,
	(req, res, next) => {
		const silentPending = req.session?.silentPending === true;
		passport.authenticate('google', {
			failureRedirect: silentPending ? '/?silent=unavailable' : '/auth/error',
		})(req, res, next);
	},
	(req, res) => {
		// User vor regenerate() sichern — req.user ist danach ggf. nicht mehr verfügbar.
		const user = req.user as { id: number; email: string; displayName: string; avatarUrl?: string | null };
		const silentPending = req.session?.silentPending === true;
		if (req.session?.silentPending) {
			delete req.session.silentPending;
		}
		// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
		req.session.regenerate((err) => {
			if (err) {
				res.redirect(silentPending ? '/?silent=unavailable' : '/auth/error');
				return;
			}
			req.session.user = {
				id: user.id,
				email: user.email,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl ?? null,
			};
			req.session.save(() => res.redirect('/'));
		});
	},
);

// GET /auth/me — gibt die aktuelle Session zurück (oder 401)
authRouter.get('/auth/me', (req, res) => {
	if (!req.session || !req.session.user) {
		res.status(401).json({ message: 'Nicht eingeloggt.' });
		return;
	}
	const user = req.session.user;
	res.json({ email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null });
});

// POST /auth/logout — Session beenden
authRouter.post('/auth/logout', (req, res) => {
	req.session.destroy(() => {
		res.json({ message: 'Ausgeloggt.' });
	});
});

// POST /auth/test-login — nur in NODE_ENV=test registriert.
// Ermöglicht Tests, eine Session ohne echten Google-OAuth-Flow anzulegen.
// Konditionale Registrierung (statt Runtime-Guard) eliminiert das Auth-Bypass-Risiko
// bei versehentlichem Deploy einer test-Konfiguration.
if (process.env.NODE_ENV === 'test') {
	authRouter.post('/auth/test-login', async (req, res) => {
		const { email, displayName, avatarUrl } = req.body as {
			email?: string;
			displayName?: string;
			avatarUrl?: string | null;
		};

		// Multi-User-Gate (Issue #193, AK-8): nicht-erlaubte E-Mail → 401.
		if (!email || !isEmailAllowed(email)) {
			res.status(401).json({ message: 'Nicht eingeloggt.' });
			return;
		}

		const resolvedDisplayName = displayName ?? email;
		// Test-Nutzer ohne Passwort: find/create analog zum OAuth-Pfad.
		const [dbUser] = await User.findOrCreate({
			where: { email },
			defaults: { email, passwordHash: '__test__', displayName: resolvedDisplayName },
		});

		// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
		req.session.regenerate((err) => {
			if (err) {
				res.status(500).json({ message: 'Session-Fehler.' });
				return;
			}
			req.session.user = { id: dbUser.id, email, displayName: resolvedDisplayName, avatarUrl: avatarUrl ?? null };
			req.session.save(() => {
				res.json({ message: 'Eingeloggt.' });
			});
		});
	});
}

export { authRouter };
