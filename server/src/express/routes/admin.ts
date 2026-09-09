import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../../database.js';
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

/**
 * Stuft `id` auf `member` zurück — aber nur, wenn danach noch mindestens ein Admin übrig bleibt.
 * Die Prüfung steckt als Subquery in EINEM bedingten UPDATE statt in „erst zählen, dann
 * schreiben“: Zwei parallele Rückstufungen der beiden letzten Admins könnten sonst beide den
 * Count `2` sehen und die App ohne Administrator zurücklassen (TOCTOU). Ein einzelnes UPDATE ist
 * in SQLite atomar; auf eine Transaktion wird bewusst verzichtet (Tests laufen mit `:memory:` und
 * einer einzigen Verbindung, parallele `BEGIN`s würden dort kollidieren). Bereits zurückgestufte
 * Konten (`role <> 'admin'`) bleiben idempotent erreichbar (kein falsches 409).
 * @returns `false`, wenn `id` der letzte verbleibende Admin ist und nichts geändert wurde.
 */
const demoteUnlessLastAdmin = async (id: number): Promise<boolean> => {
	// Tabellen-/Spaltenname und Quoting kommen aus Modell und Dialekt (kein hart kodiertes
	// Backtick-SQL) — ein Dialekt- oder Tabellenwechsel bricht die Subquery dann nicht still.
	const qi = sequelize.getQueryInterface();
	const tableName = User.getTableName();
	const usersTable = qi.quoteIdentifier(typeof tableName === 'string' ? tableName : tableName.tableName);
	const roleColumn = qi.quoteIdentifier('role');
	const adminCount = sequelize.literal(`(SELECT COUNT(*) FROM ${usersTable} WHERE ${roleColumn} = 'admin')`);
	const [affected] = await User.update(
		{ role: 'member' },
		{
			where: {
				id,
				[Op.or]: [{ role: { [Op.ne]: 'admin' } }, sequelize.where(adminCount, Op.gt, 1)],
			},
		},
	);
	return affected > 0;
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
			if (body.role === 'member') {
				if (!(await demoteUnlessLastAdmin(target.id))) {
					sendError(res, 409, LAST_ADMIN_MESSAGE);
					return;
				}
				await target.reload();
			} else {
				await target.update({ role: body.role });
			}
			res.json(toDto(target));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
