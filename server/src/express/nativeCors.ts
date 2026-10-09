import type { Request, Response, NextFunction } from 'express';

/** Ursprung des WebViews der Android-App (Capacitor, ADR 0016). */
const APP_ORIGIN = 'https://localhost';
/**
 * Alle Header, die das Frontend setzt (`frontend/src/api.ts`). Fehlt einer, verwirft der WebView die
 * Anfrage schon im Preflight: `x-csrf-token` steckt in jedem schreibenden Request.
 */
const APP_REQUEST_HEADERS = 'Authorization, Content-Type, X-Client-Channel, X-CSRF-Token, Accept-Language';

/**
 * Middleware: CORS-Freigabe nur für die Android-App (#2377). Registriert vor Session, CSRF und Auth,
 * damit der Preflight ohne Bearer-Header beantwortet wird. Ohne `Allow-Credentials` — die App
 * authentifiziert per Bearer-Token, nicht per Cookie. Andere Ursprünge erhalten keine Freigabe.
 */
export const nativeCors = (req: Request, res: Response, next: NextFunction): void => {
	res.vary('Origin');
	if (req.get('Origin') !== APP_ORIGIN) {
		next();
		return;
	}
	res.set('Access-Control-Allow-Origin', APP_ORIGIN);
	if (req.method === 'OPTIONS') {
		res.set('Access-Control-Allow-Headers', APP_REQUEST_HEADERS);
		res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
		res.status(204).end();
		return;
	}
	next();
};
