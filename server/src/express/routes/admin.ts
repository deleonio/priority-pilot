import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../../database.js';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import type { UserRole } from '../../models/user.js';
import { PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { requireRole } from '../requireAuth.js';

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member/tester). Der Router hängt hinter dem
 * globalen `requireAuth` — Nutzerliste und Rollenvergabe bleiben `requireRole('admin')`-gated
 * (Tester, #1566), nur der Paket-PATCH ist für Tester auf die eigene Id geöffnet.
 */

type AdminUserDto = {
	id: number;
	email: string;
	displayName: string;
	role: UserRole;
	plan: Plan;
	createdAt: string;
};

const toDto = (user: User): AdminUserDto => ({
	id: user.id,
	email: user.email,
	displayName: user.displayName,
	role: user.role,
	plan: user.plan,
	createdAt: user.createdAt.toISOString(),
});

const LAST_ADMIN_MESSAGE = 'Es muss mindestens einen Administrator geben — ernenne zuerst eine andere Person.';

/**
 * Stuft `id` auf eine Nicht-Admin-Rolle (`member`/`tester`) zurück — aber nur, wenn danach noch
 * mindestens ein Admin übrig bleibt.
 * Die Prüfung steckt als Subquery in EINEM bedingten UPDATE statt in „erst zählen, dann
 * schreiben“: Zwei parallele Rückstufungen der beiden letzten Admins könnten sonst beide den
 * Count `2` sehen und die App ohne Administrator zurücklassen (TOCTOU). Ein einzelnes UPDATE ist
 * in SQLite atomar; auf eine Transaktion wird bewusst verzichtet (Tests laufen mit `:memory:` und
 * einer einzigen Verbindung, parallele `BEGIN`s würden dort kollidieren). Bereits zurückgestufte
 * Konten (`role <> 'admin'`) bleiben idempotent erreichbar (kein falsches 409).
 * @returns `false`, wenn `id` der letzte verbleibende Admin ist und nichts geändert wurde.
 */
const demoteUnlessLastAdmin = async (id: number, targetRole: Exclude<UserRole, 'admin'>): Promise<boolean> => {
	// Tabellen-/Spaltenname und Quoting kommen aus Modell und Dialekt (kein hart kodiertes
	// Backtick-SQL) — ein Dialekt- oder Tabellenwechsel bricht die Subquery dann nicht still.
	const qi = sequelize.getQueryInterface();
	const tableName = User.getTableName();
	const usersTable = qi.quoteIdentifier(typeof tableName === 'string' ? tableName : tableName.tableName);
	const roleColumn = qi.quoteIdentifier('role');
	const adminCount = sequelize.literal(`(SELECT COUNT(*) FROM ${usersTable} WHERE ${roleColumn} = 'admin')`);
	const [affected] = await User.update(
		{ role: targetRole },
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
			if (body.role !== 'admin' && body.role !== 'member' && body.role !== 'tester') {
				sendError(res, 400, 'Die Rolle muss "admin", "member" oder "tester" sein.');
				return;
			}
			const target = await User.findByPk(id);
			if (!target) {
				sendError(res, 404, 'Nutzer nicht gefunden.');
				return;
			}
			if (body.role !== 'admin') {
				// Jede Rückstufung eines Admins (auf member ODER tester) hängt am Letzter-Admin-Guard —
				// auch via tester darf die App nie ohne Administrator dastehen (#1566 AK1).
				if (!(await demoteUnlessLastAdmin(target.id, body.role))) {
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

// PATCH /admin/users/:id/plan — Paket eines Nutzers setzen (Admins; Tester nur die eigene Id,
// #1566 AK3/AK4). Bis zur Selbstbedienung (T7) ist das der einzige Weg, ein Paket zu vergeben;
// deshalb bewusst manuell und ohne Zahlungsbezug. Muster wie oben bei der Rolle — nur ohne
// Letzter-Admin-Schutz. Das eigene-Id-Limit für Tester erzwingt der Server (403), das
// Frontend-Gating allein reichte nicht.
adminRouter.patch(
	'/admin/users/:id/plan',
	requireRole(['admin', 'tester']),
	async (req: Request, res: Response<AdminUserDto | ErrorDto>) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isInteger(id) || id <= 0) {
				sendError(res, 400, 'Ungültige Nutzer-Id.');
				return;
			}
			const requesterId = req.session?.user?.id;
			const requester = typeof requesterId === 'number' ? await User.findByPk(requesterId) : undefined;
			if (requester?.role === 'tester' && requester.id !== id) {
				sendError(res, 403, 'Tester dürfen nur das eigene Paket setzen.');
				return;
			}
			const body = (req.body ?? {}) as { plan?: unknown };
			if (!PLAN_VALUES.includes(body.plan as Plan)) {
				sendError(res, 400, `Das Paket muss eines von ${PLAN_VALUES.join(', ')} sein.`);
				return;
			}
			const target = await User.findByPk(id);
			if (!target) {
				sendError(res, 404, 'Nutzer nicht gefunden.');
				return;
			}
			await target.update({ plan: body.plan as Plan });
			res.json(toDto(target));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
