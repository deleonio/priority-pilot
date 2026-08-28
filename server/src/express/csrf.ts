import { doubleCsrf } from 'csrf-csrf';
import type { ErrorRequestHandler, Request, Response } from 'express';

/**
 * CSRF-Schutz per Double-Submit-Cookie (CodeQL js/missing-token-validation).csrf-csrf v4:
 * ein HMAC-Cookie wird mit dem `x-csrf-token`-Header verglichen; Frontend holt den Token
 * über GET /auth/csrf und sendet ihn bei jedem schreibenden Request mit (siehe frontend/src/api.ts).
 *
 * Aktiv nur in Produktion (gleiche Haltung wie die SESSION_SECRET-/Allowlist-Gates in index.ts):
 * Dev führt 'dev-secret' ohne echte Sessions, und die E2E-Suite seedet ihre Daten über direkte
 * page.request-Aufrufe ohne Token — der Frontend-Token-Flow läuft in allen Umgebungen und wird
 * im E2E trotzdem mitgefahren.
 */
export const createCsrfUtilities = (sessionSecret: string) => {
	// Cookie-Name/-Flags folgen dem Session-Cookie: `__Host-` + secure nur in Produktion (HTTPS via
	// Caddy), im Dev/E2E (http://localhost) wäre ein security-präfixter Cookie ungültig.
	const isProduction = process.env.NODE_ENV === 'production';
	const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = doubleCsrf({
		getSecret: () => sessionSecret,
		// Token an die Session binden (Abwehr gegen Token-Leakage); anonym bleibt nur der
		// Double-Submit-Vergleich — für Login/Register (noch keine Session) ausreichend.
		getSessionIdentifier: (req) => String(req.session?.user?.id ?? 'anon'),
		cookieName: isProduction ? '__Host-csrf' : 'csrf',
		cookieOptions: { sameSite: 'strict', path: '/', secure: isProduction, httpOnly: true },
		size: 64,
	});

	// GET /auth/csrf — stellt dem Frontend einen Token aus (Set-Cookie + JSON).
	const issueCsrfToken = (req: Request, res: Response) => {
		res.json({ csrfToken: generateCsrfToken(req, res) });
	};

	// csrf-csrf lehnt mit invalidCsrfTokenError ab — ohne diesen Handler würde Express daraus ein 500.
	const csrfErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
		if (err === invalidCsrfTokenError) {
			res.status(403).json({ error: 'Ungültiger CSRF-Token.' });
			return;
		}
		next(err);
	};

	return { doubleCsrfProtection, issueCsrfToken, csrfErrorHandler };
};
