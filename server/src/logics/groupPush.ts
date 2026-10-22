import { Op } from 'sequelize';
import { Group, GroupChallenge, GroupInvitation, GroupMember, User } from '../models/index.js';
import { istRuhezeit } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { PUSH_TARGETS } from './pushTargets.js';
import { nutzerZeitzone } from './streak.js';

/**
 * Fachliche Gruppen-Pushes (#2854, Konzept §7.2): vier beobachtbare Ereignisse — Einladung
 * erhalten, neues Mitglied, Challenge-Start/-Ende. Sofort-Trigger nach dem Muster
 * {@link ./taskCreatedNotification.js} (Empfängerdaten über `User.findByPk`, Schalter
 * `users.groupPushEnabled` aus → kein Versand, kein Log), der stündliche Sweep
 * {@link runGroupPush} nach dem Muster {@link ./aboPush.js} (Einladungs-Nachhol + Challenge-Ende).
 * Dedupe/Zustellung/Budget laufen über {@link sendDedupedPush}; Ruhezeit (21–7 Ortszeit) prüft
 * NUR der Einladungs-Push (AK2) — sein Skip schreibt bewusst keinen Log-Eintrag, sonst würde der
 * blockierte Lauf die Nachholung im Tagesfenster wegdeduppen. Challenge-Keys tragen den
 * Mitglied-Suffix, sonst dedupet Mitglied 2 den Push von Mitglied 1 weg (globales UNIQUE).
 */

const KIND_EINLADUNG = 'group-invitation';
const KIND_MITGLIED = 'group-member';
const KIND_CHALLENGE = 'group-challenge';

/** Titel/Text je Empfänger-Sprache — `body` erhält Einladenden/Beigetretenen + Gruppe (§7.2). */
type PersonenTexte = Record<CareSprache, { title: string; body: (name: string, gruppe: string) => string }>;

/** Titel/Text der Challenge-Ereignisse — `body` erhält nur die Gruppe. */
type ChallengeTexte = Record<CareSprache, { title: string; body: (gruppe: string) => string }>;

const TEXTE = {
	einladung: {
		de: {
			title: 'Gruppeneinladung',
			body: (name: string, gruppe: string) => `${name} lädt dich in die Gruppe „${gruppe}“ ein.`,
		},
		en: {
			title: 'Group invitation',
			body: (name: string, gruppe: string) => `${name} invites you to the group "${gruppe}".`,
		},
	} satisfies PersonenTexte,
	mitglied: {
		de: {
			title: 'Neues Gruppenmitglied',
			body: (name: string, gruppe: string) => `${name} ist jetzt in „${gruppe}“ dabei.`,
		},
		en: { title: 'New group member', body: (name: string, gruppe: string) => `${name} has joined "${gruppe}".` },
	} satisfies PersonenTexte,
	challengeStart: {
		de: {
			title: 'Challenge gestartet',
			body: (gruppe: string) => `Eine 7-Tage-Challenge in „${gruppe}“ hat begonnen.`,
		},
		en: { title: 'Challenge started', body: (gruppe: string) => `A 7-day challenge in "${gruppe}" has started.` },
	} satisfies ChallengeTexte,
	challengeEnde: {
		de: { title: 'Challenge beendet', body: (gruppe: string) => `Die 7-Tage-Challenge in „${gruppe}“ ist zu Ende.` },
		en: { title: 'Challenge finished', body: (gruppe: string) => `The 7-day challenge in "${gruppe}" has ended.` },
	} satisfies ChallengeTexte,
};

/** Die Einladung (Schnappschuss) — Gruppenname/Einladender stellt der Aufrufer bereit. */
export interface EinladungsPush {
	id: number;
	groupId: number;
	groupName: string;
	invitedUserId: number;
	invitedByName: string;
}

/** Die Gruppe (Ausschnitt) für Beitritts- und Challenge-Texte. */
export interface GruppeKurz {
	id: number;
	name: string;
}

/** Der Beigetretene (Ausschnitt) für den Beitritts-Text. */
export interface PersonKurz {
	id: number;
	displayName: string;
}

/** Empfängerdaten (Sprache, Zeitzone, Schalter) — `undefined` ohne Konto. */
const ladeEmpfaenger = (userId: number) =>
	User.findByPk(userId, { attributes: ['sprache', 'zeitzone', 'groupPushEnabled'] });

/**
 * Benachrichtigt die eingeladene Person (AK1). Ruhezeit 21–7 Ortszeit des Empfängers: kein
 * Versand, kein Log (AK2) — der stündliche Sweep {@link runGroupPush} holt nach, solange die
 * Einladung `pending` ist.
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 * @param now Auswertungszeitpunkt der Ruhezeit (Sweep reicht seinen Tick durch).
 */
export const notifyGroupInvitation = async (
	invitation: EinladungsPush,
	send?: PushSender,
	now: Date = new Date(),
): Promise<{ sent: number }> => {
	const empfaenger = await ladeEmpfaenger(invitation.invitedUserId);
	// #2854 AK5: Gruppenschalter aus → kein Push, kein Log (Muster taskCreatedNotification).
	if (empfaenger?.groupPushEnabled === false) {
		return { sent: 0 };
	}
	if (istRuhezeit(now, nutzerZeitzone(empfaenger?.zeitzone))) {
		return { sent: 0 };
	}
	const texte = TEXTE.einladung[spracheVon(empfaenger?.sprache)];
	return sendDedupedPush(
		invitation.invitedUserId,
		KIND_EINLADUNG,
		`invitation:${invitation.id}`,
		{
			title: texte.title,
			body: texte.body(invitation.invitedByName, invitation.groupName),
			url: PUSH_TARGETS.groupInvitations,
		},
		send,
		now,
	);
};

/**
 * Benachrichtigt den Einladenden (Annahme) bzw. den Link-Ersteller (Einlösen) über das neue
 * Mitglied (AK3) — kein Ruhezeit-Gate (AK2 nennt nur die Einladung).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyGroupMember = async (
	group: GruppeKurz,
	beigetreten: PersonKurz,
	empfaengerId: number,
	send?: PushSender,
): Promise<void> => {
	const empfaenger = await ladeEmpfaenger(empfaengerId);
	if (empfaenger?.groupPushEnabled === false) {
		return;
	}
	const texte = TEXTE.mitglied[spracheVon(empfaenger?.sprache)];
	await sendDedupedPush(
		empfaengerId,
		KIND_MITGLIED,
		`member:${group.id}:${beigetreten.id}`,
		{
			title: texte.title,
			body: texte.body(beigetreten.displayName, group.name),
			url: PUSH_TARGETS.groupDetail(group.id),
		},
		send,
	);
};

/**
 * Benachrichtigt nach dem Challenge-Start jedes Gruppenmitglied genau einmal (AK4) — kein
 * Ruhezeit-Gate; ein Start in der Ruhezeit fällt still aus (kein Nachholen, §3-Ausnahme gilt
 * nur der Einladung).
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyChallengeStarted = async (
	challenge: { id: number; groupId: number },
	send?: PushSender,
): Promise<void> => {
	const group = await Group.findByPk(challenge.groupId, { attributes: ['id', 'name'] });
	if (!group) {
		return;
	}
	const texteVon = (sprache: string | null | undefined) => TEXTE.challengeStart[spracheVon(sprache)];
	const mitglieder = await GroupMember.findAll({ where: { groupId: challenge.groupId } });
	for (const mitglied of mitglieder) {
		const empfaenger = await ladeEmpfaenger(mitglied.userId);
		if (empfaenger?.groupPushEnabled === false) {
			continue;
		}
		const texte = texteVon(empfaenger?.sprache);
		await sendDedupedPush(
			mitglied.userId,
			KIND_CHALLENGE,
			// Mitglied-Suffix: ohne ihn dedupet Mitglied 2 den Push von Mitglied 1 weg (globales UNIQUE).
			`challenge-start:${challenge.id}:${mitglied.userId}`,
			{ title: texte.title, body: texte.body(group.name), url: PUSH_TARGETS.groupDetail(group.id) },
			send,
		);
	}
};

/**
 * Stündlicher Gruppen-Sweep: (a) pending-Einladungen ohne Log-Eintrag nachholen (AK2 — der
 * Einladungs-Push prüft die Ruhezeit selbst, hier mit dem Tick als `now`), (b) je beendeter
 * Challenge (`endsAt` erreicht) jedes Mitglied einmal benachrichtigen (AK4). Laufende
 * Challenges und Zwischenstände senden nichts; die Dedupe-Keys blockieren Wiederholungen.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runGroupPush = async (now: Date = new Date(), send?: PushSender): Promise<{ sends: number }> => {
	let sends = 0;

	const pendingInvitations = await GroupInvitation.findAll({ where: { status: 'pending' } });
	for (const invitation of pendingInvitations) {
		const [group, inviter] = await Promise.all([
			Group.findByPk(invitation.groupId, { attributes: ['id', 'name'] }),
			User.findByPk(invitation.invitedByUserId, { attributes: ['displayName', 'email'] }),
		]);
		if (!group || !inviter) {
			continue;
		}
		const { sent } = await notifyGroupInvitation(
			{
				id: invitation.id,
				groupId: invitation.groupId,
				groupName: group.name,
				invitedUserId: invitation.invitedUserId,
				invitedByName: inviter.displayName ?? inviter.email ?? '',
			},
			send,
			now,
		);
		if (sent > 0) {
			sends += 1;
		}
	}

	const beendeteChallenges = await GroupChallenge.findAll({ where: { endsAt: { [Op.lte]: now } } });
	for (const challenge of beendeteChallenges) {
		const group = await Group.findByPk(challenge.groupId, { attributes: ['id', 'name'] });
		if (!group) {
			continue;
		}
		const mitglieder = await GroupMember.findAll({ where: { groupId: challenge.groupId } });
		for (const mitglied of mitglieder) {
			const empfaenger = await ladeEmpfaenger(mitglied.userId);
			if (empfaenger?.groupPushEnabled === false) {
				continue;
			}
			const texte = TEXTE.challengeEnde[spracheVon(empfaenger?.sprache)];
			const { sent } = await sendDedupedPush(
				mitglied.userId,
				KIND_CHALLENGE,
				`challenge-end:${challenge.id}:${mitglied.userId}`,
				{ title: texte.title, body: texte.body(group.name), url: PUSH_TARGETS.groupDetail(group.id) },
				send,
				now,
			);
			if (sent > 0) {
				sends += 1;
			}
		}
	}
	return { sends };
};
