import { Router } from 'express';
import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { sendError, type ErrorDto } from '../http-error.js';
import { Group, GroupInviteLink, GroupMember, User } from '../../models/index.js';
import sequelize from '../../database.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Einladungslink-Preisgabe (#1226). Dieser Router ist der ÖFFENTLICHE Teil: Er hängt bewusst
 * VOR dem globalen `requireAuth` (siehe express/index.ts, Muster `/api/transit`), damit ein
 * Link auch ohne Session geöffnet werden kann. Feldminimierung: geliefert werden nur
 * Gruppenname und Anzeigename des Einladenden — nie Mitglieder, nie E-Mails.
 *
 * Das Einlösen (`redeem`) braucht dagegen eine Session und prüft sie selbst (401), weil es
 * denselben öffentlichen Mount teilt.
 */

type PublicLinkDto = { name: string; invitedByName: string };

/** „Gültig" heißt: nicht widerrufen und nicht abgelaufen. */
const isUsable = (link: GroupInviteLink): boolean =>
	link.revokedAt === null && new Date(link.expiresAt).getTime() > Date.now();

export const inviteLinksPublicRouter = Router();

// GET /invite-links/:token — öffentliche Linkpreisgabe (AK2): unbekannt → 404, abgelaufen oder
// widerrufen → 410, gültig → 200 {name, invitedByName} (und NUR diese zwei Felder).
inviteLinksPublicRouter.get('/invite-links/:token', async (req: Request, res: Response<PublicLinkDto | ErrorDto>) => {
	try {
		const link = await GroupInviteLink.findOne({ where: { token: req.params.token } });
		if (!link) {
			sendError(res, 404, 'Einladungslink nicht gefunden.');
			return;
		}
		if (!isUsable(link)) {
			sendError(res, 410, 'Dieser Einladungslink ist nicht mehr gültig.');
			return;
		}
		const [group, inviter] = await Promise.all([Group.findByPk(link.groupId), User.findByPk(link.createdByUserId)]);
		if (!group || !inviter) {
			sendError(res, 410, 'Dieser Einladungslink ist nicht mehr gültig.');
			return;
		}
		res.json({ name: group.name, invitedByName: inviter.displayName });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /invite-links/:token/redeem — Link einlösen (AK3): Session-Pflicht (401 ohne), Mitglied
// wird in einer Transaktion `member` (keine Doppel-Zeile), bereits Mitglied → 409 — egal ob
// durch früheres Einlösen desselben Links oder anderweitig (persönliche Einladung).
inviteLinksPublicRouter.post(
	'/invite-links/:token/redeem',
	async (req: Request, res: Response<{ groupId: number } | ErrorDto>) => {
		try {
			const user = await resolveGeoUser(req);
			if (!user) {
				sendError(res, 401, 'Anmeldung erforderlich.');
				return;
			}
			const link = await GroupInviteLink.findOne({ where: { token: req.params.token } });
			if (!link) {
				sendError(res, 404, 'Einladungslink nicht gefunden.');
				return;
			}
			if (!isUsable(link)) {
				sendError(res, 410, 'Dieser Einladungslink ist nicht mehr gültig.');
				return;
			}
			let alreadyMember = false;
			await sequelize.transaction(async (transaction) => {
				// Membership-Check IN der Transaktion (Kreuzverhör #1246): Zwischen Prüfen und Einfügen
				// kann ein gleichzeitiger Zweit-Redeem liegen — der Composite-PK (groupId, userId)
				// fängt die Doppel-Zeile ab, der UniqueConstraintError wird unten genauso zu 409
				// gemeldet wie der hier vorab geprüfte Fall.
				const existing = await GroupMember.findOne({
					where: { groupId: link.groupId, userId: user.id },
					transaction,
				});
				if (existing) {
					alreadyMember = true;
					return;
				}
				await GroupMember.create(
					{ groupId: link.groupId, userId: user.id, role: 'member', joinedAt: new Date() },
					{ transaction },
				);
			});
			if (alreadyMember) {
				sendError(res, 409, 'Du bist bereits Mitglied dieser Gruppe.');
				return;
			}
			res.json({ groupId: link.groupId });
		} catch (error) {
			// Gleichzeitiger Zweit-Redeem verletzt den Composite-Primärschlüssel → 409 statt 500.
			if (error instanceof UniqueConstraintError) {
				sendError(res, 409, 'Du bist bereits Mitglied dieser Gruppe.');
				return;
			}
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
