import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Anzeigename selbst festlegen (#1219): GET/PUT `/profile`. Der Name ist serverseitig
 * persistiert (Spalte `users.displayName`, #206) und wird in der Session nachgezogen —
 * `/auth/me` antwortet aus `req.session.user`, nicht aus der DB (auth.ts). Bewusst das
 * EINZIGE schreibbare Feld: `email` und `passwordHash` sind über diesen Endpunkt nicht
 * erreichbar (AK4), unbekannte Body-Felder fallen beim Destructuring heraus.
 * Auth wie geoConfig: Router hängt hinter dem globalen `requireAuth`, ohne Auth-Kontext
 * bedient derselbe `resolveGeoUser`-Pfad den gemeinsamen Entwicklungs-Nutzer (Issue #207).
 */

/** Maximale Länge des Anzeigenamens nach `trim()` (#1219 AK3). */
const MAX_DISPLAY_NAME_LENGTH = 60;

type ProfileDto = { displayName: string; email: string; avatarUrl: string | null };

/**
 * Liest ausschließlich `displayName` aus dem Body und prüft es nach `trim()`: leer
 * (auch nur Whitespace) oder länger als 60 Zeichen → `null` (AK3). Alle weiteren
 * Felder — inklusive `email`/`passwordHash` — werden ignoriert (AK4).
 */
const extractDisplayName = (body: unknown): string | null => {
	if (typeof body !== 'object' || body === null) return null;
	const { displayName } = body as Record<string, unknown>;
	if (typeof displayName !== 'string') return null;
	const trimmed = displayName.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_DISPLAY_NAME_LENGTH) return null;
	return trimmed;
};

/**
 * Profildaten eines Nutzers. `avatarUrl` nimmt den Wert der Session vor — `/auth/me`
 * antwortet ebenso aus der Session (auth.ts), und gerade der Test-Login (#1136) legt den
 * Avatar nur dort ab. Ohne Session-Wert (Pass-Through) gilt die DB-Spalte.
 */
const toProfileDto = (user: User, sessionAvatarUrl?: string | null): ProfileDto => ({
	displayName: user.displayName,
	email: user.email,
	avatarUrl: sessionAvatarUrl ?? user.avatarUrl ?? null,
});

export const profileRouter = Router();

// GET /profile — Anzeigename, E-Mail und Avatar des Nutzers (#1219 AK1).
profileRouter.get('/profile', async (req: Request, res: Response<ProfileDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json(toProfileDto(user, req.session?.user?.avatarUrl));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /profile — ausschließlich den Anzeigenamen speichern (#1219 AK2–AK4); die Session
// wird mitgezogen, damit das nachfolgende GET /auth/me sofort den neuen Namen liefert.
profileRouter.put('/profile', async (req: Request, res: Response<ProfileDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const displayName = extractDisplayName(req.body);
		if (displayName === null) {
			sendError(
				res,
				400,
				'Ungültiger Anzeigename: erforderlich, 1 bis 60 Zeichen (Leerzeichen am Rand werden entfernt).',
			);
			return;
		}
		await User.update({ displayName }, { where: { id: user.id } });
		if (req.session?.user) {
			req.session.user.displayName = displayName;
		}
		res.json({ ...toProfileDto(user, req.session?.user?.avatarUrl), displayName });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
