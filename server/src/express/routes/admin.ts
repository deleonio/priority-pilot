import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import type { UserRole } from '../../models/user.js';
import { requireRole } from '../requireAuth.js';

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member). Der Router hängt hinter dem globalen
 * `requireAuth` UND zusätzlich hinter `requireRole('admin')` (siehe unten) — nur Admins sehen
 * die Nutzerliste oder ändern Rollen.
 */

type AdminUserDto = {
	id: number;
	email: string;
	displayName: string;
	role: UserRole;
	createdAt: string;
};

const toDto = (user: User): AdminUserDto => ({
	id: user.id,
	email: user.email,
	displayName: user.displayName,
	role: user.role,
	createdAt: user.createdAt.toISOString(),
});

const LAST_ADMIN_MESSAGE = 'Es muss mindestens einen Administrator geben — ernenne zuerst eine andere Person.';

/** Prüft, ob `target` der letzte verbleibende System-Administrator ist (analog Gruppen-Schutz). */
const isLastRemainingAdmin = async (target: User): Promise<boolean> => {
	if (target.role !== 'admin') return false;
	const adminCount = await User.count({ where: { role: 'admin' } });
	return adminCount <= 1;
};

export const adminRouter = Router();

// GET /admin/users — alle Nutzer der App (nur Admins). `requireRole` läuft als Route-Middleware
// (nicht als `router.use(...)`) — ein pfadloses `.use()` auf einem ohne Präfix gemounteten Router
// (siehe express/index.ts) würde JEDEN nachfolgenden Request abfangen, nicht nur `/admin/*`.
adminRouter.get(
	'/admin/users',
	requireRole('admin'),
	async (_req: Request, res: Response<AdminUserDto[] | ErrorDto>) => {
		try {
			const users = await User.findAll({ order: [['displayName', 'ASC']] });
			res.json(users.map(toDto));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

// PATCH /admin/users/:id/role — Rolle eines Nutzers ändern (nur Admins). Der letzte verbleibende
// Admin darf nicht zurückgestuft werden (409), damit die App nie ohne Administrator dasteht.
adminRouter.patch(
	'/admin/users/:id/role',
	requireRole('admin'),
	async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isInteger(id) || id <= 0) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			const body = (req.body ?? {}) as { role?: unknown };
			if (body.role !== 'admin' && body.role !== 'member') {
				sendError(res, 400, 'Die Rolle muss "admin" oder "member" sein.');
				return;
			}
			const target = await User.findByPk(id);
			if (!target) {
				sendError(res, 404, 'Nutzer nicht gefunden.');
				return;
			}
			if (body.role === 'member' && (await isLastRemainingAdmin(target))) {
				sendError(res, 409, LAST_ADMIN_MESSAGE);
				return;
			}
			await target.update({ role: body.role });
			res.json(toDto(target));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
