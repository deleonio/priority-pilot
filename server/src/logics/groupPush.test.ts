import { afterEach, after, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import {
	Group,
	GroupChallenge,
	GroupInvitation,
	GroupMember,
	NotificationLog,
	PushSubscription,
	User,
} from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import { notifyChallengeStarted, notifyGroupInvitation, notifyGroupMember, runGroupPush } from './groupPush.js';

/**
 * Rote Spec-Tests für #2854 — Gruppen-Pushes (Einladung, Beitritt, Challenge-Start/-Ende).
 * Vertrag: docs/spec/issue-2854.md. Versand über den injizierten Sender-Seam (Muster
 * taskCreatedNotification.test.ts); Dedupe/Zustellung laufen über sendDedupedPush (NotificationLog).
 */

interface SentPush {
	endpoint: string;
	body: string;
}

const pushCalls: SentPush[] = [];
const mockSend: PushSender = (subscription, payload) => {
	pushCalls.push({ endpoint: subscription.endpoint, body: payload });
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

interface EmpfängerOptionen {
	zeitzone?: string;
	groupPushEnabled?: boolean;
}

/** Nutzer mit genau einer Push-Subscription — die Voraussetzung dafür, dass überhaupt gesendet wird. */
const createRecipient = async (email: string, optionen: EmpfängerOptionen = {}): Promise<User> => {
	const user = await User.create({
		email,
		displayName: email.split('@')[0] ?? email,
		passwordHash: '__test__',
		...(optionen.zeitzone ? { zeitzone: optionen.zeitzone } : {}),
		...(optionen.groupPushEnabled !== undefined ? { groupPushEnabled: optionen.groupPushEnabled } : {}),
	});
	await PushSubscription.create({
		endpoint: `https://push.example/${email}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: user.id,
	});
	return user;
};

const createGroup = (name: string): Promise<Group> => Group.create({ name });

const addMember = (groupId: number, userId: number): Promise<GroupMember> =>
	GroupMember.create({ groupId, userId, role: 'member', joinedAt: new Date() });

describe('groupPush — Gruppen-Pushes (#2854)', () => {
	// Ruhezeit-Gate (nur Einladung): Suite läuft mit fester Tageszeit statt echter Wanduhr,
	// sonst wäre sie zwischen 21 und 7 UTC uhrenabhängig (Muster taskCreatedNotification.test.ts).
	beforeEach(() => {
		mock.timers.enable({ apis: ['Date'] });
		mock.timers.setTime(new Date('2026-07-07T10:00:00Z').getTime());
	});
	afterEach(() => {
		mock.timers.reset();
	});
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: Einladung sendet genau einen Push (kind group-invitation, dedupeKey invitation:<id>, Anker-Ziel) und kein zweites Mal', async () => {
		const group = await createGroup('Familie');
		const bob = await createRecipient('bob@example.com');

		await notifyGroupInvitation(
			{ id: 11, groupId: group.id, groupName: 'Familie', invitedUserId: bob.id, invitedByName: 'Anna' },
			mockSend,
		);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0].body) as { title: string; body: string; url: string };
		assert.match(payload.body, /Familie/);
		assert.match(payload.body, /Anna/);
		assert.equal(payload.url, '/settings/gruppen#einladungen', 'AK7: Sprungziel der Einladungs-Karte');
		const log = await NotificationLog.findOne({ where: { kind: 'group-invitation', dedupeKey: 'invitation:11' } });
		assert.ok(log, 'Einladungs-Push muss mit dedupeKey invitation:<id> protokolliert sein');

		await notifyGroupInvitation(
			{ id: 11, groupId: group.id, groupName: 'Familie', invitedUserId: bob.id, invitedByName: 'Anna' },
			mockSend,
		);
		assert.equal(pushCalls.length, 1, 'erneuter Lauf sendet nichts (Dedupe über NotificationLog)');
	});

	it('AK2: Einladungs-Push in der Ruhezeit (21–7 Ortszeit) sendet nichts und protokolliert nichts', async () => {
		mock.timers.setTime(new Date('2026-07-07T23:30:00Z').getTime());
		const group = await createGroup('Familie');
		const bob = await createRecipient('bob@example.com');

		await notifyGroupInvitation(
			{ id: 12, groupId: group.id, groupName: 'Familie', invitedUserId: bob.id, invitedByName: 'Anna' },
			mockSend,
		);

		assert.equal(pushCalls.length, 0);
		assert.equal(await NotificationLog.count({ where: { kind: 'group-invitation' } }), 0);
	});

	it('AK2: der erste Sweep nach der Ruhezeit holt nach, solange die Einladung pending ist — danach nichts mehr', async () => {
		const group = await createGroup('Familie');
		const bob = await createRecipient('bob@example.com');
		const alice = await User.create({ email: 'alice@example.com', displayName: 'Alice', passwordHash: '__test__' });
		await GroupInvitation.create({
			groupId: group.id,
			invitedUserId: bob.id,
			invitedByUserId: alice.id,
			status: 'pending',
			createdAt: new Date(),
		});

		const erster = await runGroupPush(new Date('2026-07-08T10:00:00Z'), mockSend);
		assert.equal(erster.sends, 1, 'Nachhol-Sweep stellt die Einladung zu');
		assert.equal(pushCalls.length, 1);
		assert.equal(JSON.parse(pushCalls[0].body).url, '/settings/gruppen#einladungen');

		const zweiter = await runGroupPush(new Date('2026-07-08T11:00:00Z'), mockSend);
		assert.equal(zweiter.sends, 0, 'zweiter Tick sendet nichts (Dedupe über invitation:<id>)');
		assert.equal(pushCalls.length, 1);
	});

	it('AK2: erledigte Einladungen (accepted/declined) holt der Sweep nicht nach', async () => {
		const group = await createGroup('Familie');
		const bob = await createRecipient('bob@example.com');
		await GroupInvitation.create({
			groupId: group.id,
			invitedUserId: bob.id,
			invitedByUserId: bob.id,
			status: 'declined',
			createdAt: new Date(),
		});

		const ergebnis = await runGroupPush(new Date(), mockSend);
		assert.equal(ergebnis.sends, 0);
		assert.equal(pushCalls.length, 0);
	});

	it('AK4: Challenge-Start sendet je Mitglied genau einen Push (challenge-start:<id>:<mitglied>)', async () => {
		const group = await createGroup('Familie');
		const [anna, ben, carla] = await Promise.all([
			createRecipient('anna@example.com'),
			createRecipient('ben@example.com'),
			createRecipient('carla@example.com'),
		]);
		await Promise.all([anna, ben, carla].map((mitglied) => addMember(group.id, mitglied.id)));

		await notifyChallengeStarted({ id: 5, groupId: group.id }, mockSend);

		assert.equal(pushCalls.length, 3, 'je Mitglied genau ein Push');
		const keys = await NotificationLog.findAll({ where: { kind: 'group-challenge' } });
		assert.deepEqual(
			keys.map((row) => row.dedupeKey).sort(),
			['challenge-start:5:1', 'challenge-start:5:2', 'challenge-start:5:3'].sort(),
			'Mitglied-Suffix im Key, sonst dedupet Mitglied 2 den Push von Mitglied 1 weg',
		);
		for (const call of pushCalls) {
			assert.equal(JSON.parse(call.body).url, `/settings/gruppen#gruppe-${group.id}`);
		}

		await notifyChallengeStarted({ id: 5, groupId: group.id }, mockSend);
		assert.equal(pushCalls.length, 3, 'erneuter Lauf sendet nichts');
	});

	it('AK4: Challenge-Ende liefert der stündliche Sweep (endsAt erreicht) je Mitglied genau einen Push; laufende Challenges und Wiederholung senden nichts', async () => {
		const group = await createGroup('Familie');
		const [anna, ben] = await Promise.all([createRecipient('anna@example.com'), createRecipient('ben@example.com')]);
		await Promise.all([anna, ben].map((mitglied) => addMember(group.id, mitglied.id)));
		const jetzt = new Date('2026-07-08T10:00:00Z');
		const beendet = await GroupChallenge.create({
			groupId: group.id,
			startsAt: new Date(jetzt.getTime() - 8 * 24 * 60 * 60 * 1000),
			endsAt: new Date(jetzt.getTime() - 24 * 60 * 60 * 1000),
		});
		await GroupChallenge.create({
			groupId: group.id,
			startsAt: jetzt,
			endsAt: new Date(jetzt.getTime() + 7 * 24 * 60 * 60 * 1000),
		});

		const erster = await runGroupPush(jetzt, mockSend);
		assert.equal(erster.sends, 2, 'nur die beendete Challenge sendet, je Mitglied einmal');
		const keys = (await NotificationLog.findAll({ where: { kind: 'group-challenge' } })).filter((row) =>
			row.dedupeKey.startsWith(`challenge-end:${beendet.id}:`),
		);
		assert.equal(keys.length, 2);
		for (const call of pushCalls) {
			assert.equal(JSON.parse(call.body).url, `/settings/gruppen#gruppe-${group.id}`);
		}

		const zweiter = await runGroupPush(new Date(jetzt.getTime() + 60 * 60 * 1000), mockSend);
		assert.equal(zweiter.sends, 0, 'zweiter Tick sendet nichts');
	});

	it('AK5: groupPushEnabled=false unterdrückt alle vier Ereignisse — kein Versand, kein NotificationLog-Eintrag', async () => {
		const group = await createGroup('Familie');
		const stumm = await createRecipient('stumm@example.com', { groupPushEnabled: false });
		const ben = await createRecipient('ben@example.com');
		await Promise.all([stumm, ben].map((mitglied) => addMember(group.id, mitglied.id)));

		await notifyGroupInvitation(
			{ id: 21, groupId: group.id, groupName: 'Familie', invitedUserId: stumm.id, invitedByName: 'Anna' },
			mockSend,
		);
		await notifyGroupMember(group, { id: ben.id, displayName: 'Ben' }, stumm.id, mockSend);
		await notifyChallengeStarted({ id: 9, groupId: group.id }, mockSend);
		await GroupChallenge.create({
			groupId: group.id,
			startsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
			endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
		});
		await GroupMember.destroy({ where: { groupId: group.id, userId: ben.id } });
		await runGroupPush(new Date(), mockSend);

		const sendsAnStumm = pushCalls.filter((call) => call.endpoint === 'https://push.example/stumm@example.com');
		assert.equal(sendsAnStumm.length, 0, 'kein Push an den stummen Empfänger aus irgendeinem der vier Ereignisse');
		assert.equal(await NotificationLog.count({ where: { userId: stumm.id } }), 0);
	});

	it('AK1 (#2879): Challenge, die vor mehr als 7 Tagen endete, versendet weder Push noch NotificationLog', async () => {
		const group = await createGroup('Zu alt');
		const anna = await createRecipient('anna@example.com');
		await addMember(group.id, anna.id);
		const jetzt = new Date('2026-07-08T10:00:00Z');
		await GroupChallenge.create({
			groupId: group.id,
			startsAt: new Date(jetzt.getTime() - 15 * 24 * 60 * 60 * 1000),
			endsAt: new Date(jetzt.getTime() - 8 * 24 * 60 * 60 * 1000),
		});

		const ergebnis = await runGroupPush(jetzt, mockSend);

		assert.equal(ergebnis.sends, 0, 'Rückstands-Schutz: Challenge außerhalb des 7-Tage-Fensters lädt der Sweep nicht');
		assert.equal(pushCalls.length, 0);
		assert.equal(
			await NotificationLog.count({ where: { kind: 'group-challenge' } }),
			0,
			'ohne Sendeversuch auch kein Dedupe-Eintrag',
		);
	});

	it('AK2 (#2879): das 7-Tage-Fenster ist inklusiv — genau 7 Tage alte Challenge sendet noch, ältere nicht', async () => {
		const gruppeGrenze = await createGroup('Grenze');
		const gruppeAlt = await createGroup('Zu alt');
		const [anna, ben] = await Promise.all([createRecipient('anna@example.com'), createRecipient('ben@example.com')]);
		await addMember(gruppeGrenze.id, anna.id);
		await addMember(gruppeAlt.id, ben.id);
		const jetzt = new Date('2026-07-08T10:00:00Z');
		const grenze = await GroupChallenge.create({
			groupId: gruppeGrenze.id,
			startsAt: new Date(jetzt.getTime() - 14 * 24 * 60 * 60 * 1000),
			endsAt: new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000),
		});
		const zuAlt = await GroupChallenge.create({
			groupId: gruppeAlt.id,
			startsAt: new Date(jetzt.getTime() - 15 * 24 * 60 * 60 * 1000),
			endsAt: new Date(jetzt.getTime() - 8 * 24 * 60 * 60 * 1000),
		});

		const ergebnis = await runGroupPush(jetzt, mockSend);

		assert.equal(ergebnis.sends, 1, 'nur die exakt 7 Tage alte Challenge liegt noch im Fenster');
		const keys = await NotificationLog.findAll({ where: { kind: 'group-challenge' } });
		assert.equal(keys.length, 1, 'genau ein Log: die Grenz-Challenge');
		assert.equal(keys[0]?.dedupeKey, `challenge-end:${grenze.id}:${anna.id}`);
		assert.equal(
			keys.some((row) => row.dedupeKey.startsWith(`challenge-end:${zuAlt.id}:`)),
			false,
			'die ältere Challenge bleibt ohne Log',
		);
	});
});
