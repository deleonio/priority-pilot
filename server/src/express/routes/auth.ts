import { Router } from 'express';
import passport from 'passport';
import { isEmailAllowed } from '../../logics/allowedEmails.js';
import { User } from '../../models/index.js';
import { hashPassword, verifyPassword } from '../../logics/auth.js';

const authRouter = Router();

// POST /auth/register — E-Mail-/Passwort-Registrierung (Issue #206, AK 1).
// Legt einen neuen User an (409 bei bereits vergebener E-Mail), meldet ihn direkt
// per frisch regenerierter Session an und antwortet mit 201.
authRouter.post('/auth/register', async (req, res) => {
	const { email, password } = req.body as { email?: string; password?: string };
	if (!email || !password) {
		res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich.' });
		return;
	}

	const existing = await User.findOne({ where: { email } });
	if (existing) {
		res.status(409).json({ message: 'E-Mail ist bereits registriert.' });
		return;
	}

	const passwordHash = await hashPassword(password);
	await User.create({ email, passwordHash, displayName: email });

	// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
	req.session.regenerate((err) => {
		if (err) {
			res.status(500).json({ message: 'Session-Fehler.' });
			return;
		}
		req.session.user = { email, displayName: email };
		req.session.save(() => {
			res.status(201).json({ email, displayName: email });
		});
	});
});

// POST /auth/login — E-Mail-/Passwort-Login (Issue #206, AK 2).
// 401 bei unbekannter E-Mail oder falschem Passwort (kein Unterschied nach außen,
// um E-Mail-Enumeration zu vermeiden). Bei Erfolg frische Session + 200.
authRouter.post('/auth/login', async (req, res) => {
	const { email, password } = req.body as { email?: string; password?: string };
	if (!email || !password) {
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}

	const user = await User.findOne({ where: { email } });
	if (!user) {
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}

	const passwordOk = await verifyPassword(password, user.passwordHash);
	if (!passwordOk) {
		res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
		return;
	}

	const sessionUser = { email: user.email, displayName: user.displayName };
	// Session-Fixation verhindern: neue Session-ID vor dem Setzen des Users.
	req.session.regenerate((err) => {
		if (err) {
			res.status(500).json({ message: 'Session-Fehler.' });
			return;
		}
		req.session.user = sessionUser;
		req.session.save(() => {
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
