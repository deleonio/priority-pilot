import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ApiToken, User } from '../models/index.js';

/** Präfix des Klartext-Tokens — erlaubt es, ihn später von anderen Secret-Arten zu unterscheiden. */
const TOKEN_PREFIX = 'pp_';

/** Erzeugt einen neuen Klartext-Token `pp_<32 Hex-Zeichen>` (128 Bit Entropie). */
export const generateApiToken = (): string => `${TOKEN_PREFIX}${randomBytes(16).toString('hex')}`;

/** SHA-256-Hex des Klartexts — der einzige Wert, der die Datenbank je zu sehen bekommt. */
export const hashApiToken = (token: string): string => createHash('sha256').update(token).digest('hex');

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
 * Ein ungültiger oder zurückgezogener Token endet sofort mit 401 (kein Fallthrough auf eine
 * mitgeschickte Cookie-Session — sonst könnte ein kaputter Token still als fremder Nutzer
 * weiterlaufen). Ohne Bearer-Header bleibt der bestehende Session-Weg unangetastet.
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
			res.status(401).json({ message: 'Nicht eingeloggt.' });
			return;
		}
		await record.update({ lastUsedAt: new Date() });

		req.apiTokenId = record.id;
		req.session.user = {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl ?? null,
			role: user.role,
		};
		// Bearer-Requests sind zustandslos: der synthetisierte Nutzer darf nicht im Session-Store
		// landen (sonst wüchse er mit jedem Request eines externen Clients).
		req.session.save = ((callback?: (err?: unknown) => void) => {
			callback?.();
			return req.session;
		}) as typeof req.session.save;
		next();
	} catch {
		res.status(500).json({ message: 'Interner Serverfehler.' });
	}
};

/** Ob dieser Request über einen Bearer-Token authentifiziert wurde (CSRF-Ausnahme, s. o.). */
export const isApiTokenRequest = (req: Request): boolean => req.apiTokenId !== undefined;
