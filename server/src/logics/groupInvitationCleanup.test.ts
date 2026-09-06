import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Group, GroupInvitation, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { cleanupOrphanedGroupInvitations } from './groupInvitationCleanup.js';

/**
 * Rote Spec-Tests für #1251 (AK7) — idempotente Bestandsbereinigung verwaister
 * Gruppen-Einladungen (Vertrag: docs/spec/issue-1251.md). Die Funktion
 * `cleanupOrphanedGroupInvitations` in server/src/logics/groupInvitationCleanup.ts
 * existiert noch nicht; der Aufruf beim Serverstart (server/index.ts) folgt in der
 * Impl-Phase. Rot = fehlendes Modul (neue Funktionalität). KEIN Produktivcode.
 */
describe('Bestandsbereinigung verwaister Gruppen-Einladungen (#1251, AK7)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('löscht verwaiste Einladungen, lässt gültige unberührt und ist beim zweiten Lauf ein No-Op', async () => {
		await User.create({ email: 'a@example.com', passwordHash: '__test__', displayName: 'A' });
		await User.create({ email: 'b@example.com', passwordHash: '__test__', displayName: 'B' });

		const inviter = await User.findOne({ where: { email: 'a@example.com' } });
		const invitee = await User.findOne({ where: { email: 'b@example.com' } });
		assert.ok(inviter && invitee, 'Setup: Nutzer müssen existieren');

		const group = await Group.create({ name: 'Besteht', description: null });
		const valid = await GroupInvitation.create({
			groupId: group.id,
			invitedUserId: invitee.id,
			invitedByUserId: inviter.id,
			status: 'pending',
			createdAt: new Date(),
		});
		const orphan = await GroupInvitation.create({
			groupId: group.id + 999, // groupId ohne existierende Gruppe
			invitedUserId: invitee.id,
			invitedByUserId: inviter.id,
			status: 'pending',
			createdAt: new Date(),
		});

		await cleanupOrphanedGroupInvitations();

		assert.ok(!(await GroupInvitation.findByPk(orphan.id)), 'AK7: verwaiste Einladung ist gelöscht');
		assert.ok(await GroupInvitation.findByPk(valid.id), 'AK7: gültige Einladung bleibt unberührt');

		await cleanupOrphanedGroupInvitations();
		assert.equal(
			await GroupInvitation.count(),
			1,
			'AK7: zweiter Lauf ändert nichts (idempotent, nur die gültige bleibt)',
		);
	});
});
