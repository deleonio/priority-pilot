import 'express-session';

declare module 'express-session' {
	interface SessionData {
		user?: { id?: number; email: string; displayName: string; avatarUrl?: string | null };
		/** Issue #396 PR B: markiert einen laufenden stillen Google-Login — der gemeinsame Callback
		 *  leitet bei Interaktionsfehlern (login_required u. ä.) auf /?silent=unavailable statt /auth/error. */
		silentPending?: boolean;
		/** Issue #1231: interner Pfad aus dem stillen Einstieg (?returnTo=) — der Erfolgs-Callback
		 *  leitet darauf zurück statt fix auf „/" (sanitisiert, siehe logics/silentReturnPath.ts). */
		silentReturnTo?: string;
	}
}
