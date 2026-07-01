import { Router } from 'express';
import passport from 'passport';
import { UniqueConstraintError } from 'sequelize';
import { isEmailAllowed } from '../../logics/allowedEmails.js';
import { User } from '../../models/index.js';
import { hashPassword, verifyPassword } from '../../logics/auth.js';

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
		created = await User.create({ email: normalizedEmail, passwordHash, displayName: normalizedEmail });
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
		req.session.user = { id: created.id, email: normalizedEmail, displayName: normalizedEmail };
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

	const sessionUser = { id: user.id, email: user.email, displayName: user.displayName };
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

// GET /auth/google — startet den OAuth-Flow
authRouter.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

// GET /auth/google/callback — Google leitet nach Authentifizierung hierher zurück
authRouter.get(
	'/auth/google/callback',
	passport.authenticate('google', { failureRedirect: '/auth/error' }),
	(req, res) => {
		// User vor regenerate() sichern — req.user ist danach ggf. nicht mehr verfügbar.
		const user = req.user as { email: string; displayName: string };
		// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
		req.session.regenerate((err) => {
			if (err) {
				res.redirect('/auth/error');
				return;
			}
			req.session.user = user;
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
	res.json({ email: user.email, displayName: user.displayName });
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
	authRouter.post('/auth/test-login', (req, res) => {
		const { email, displayName } = req.body as { email?: string; displayName?: string };

		// Multi-User-Gate (Issue #193, AK-8): nicht-erlaubte E-Mail → 401.
		if (!email || !isEmailAllowed(email)) {
			res.status(401).json({ message: 'Nicht eingeloggt.' });
			return;
		}

		// User vor regenerate() sichern.
		const user = {
			email,
			displayName: displayName ?? email,
		};
		// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
		req.session.regenerate((err) => {
			if (err) {
				res.status(500).json({ message: 'Session-Fehler.' });
				return;
			}
			req.session.user = user;
			req.session.save(() => {
				res.json({ message: 'Eingeloggt.' });
			});
		});
	});
}

export { authRouter };
