import type { Request, Response, NextFunction } from 'express';
import { isEmailAllowed } from '../logics/allowedEmails.js';

/** Prüft, ob ein Allowlist-Gate konfiguriert ist (Plural oder Singular gesetzt). */
const hasAllowlist = (): boolean =>
	!!(process.env.GOOGLE_ALLOWED_EMAILS?.trim() || process.env.GOOGLE_ALLOWED_EMAIL?.trim());

/** Prüft, ob eine Google-OAuth-Strategie konfiguriert ist (Client-Credentials vorhanden). */
const hasGoogleOAuth = (): boolean =>
	!!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

/**
 * Ob der API-Schutz aktiv ist (Issue #207, AK4). Aktiv, sobald **irgendein** Auth-Kontext
 * konfiguriert ist: Allowlist, Google-OAuth oder ein gesetztes `SESSION_SECRET` (Produktion setzt
 * dieses immer). Ohne jegliche Konfiguration bleibt der lokale Entwicklungsmodus offen (Pass-Through),
 * damit reine CRUD-Setups ohne Login weiterlaufen.
 */
const isAuthActive = (): boolean => hasAllowlist() || hasGoogleOAuth() || !!process.env.SESSION_SECRET?.trim();

/**
 * Ermittelt die effektive Eigentümer-Id eines Requests aus der Session (Issue #207, AK5).
 * `undefined`, wenn kein authentifizierter Nutzer mit Id vorliegt (Pass-Through-Modus).
 */
export const getUserId = (req: Request): number | undefined => {
	const id = req.session?.user?.id;
	return typeof id === 'number' ? id : undefined;
};

/**
 * Middleware: Anfrage ohne gültige Session abweisen (Issue #207, AK4).
 *
 * Anders als früher unabhängig von `GOOGLE_ALLOWED_EMAIL` — sobald ein Auth-Kontext konfiguriert
 * ist (siehe {@link isAuthActive}), erzwingt jede API-Route eine gültige Session (401 sonst).
 * Ist zusätzlich eine Allowlist gesetzt, wird die E-Mail bei jedem Request erneut geprüft, damit ein
 * nachträglich gesperrter Account auch mit bestehender Session sofort herausfällt.
 *
 * Nebenwirkung: Bei erfolgreicher Prüfung wird `req.userId` aus der Session gesetzt (Datenisolation).
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
	if (!isAuthActive()) {
		// Lokaler Entwicklungsmodus ohne Auth-Konfiguration: kein Gate, keine Nutzer-Bindung.
		next();
		return;
	}
	const user = req.session?.user;
	if (!user || typeof user.id !== 'number' || (hasAllowlist() && !isEmailAllowed(user.email))) {
		res.status(401).json({ message: 'Nicht eingeloggt.' });
		return;
	}
	req.userId = user.id;
	next();
};
