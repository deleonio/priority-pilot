import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { Group, GroupMember } from '../../models/index.js';
import sequelize from '../../database.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Gruppen-CRUD (#1211, Teil 1 der Gruppen-Epic #952). Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts).
 *
 * Sichtbarkeit und Rechte laufen **ausschließlich über Membership-Lookups in `group_members`** —
 * nie über `ownerScope`, denn `Group` hat kein `userId`-Feld (Zugehörigkeit ist n:m, der Ersteller
 * ist nur der erste Admin). Fremde Gruppen antworten daher mit 404 statt 403, damit weder
 * Existenz noch Namen nach außen lecken (Muster routes/tasks.ts, fremde Task → 404).
 *
 * Nutzer-Auflösung wie /geo-config: Session-Nutzer, sonst im Pass-Through-Modus ohne Auth-Kontext
 * der gemeinsame Entwicklungs-Nutzer (API-Tests laufen ohne Auth-Env).
 */

type GroupRole = 'admin' | 'member';

type GroupDto = {
	id: number;
	name: string;
	description: string | null;
	role: GroupRole;
	memberCount: number;
};

const NAME_MAX_LENGTH = 60;

/** Name validieren (AK4): nach Trim nicht leer und ≤ 60 Zeichen, sonst null. */
const validateName = (name: unknown): string | null => {
	if (typeof name !== 'string') return null;
	const trimmed = name.trim();
	if (trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH) return null;
	return trimmed;
};

/** DTO einer Gruppe inkl. eigener Rolle und Mitgliederzahl (COUNT über group_members). */
const toDto = async (group: Group, role: GroupRole): Promise<GroupDto> => ({
	id: group.id,
	name: group.name,
	description: group.description ?? null,
	role,
	memberCount: await GroupMember.count({ where: { groupId: group.id } }),
});

/**
 * Gruppe nur dann geliefert, wenn der Nutzer Mitglied ist — das ist die eine Sichtbarkeits-
 * schicht für alle :id-Routen (AK3): fremde Gruppe → null → 404. `role` steuert die
 * Schreibrechte (Admin) und wird im DTO mitgegeben, damit das Frontend Aktionen ausblendet.
 */
const findMembership = async (userId: number, groupId: number): Promise<{ group: Group; role: GroupRole } | null> => {
	const membership = await GroupMember.findOne({ where: { groupId, userId } });
	if (!membership) return null;
	const group = await Group.findByPk(groupId);
	if (!group) return null;
	return { group, role: membership.role as GroupRole };
};

export const groupsRouter = Router();

// POST /groups — Gruppe anlegen; der Ersteller wird in derselben Transaktion als Admin-Mitglied
// eingetragen (AK1), damit nie eine gruppenlose Mitgliedschaft bzw. mitgliederlose Gruppe entsteht.
groupsRouter.post('/groups', async (req: Request, res: Response<GroupDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
		const name = validateName(body.name);
		if (name === null) {
			sendError(res, 400, `Der Gruppenname ist Pflicht und darf ${NAME_MAX_LENGTH} Zeichen nicht überschreiten.`);
			return;
		}
		const description =
			typeof body.description === 'string' && body.description.trim().length > 0 ? body.description.trim() : null;

		const created = await sequelize.transaction(async (transaction) => {
			const group = await Group.create({ name, description }, { transaction });
			await GroupMember.create(
				{ groupId: group.id, userId: user.id, role: 'admin', joinedAt: new Date() },
				{ transaction },
			);
			return group;
		});
		res.status(201).json(await toDto(created, 'admin'));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /groups — nur Gruppen eigener Membership, je mit Rolle und Mitgliederzahl (AK2).
groupsRouter.get('/groups', async (req: Request, res: Response<GroupDto[] | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const memberships = await GroupMember.findAll({ where: { userId: user.id } });
		const groups = await Group.findAll({ where: { id: memberships.map((membership) => membership.groupId) } });
		const dtos = await Promise.all(
			groups.map((group) =>
				toDto(
					group,
					(memberships.find((membership) => membership.groupId === group.id)?.role ?? 'member') as GroupRole,
				),
			),
		);
		res.json(dtos);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /groups/:id — eigene Membership → 200, fremde Gruppe → 404 (AK3).
groupsRouter.get('/groups/:id', async (req: Request, res: Response<GroupDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const found = await findMembership(user.id, Number(req.params.id));
		if (!found) {
			sendError(res, 404, 'Gruppe nicht gefunden.');
			return;
		}
		res.json(await toDto(found.group, found.role));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PATCH /groups/:id — nur Admins (AK3); Nicht-Mitglieder und Nicht-Admins bekommen einheitlich
// 404. Nicht-Admin kann in diesem Ticket nicht auftreten (Ersteller ist immer Admin, Einladungen
// sind Ticket 2), die Klausel sichert den Vertrag trotzdem ab.
groupsRouter.patch('/groups/:id', async (req: Request, res: Response<GroupDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const found = await findMembership(user.id, Number(req.params.id));
		if (!found || found.role !== 'admin') {
			sendError(res, 404, 'Gruppe nicht gefunden.');
			return;
		}
		const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
		const name = validateName(body.name);
		if (name === null) {
			sendError(res, 400, `Der Gruppenname ist Pflicht und darf ${NAME_MAX_LENGTH} Zeichen nicht überschreiten.`);
			return;
		}
		const description =
			typeof body.description === 'string' && body.description.trim().length > 0 ? body.description.trim() : null;
		await found.group.update({ name, description });
		res.json(await toDto(found.group, found.role));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /groups/:id — Admin → 204; Gruppe UND alle Mitgliedschaften in einer Transaktion
// entfernen (AK5), danach ist jede :id-Route 404.
groupsRouter.delete('/groups/:id', async (req: Request, res: Response<ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const found = await findMembership(user.id, Number(req.params.id));
		if (!found || found.role !== 'admin') {
			sendError(res, 404, 'Gruppe nicht gefunden.');
			return;
		}
		await sequelize.transaction(async (transaction) => {
			await GroupMember.destroy({ where: { groupId: found.group.id }, transaction });
			await Group.destroy({ where: { id: found.group.id }, transaction });
		});
		res.status(204).send();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
