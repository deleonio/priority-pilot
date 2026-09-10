import 'express';

declare global {
	namespace Express {
		interface Request {
			/**
			 * Issue #1352: Id des API-Tokens, der diesen Request authentifiziert hat. Gesetzt
			 * ausschließlich von `express/apiTokenAuth.ts`. Bearer-Requests tragen kein Cookie und
			 * sind daher von der CSRF-Doppel-Submit-Prüfung ausgenommen (siehe express/index.ts).
			 */
			apiTokenId?: number;
			/**
			 * Issue #1356: Rechtestufe des Tokens, der diesen Request authentifiziert hat — gesetzt
			 * zusammen mit `apiTokenId`. Grundlage für `apiTokenScopeGuard` (express/apiTokenAuth.ts).
			 */
			apiTokenScope?: 'read' | 'readwrite';
		}
	}
}
