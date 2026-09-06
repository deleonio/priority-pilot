import { Group, GroupInvitation } from '../models/index.js';

/**
 * Bestandsbereinigung verwaister Gruppen-Einladungen (#1251, AK7).
 *
 * Vor dieser Stelle ließen `DELETE /groups/:id` und `DELETE /groups/:id/members/:userId`
 * `group_invitations`-Zeilen zurück (Geister-Einträge mit leerem Gruppennamen in
 * `GET /invitations`). Die Routen räumen jetzt mit auf; diese Funktion bereinigt den
 * Altbestand einmalig idempotent beim Serverstart — verwaiste Zeilen (groupId ohne
 * existierende Gruppe) werden gelöscht, gültige Einladungen bleiben unberührt, ein
 * zweiter Lauf findet nichts mehr und ist damit ein No-Op.
 */
export const cleanupOrphanedGroupInvitations = async (): Promise<void> => {
	const invitations = await GroupInvitation.findAll();
	const groupIds = new Set((await Group.findAll()).map((group) => group.id));
	const orphanedIds = invitations
		.filter((invitation) => !groupIds.has(invitation.groupId))
		.map((invitation) => invitation.id);
	if (orphanedIds.length === 0) {
		return;
	}
	await GroupInvitation.destroy({ where: { id: orphanedIds } });
	console.log(`${orphanedIds.length} verwaiste Gruppen-Einladung(en) bereinigt.`);
};
