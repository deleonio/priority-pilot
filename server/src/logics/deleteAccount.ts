import { Op } from 'sequelize';
import sequelize from '../database.js';
import {
	AiUsage,
	ApiToken,
	Category,
	FcmToken,
	Group,
	GroupChallenge,
	GroupInvitation,
	GroupInviteLink,
	GroupMember,
	LlmProvider,
	LoginToken,
	MilestoneReached,
	MissedTask,
	NotificationLog,
	Pillar,
	PillarFeedback,
	PlaceFavorite,
	PushSubscription,
	Series,
	Subscription,
	Task,
	User,
} from '../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES } from '../models/subscription.js';
import { feedbackVaultConfig, githubObsidianClient, type ObsidianGithubClient } from './obsidianFeedback.js';
import CarePushToggle from '../models/carePushToggle.js';

export type DeleteAccountResult = 'deleted' | 'not_found' | 'subscription_active' | 'last_group_admin';

/**
 * Entfernt die Feedback-Dateien des Kontos (#1922) aus dem Vault; Treffer nur über die exakte
 * Frontmatter-Zeile `nutzer: "<email>"` (kein Substring). Ohne `FEEDBACK_GITHUB_TOKEN` kein Aufruf.
 */
const purgeUserFeedback = async (email: string, client: ObsidianGithubClient): Promise<void> => {
	if (!process.env.FEEDBACK_GITHUB_TOKEN?.trim()) return;
	const { repo, branch, dir } = feedbackVaultConfig();
	const line = `nutzer: ${JSON.stringify(email)}`;
	for (const file of await client.listFeedbackFiles(repo, branch, dir)) {
		if (file.content.split(/\r?\n/).includes(line)) await client.deleteFile(repo, branch, file.path, file.sha);
	}
};

/**
 * Löscht ein Konto samt persönlichen Daten (#1671, Play-Pflicht „Account deletion“). Abgelehnt wird,
 * solange ein Abo läuft oder aussteht (sonst bucht der Anbieter weiter ab) oder das Konto der letzte
 * Admin einer Gruppe mit weiteren Mitgliedern ist (Regel wie beim Austritt, `groups.ts`).
 *
 * Gruppen, in denen das Konto allein ist, entfallen mit ihm. Aufgaben und Serien, die es für andere
 * angelegt hat, bleiben bei diesen; die Ersteller-Bindung wird gelöst, fremde Serien ruhen wie nach
 * einem Austritt. Rechnungen und Abo-Datensätze bleiben wegen der Aufbewahrungspflicht (ADR 0013).
 * Aufgaben-Säulen, Abhängigkeiten und Punkte fallen per Fremdschlüssel mit den Aufgaben weg.
 * Feedback im Obsidian-Vault wird danach entfernt; scheitert das, bleibt das Konto gelöscht und der
 * Fehler landet im Log (ohne E-Mail-Adresse).
 */
export const deleteAccount = async (
	userId: number,
	{ feedbackClient = githubObsidianClient }: { feedbackClient?: ObsidianGithubClient } = {},
): Promise<DeleteAccountResult> => {
	const user = await User.findByPk(userId);
	if (!user) return 'not_found';
	if (await Subscription.count({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES } })) {
		return 'subscription_active';
	}

	const memberships = await GroupMember.findAll({ where: { userId } });
	const soleGroupIds: number[] = [];
	for (const membership of memberships) {
		const members = await GroupMember.findAll({ where: { groupId: membership.groupId } });
		if (members.length === 1) {
			soleGroupIds.push(membership.groupId);
		} else if (membership.role === 'admin' && !members.some((m) => m.userId !== userId && m.role === 'admin')) {
			return 'last_group_admin';
		}
	}

	await sequelize.transaction(async (transaction) => {
		const own = { where: { userId }, transaction };
		// Gruppen, in denen das Konto allein ist, samt offener Gruppenaufgaben.
		if (soleGroupIds.length > 0) {
			await Task.destroy({ where: { groupId: soleGroupIds, userId: null }, transaction });
			await GroupInvitation.destroy({ where: { groupId: soleGroupIds }, transaction });
			await GroupInviteLink.destroy({ where: { groupId: soleGroupIds }, transaction });
			await GroupChallenge.destroy({ where: { groupId: soleGroupIds }, transaction });
			await Group.destroy({ where: { id: soleGroupIds }, transaction });
		}
		// Für andere angelegte Aufgaben und Serien bleiben bei diesen; fremde Serien ruhen.
		// `userId: null` = offene Gruppenaufgabe; `Op.ne` allein erfasst NULL in SQL nicht.
		const forOthers = { createdById: userId, [Op.or]: [{ userId: { [Op.ne]: userId } }, { userId: null }] };
		await Task.update({ createdById: null }, { where: forOthers, transaction });
		await Series.update({ createdById: null, active: false }, { where: forOthers, transaction });

		await Task.destroy(own);
		await Series.destroy(own);
		await Pillar.destroy(own);
		await PillarFeedback.destroy(own);
		await Category.destroy(own);
		await LlmProvider.destroy(own);
		await ApiToken.destroy(own);
		await AiUsage.destroy(own);
		await PlaceFavorite.destroy(own);
		await MissedTask.destroy(own);
		await NotificationLog.destroy(own);
		await MilestoneReached.destroy(own);
		await PushSubscription.destroy(own);
		await FcmToken.destroy(own);
		await CarePushToggle.destroy(own);
		await GroupMember.destroy(own);
		await GroupInvitation.destroy({
			where: { [Op.or]: [{ invitedUserId: userId }, { invitedByUserId: userId }] },
			transaction,
		});
		await GroupInviteLink.destroy({ where: { createdByUserId: userId }, transaction });
		await LoginToken.destroy({ where: { email: user.email }, transaction });
		await user.destroy({ transaction });
	});
	try {
		await purgeUserFeedback(user.email, feedbackClient);
	} catch (error) {
		console.error(
			'Feedback des gelöschten Kontos konnte nicht entfernt werden:',
			error instanceof Error ? error.message : error,
		);
	}
	return 'deleted';
};
