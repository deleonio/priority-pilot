import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { Group, GroupInvitation, GroupMember, User } from '../../models/index.js';
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
		// PATCH-Vertrag (openapi.yml, GroupUpdate): alle Felder optional, abwesende Felder bleiben
		// unverändert. `name` wird deshalb nur bei Anwesenheit validiert — der Frontend-Dialog
		// sendet im Bearbeiten-Modus ausschließlich geänderte Felder, ein reines
		// Beschreibungs-Edit ohne `name` muss daher 200 liefern (Review PR #1214, Finding 1).
		const changes: { name?: string; description?: string | null } = {};
		if (body.name !== undefined) {
			const name = validateName(body.name);
			if (name === null) {
				sendError(res, 400, `Der Gruppenname ist Pflicht und darf ${NAME_MAX_LENGTH} Zeichen nicht überschreiten.`);
				return;
			}
			changes.name = name;
		}
		if (body.description !== undefined) {
			changes.description =
				typeof body.description === 'string' && body.description.trim().length > 0 ? body.description.trim() : null;
		}
		await found.group.update(changes);
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

/**
 * ── Einladungen und Mitgliedschaftspflege (#1212, Teil 2 der Gruppen-Epic #952) ──────────
 *
 * Sichtbarkeit wie oben über `findMembership`. Abweichend vom #1211-Muster (dort einheitlich
 * 404 für Nicht-Admins) unterscheiden die neuen Routen bewusst: Ein Mitglied ohne Adminrechte
 * bekommt 403 (die Gruppe kennt es ja), ein Nicht-Mitglied 404 (kein Existenz-Leak) — so
 * verlangt es der AK-Satz des Tickets.
 */

type MemberDto = {
	userId: number;
	displayName: string;
	role: GroupRole;
};

type GroupInvitationDto = {
	id: number;
	groupId: number;
	userId: number;
	displayName?: string;
	status: string;
};

type ReceivedInvitationDto = {
	id: number;
	groupId: number;
	groupName: string;
	invitedByName: string;
};

/** Anzeigename mit E-Mail-Fallback (User.displayName ist optional). */
const displayNameOf = (user: User | null): string => user?.displayName ?? user?.email ?? '';

// GET /groups/:id/members — jedes Mitglied (admin oder member) sieht die Liste; fremde Gruppe 404.
groupsRouter.get('/groups/:id/members', async (req: Request, res: Response<MemberDto[] | ErrorDto>) => {
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
		const members = await GroupMember.findAll({ where: { groupId: found.group.id } });
		const users = await User.findAll({ where: { id: members.map((member) => member.userId) } });
		res.json(
			members.map((member) => ({
				userId: member.userId,
				displayName: displayNameOf(users.find((candidate) => candidate.id === member.userId) ?? null),
				role: member.role as GroupRole,
			})),
		);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /groups/:id/invitations — offene Einladungen der Gruppe; nur Admins (Nicht-Admin 403).
groupsRouter.get('/groups/:id/invitations', async (req: Request, res: Response<GroupInvitationDto[] | ErrorDto>) => {
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
		if (found.role !== 'admin') {
			sendError(res, 403, 'Nur Administratoren sehen offene Einladungen.');
			return;
		}
		const invitations = await GroupInvitation.findAll({ where: { groupId: found.group.id, status: 'pending' } });
		const users = await User.findAll({ where: { id: invitations.map((invitation) => invitation.invitedUserId) } });
		res.json(
			invitations.map((invitation) => ({
				id: invitation.id,
				groupId: invitation.groupId,
				userId: invitation.invitedUserId,
				displayName: displayNameOf(users.find((candidate) => candidate.id === invitation.invitedUserId) ?? null),
				status: invitation.status,
			})),
		);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /groups/:id/invitations — Admin lädt ein Konto ein (AK3/AK4). Duplikat nur gegen eine
// bestehende `pending`-Zeile; nach `declined` ist eine neue Einladung zulässig (Spec-Entscheidung).
groupsRouter.post('/groups/:id/invitations', async (req: Request, res: Response<GroupInvitationDto | ErrorDto>) => {
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
		if (found.role !== 'admin') {
			sendError(res, 403, 'Nur Administratoren dürfen einladen.');
			return;
		}
		const body = (req.body ?? {}) as { userId?: unknown };
		const invitedUserId = typeof body.userId === 'number' ? body.userId : Number(body.userId);
		if (!Number.isInteger(invitedUserId)) {
			sendError(res, 400, 'Die einzuladende userId ist Pflicht.');
			return;
		}
		const invited = await User.findByPk(invitedUserId);
		if (!invited) {
			sendError(res, 404, 'Konto nicht gefunden.');
			return;
		}
		const existingMember = await GroupMember.findOne({ where: { groupId: found.group.id, userId: invitedUserId } });
		if (existingMember) {
			sendError(res, 409, 'Das Konto ist bereits Mitglied dieser Gruppe.');
			return;
		}
		const existingInvitation = await GroupInvitation.findOne({
			where: { groupId: found.group.id, invitedUserId, status: 'pending' },
		});
		if (existingInvitation) {
			sendError(res, 409, 'Für dieses Konto ist bereits eine Einladung offen.');
			return;
		}
		const created = await GroupInvitation.create({
			groupId: found.group.id,
			invitedUserId,
			invitedByUserId: user.id,
			status: 'pending',
			createdAt: new Date(),
		});
		res.status(201).json({
			id: created.id,
			groupId: created.groupId,
			userId: created.invitedUserId,
			displayName: displayNameOf(invited),
			status: created.status,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /invitations — offene Einladungen des angemeldeten Kontos, gruppenübergreifend (AK5).
groupsRouter.get('/invitations', async (req: Request, res: Response<ReceivedInvitationDto[] | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const invitations = await GroupInvitation.findAll({ where: { invitedUserId: user.id, status: 'pending' } });
		const groups = await Group.findAll({ where: { id: invitations.map((invitation) => invitation.groupId) } });
		const inviters = await User.findAll({ where: { id: invitations.map((invitation) => invitation.invitedByUserId) } });
		res.json(
			invitations.map((invitation) => ({
				id: invitation.id,
				groupId: invitation.groupId,
				groupName: groups.find((group) => group.id === invitation.groupId)?.name ?? '',
				invitedByName: displayNameOf(inviters.find((candidate) => candidate.id === invitation.invitedByUserId) ?? null),
			})),
		);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/** Offene Einladung des angemeldeten Kontos — fremde oder erledigte Einladung → null (→ 404). */
const findOwnPendingInvitation = async (userId: number, invitationId: number): Promise<GroupInvitation | null> =>
	GroupInvitation.findOne({ where: { id: invitationId, invitedUserId: userId, status: 'pending' } });

// POST /invitations/:id/accept — nur der Eingeladene selbst; legt die Mitgliedschaft an (AK6/AK8).
groupsRouter.post('/invitations/:id/accept', async (req: Request, res: Response<{ groupId: number } | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const invitation = await findOwnPendingInvitation(user.id, Number(req.params.id));
		if (!invitation) {
			sendError(res, 404, 'Einladung nicht gefunden.');
			return;
		}
		await sequelize.transaction(async (transaction) => {
			const existing = await GroupMember.findOne({
				where: { groupId: invitation.groupId, userId: user.id },
				transaction,
			});
			if (!existing) {
				await GroupMember.create(
					{ groupId: invitation.groupId, userId: user.id, role: 'member', joinedAt: new Date() },
					{ transaction },
				);
			}
			await invitation.update({ status: 'accepted' }, { transaction });
		});
		res.json({ groupId: invitation.groupId });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /invitations/:id/decline — nur der Eingeladene selbst; Mitgliederliste bleibt unverändert (AK7).
groupsRouter.post('/invitations/:id/decline', async (req: Request, res: Response<{ groupId: number } | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const invitation = await findOwnPendingInvitation(user.id, Number(req.params.id));
		if (!invitation) {
			sendError(res, 404, 'Einladung nicht gefunden.');
			return;
		}
		await invitation.update({ status: 'declined' });
		res.json({ groupId: invitation.groupId });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /groups/:id/members/:userId — Admin entfernt beliebige Mitglieder, jedes Mitglied sich
// selbst (AK9). Der letzte verbleibende Admin bleibt unantastbar (AK10, 409 mit Begründung).
groupsRouter.delete('/groups/:id/members/:userId', async (req: Request, res: Response<ErrorDto>) => {
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
		const targetUserId = Number(req.params.userId);
		const isSelf = targetUserId === user.id;
		if (found.role !== 'admin' && !isSelf) {
			sendError(res, 403, 'Nur Administratoren dürfen andere Mitglieder entfernen.');
			return;
		}
		const target = await GroupMember.findOne({ where: { groupId: found.group.id, userId: targetUserId } });
		if (!target) {
			sendError(res, 404, 'Mitglied nicht gefunden.');
			return;
		}
		if (target.role === 'admin') {
			const adminCount = await GroupMember.count({ where: { groupId: found.group.id, role: 'admin' } });
			if (adminCount <= 1) {
				sendError(res, 409, 'Die Gruppe braucht mindestens einen Administrator — ernenne zuerst eine andere Person.');
				return;
			}
		}
		await target.destroy();
		res.status(204).send();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
