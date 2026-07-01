import 'express';

declare global {
	namespace Express {
		interface Request {
			/**
			 * Effektive Eigentümer-Id des Requests (Issue #207, AK5). Wird von `requireAuth` aus der
			 * Session gesetzt, sofern ein authentifizierter Nutzer vorliegt. `undefined` im lokalen
			 * Pass-Through-Modus (keine Auth konfiguriert) — Queries filtern dann nicht nach Nutzer.
			 */
			userId?: number;
		}
	}
}
