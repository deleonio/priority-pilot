import 'express-session';
import type { UserRole } from '../models/user.js';
import type { Plan } from '../logics/plans.js';

declare module 'express-session' {
	interface SessionData {
		user?: {
			id?: number;
			email: string;
			displayName: string;
			avatarUrl?: string | null;
			role: UserRole;
			/** Gebuchtes Paket (#1456) — in Alt-Sessions noch nicht gesetzt, `/auth/me` zieht nach. */
			plan?: Plan;
		};
		/** Issue #396 PR B: markiert einen laufenden stillen Google-Login — der gemeinsame Callback
		 *  leitet bei Interaktionsfehlern (login_required u. ä.) auf /?silent=unavailable statt /auth/error. */
		silentPending?: boolean;
		/** Issue #1231: interner Pfad aus dem stillen Einstieg (?returnTo=) — der Erfolgs-Callback
		 *  leitet darauf zurück statt fix auf „/" (sanitisiert, siehe logics/silentReturnPath.ts). */
		silentReturnTo?: string;
		/** #1669: Google-Login aus der nativen App (`/auth/google?client=app`) — der Erfolgs-Callback
		 *  leitet mit einem Einmal-Code auf den App Link statt auf die App-Wurzel (ADR 0016). */
		nativeLogin?: boolean;
	}
}
