import { Router } from 'express';
import passport from 'passport';

const authRouter = Router();

// GET /auth/google — startet den OAuth-Flow
authRouter.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

// GET /auth/google/callback — Google leitet nach Authentifizierung hierher zurück
authRouter.get(
	'/auth/google/callback',
	passport.authenticate('google', { failureRedirect: '/auth/error' }),
	(_req, res) => {
		res.redirect('/');
	},
);

// GET /auth/me — gibt die aktuelle Session zurück (oder 401)
authRouter.get('/auth/me', (req, res) => {
	if (!req.session || !(req.session as { user?: unknown }).user) {
		res.status(401).json({ message: 'Nicht eingeloggt.' });
		return;
	}
	const user = (req.session as unknown as { user: { email: string; displayName: string } }).user;
	res.json({ email: user.email, displayName: user.displayName });
});

// POST /auth/logout — Session beenden
authRouter.post('/auth/logout', (req, res) => {
	req.session.destroy(() => {
		res.json({ message: 'Ausgeloggt.' });
	});
});

// POST /auth/test-login — nur in NODE_ENV=test verfügbar
// Ermöglicht Tests, eine Session ohne echten Google-OAuth-Flow anzulegen.
authRouter.post('/auth/test-login', (req, res) => {
	if (process.env.NODE_ENV !== 'test') {
		res.status(404).json({ message: 'Nicht gefunden.' });
		return;
	}

	const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL ?? '';
	const { email, displayName } = req.body as { email?: string; displayName?: string };

	if (!email || email !== allowedEmail) {
		res.status(403).json({ message: 'E-Mail nicht erlaubt.' });
		return;
	}

	(req.session as unknown as { user?: { email: string; displayName: string } }).user = {
		email,
		displayName: displayName ?? email,
	};
	req.session.save(() => {
		res.json({ message: 'Eingeloggt.' });
	});
});

export { authRouter };
