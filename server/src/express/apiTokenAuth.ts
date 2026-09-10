import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ApiToken, User } from '../models/index.js';
import { sendError } from './http-error.js';

/** Präfix des Klartext-Tokens — erlaubt es, ihn später von anderen Secret-Arten zu unterscheiden. */
const TOKEN_PREFIX = 'pp_';

/** Erzeugt einen neuen Klartext-Token `pp_<32 Hex-Zeichen>` (128 Bit Entropie). */
export const generateApiToken = (): string => `${TOKEN_PREFIX}${randomBytes(16).toString('hex')}`;

/** SHA-256-Hex des Klartexts — der einzige Wert, der die Datenbank je zu sehen bekommt. */
export const hashApiToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Neutralisiert das Speichern der Session für diesen Request. Bearer-Requests sind zustandslos: der
 * synthetisierte (bzw. verworfene) Nutzer darf nicht im Session-Store landen — sonst wüchse er mit
 * jedem Request eines externen Clients, und ein kaputter Bearer-Header löschte die Browser-Session
 * des Nutzers gleich mit.
 */
const suppressSessionSave = (req: Request): void => {
	req.session.save = ((callback?: (err?: unknown) => void) => {
		callback?.();
		return req.session;
	}) as typeof req.session.save;
};

/** Liest den Klartext-Token aus dem `Authorization`-Header (`Bearer <token>`), sonst `null`. */
const readBearerToken = (req: Request): string | null => {
	const header = req.headers.authorization;
	if (typeof header !== 'string') return null;
	const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
	return match ? match[1]! : null;
};

/**
 * Middleware: Bearer-Authentifizierung neben der Browser-Session (Issue #1352, AK3/AK5/AK6/AK7).
 *
 * Registriert **vor** der CSRF-Prüfung und **vor** dem globalen `requireAuth` (siehe
 * `express/index.ts`): liegt ein `Authorization: Bearer …`-Header vor, wird sein Hash gegen einen
 * nicht zurückgezogenen {@link ApiToken} geprüft und bei Treffer `req.session.user` mit dem
 * Token-Besitzer befüllt — in genau dem Shape, den der Login setzt. Dadurch gelten
 * `getUserId()`/`ownerScope()` und `requireRole('admin')` unverändert auch für Bearer-Requests;
 * es braucht keine zweite Autorisierungslogik.
 *
 * Ein ungültiger oder zurückgezogener Token verwirft die mitgeschickte Cookie-Session (ein kaputter
 * Token darf nicht still als fremder Nutzer weiterlaufen), lässt den Request aber weiterlaufen: die
 * Middleware hängt global vor **allen** Routen, auch vor den bewusst öffentlichen (`/health`,
 * `/auth/*`, `/api/transit`, Invite-Links) — ein sofortiges 401 machte die allein wegen eines
 * kaputten Headers unerreichbar. Geschützte Routen fallen über `requireAuth` ohnehin auf 401 (AK7).
 * Ohne Bearer-Header bleibt der bestehende Session-Weg unangetastet.
 */
export const apiTokenAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const token = readBearerToken(req);
	if (!token) {
		next();
		return;
	}
	try {
		const record = await ApiToken.findOne({ where: { tokenHash: hashApiToken(token), revokedAt: null } });
		const user = record ? await User.findByPk(record.userId) : null;
		if (!record || !user) {
			// Kein Kurzschluss auf 401 (s. o.): Session verwerfen, durchlassen. `requireAuth` erledigt
			// die Abweisung für alles, was Auth verlangt.
			req.session.user = undefined;
			suppressSessionSave(req);
			next();
			return;
		}
		await record.update({ lastUsedAt: new Date() });

		req.apiTokenId = record.id;
		req.apiTokenScope = record.scope;
		req.session.user = {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl ?? null,
			role: user.role,
		};
		suppressSessionSave(req);
		next();
	} catch {
		res.status(500).json({ message: 'Interner Serverfehler.' });
	}
};

/** Ob dieser Request über einen Bearer-Token authentifiziert wurde (CSRF-Ausnahme, s. o.). */
export const isApiTokenRequest = (req: Request): boolean => req.apiTokenId !== undefined;

/** Methoden, die als schreibend gelten (#1356, AK4) — GET/HEAD/OPTIONS bleiben immer erlaubt. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Middleware: setzt die Rechtestufe eines API-Tokens durch (Issue #1356, AK4/AK6/AK7). Registriert
 * **hinter** `requireAuth` (Browser-Sessions sind unbetroffen) und **vor** allen Fachrouten.
 *
 * - Die Token-Verwaltung selbst (`/api-tokens`, jede Methode) ist über Bearer nie erreichbar — sonst
 *   könnte sich ein Token selbst oder andere Tokens hochstufen (AK7).
 * - `POST /mcp/v1` ist die JSON-RPC-Transportroute und wird NICHT allein wegen ihrer HTTP-Methode
 *   gesperrt (sonst wäre `task_list` mit einem Nur-lese-Token tot) — die Sperre greift stattdessen
 *   auf dem inneren Loopback-Request, den `mcp/tools.ts` mit demselben Bearer-Header gegen die
 *   gespiegelte HTTP-Route schickt (AK6).
 * - Alle übrigen schreibenden Requests (POST/PUT/PATCH/DELETE) eines Tokens mit `scope: 'read'`
 *   werden mit 403 abgewiesen, bevor die Fachroute läuft (AK4).
 */
export const apiTokenScopeGuard = (req: Request, res: Response, next: NextFunction): void => {
	if (!isApiTokenRequest(req)) {
		next();
		return;
	}
	if (req.path === '/api-tokens' || req.path.startsWith('/api-tokens/')) {
		sendError(res, 403, 'Die Token-Verwaltung ist über einen API-Token nicht erreichbar.');
		return;
	}
	if (req.path === '/mcp/v1') {
		next();
		return;
	}
	if (WRITE_METHODS.has(req.method) && req.apiTokenScope === 'read') {
		sendError(res, 403, 'Dieser Token erlaubt nur lesenden Zugriff.');
		return;
	}
	next();
};
