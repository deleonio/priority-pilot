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
			/**
			 * Issue #1460: gesetzt, wenn `apiTokenScope` von `readwrite` auf `read` herabgestuft
			 * wurde, weil das Paket des Token-Besitzers `mcp_readwrite` nicht enthält (der
			 * gespeicherte Scope bleibt `readwrite`). Unterscheidet die Ablehnung von einem echten
			 * Nur-lese-Token, damit nur die paketbedingte Ablehnung den Pakethinweis trägt.
			 */
			apiTokenPlanCapped?: boolean;
		}
	}
}
