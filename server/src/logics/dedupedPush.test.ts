import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import { sendDedupedPush, sendDedupedPushBulk } from './dedupedPush.js';

/**
 * Vertragstests für den gemeinsamen Dedupe-Helfer (#2551, Spec `docs/spec/issue-2551.md`): er
 * kapselt „schon gesendet? → senden → protokollieren“ für alle zehn Push-Pfade. Bricht die
 * Dedupe-Zusage, bekommen Nutzer dieselbe Nachricht erneut bzw. blockiert ein `sent: 0`-Log
 * dauerhaft jede Zustellung — beides fällt erst beim Nutzer auf, nicht im Code-Review.
 *
 * Push-Versand über den vorgesehenen Seam (`send`-Parameter), Muster wie
 * `taskCreatedNotification.test.ts`.
 */

const pushCalls: string[] = [];
const mockSend: PushSender = (_subscription, payload) => {
	pushCalls.push(payload);
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

/** Empfänger mit genau einer Push-Subscription — Voraussetzung dafür, dass überhaupt gesendet wird. */
const createRecipientWithSubscription = async (email: string): Promise<User> => {
	const recipient = await User.create({
		email,
		displayName: 'Empfänger',
		passwordHash: '__test__',
	});
	await PushSubscription.create({
		endpoint: `https://push.example/${email}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: recipient.id,
	});
	return recipient;
};

const payload = { title: 'Fällige Aufgabe', url: '/' };

describe('sendDedupedPush — gemeinsamer Push-Dedupe-Helfer (#2551)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('AK3a: erster Aufruf sendet und protokolliert genau einmal, zweiter mit gleichem kind+dedupeKey sendet nicht erneut', async () => {
		const recipient = await createRecipientWithSubscription('erstaufruf@example.com');

		const first = await sendDedupedPush(recipient.id, 'due-task', 'task-1:2026-10-14', payload, mockSend);

		assert.equal(first.sent, 1);
		assert.equal(pushCalls.length, 1);
		const logs = await NotificationLog.findAll({ where: { kind: 'due-task', dedupeKey: 'task-1:2026-10-14' } });
		assert.equal(logs.length, 1);
		assert.equal(logs[0].userId, recipient.id);

		await sendDedupedPush(recipient.id, 'due-task', 'task-1:2026-10-14', payload, mockSend);

		assert.equal(pushCalls.length, 1, 'zweiter Aufruf mit gleichem Schlüssel darf nicht erneut senden');
		const logsAfter = await NotificationLog.findAll({ where: { kind: 'due-task' } });
		assert.equal(logsAfter.length, 1, 'zweiter Aufruf darf keinen zweiten Log-Eintrag schreiben');
	});

	it('AK3a: gleicher kind, anderer dedupeKey sendet erneut — die Sperre gilt pro Schlüssel', async () => {
		const recipient = await createRecipientWithSubscription('schluessel@example.com');

		await sendDedupedPush(recipient.id, 'due-task', 'task-1:2026-10-14', payload, mockSend);
		await sendDedupedPush(recipient.id, 'due-task', 'task-2:2026-10-15', payload, mockSend);

		assert.equal(pushCalls.length, 2, 'anderer Schlüssel unter gleicher Art ist nicht geduped');
	});

	it('AK3b: sent: 0 (keine Subscription) schreibt keinen Log-Eintrag', async () => {
		const recipient = await User.create({
			email: 'ohne-subscription@example.com',
			displayName: 'Empfänger',
			passwordHash: '__test__',
		});

		const result = await sendDedupedPush(recipient.id, 'streak-reminder', 'user-7:2026-10-14', payload, mockSend);

		assert.equal(result.sent, 0);
		assert.equal(pushCalls.length, 0);
		const logs = await NotificationLog.findAll({ where: { kind: 'streak-reminder' } });
		assert.equal(logs.length, 0, 'ein Log bei sent: 0 würde den Schlüssel dauerhaft blockieren');
	});
});

describe('sendDedupedPushBulk — Bulk-Geschwister für gebündelte Push-Pfade (#2551, Review #2598)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('sendet einmal gebündelt und protokolliert einen Log-Eintrag je offenem Schlüssel', async () => {
		const recipient = await createRecipientWithSubscription('bulk-erstauftrag@example.com');

		const result = await sendDedupedPushBulk(
			recipient.id,
			'due-task',
			['task-1:2026-10-14T10:00:00.000Z', 'task-2:2026-10-14T11:00:00.000Z'],
			payload,
			mockSend,
		);

		assert.equal(result.sent, 1);
		assert.equal(pushCalls.length, 1, 'ein gebündelter Versand, nicht einer je Schlüssel');
		const logs = await NotificationLog.findAll({ where: { kind: 'due-task' } });
		assert.equal(logs.length, 2, 'genau ein Log-Eintrag je offenem Schlüssel');
	});

	it('zweiter Aufruf mit denselben Schlüsseln sendet nicht erneut und schreibt keine zweiten Einträge', async () => {
		const recipient = await createRecipientWithSubscription('bulk-zweitauftrag@example.com');
		const keys = ['task-1:2026-10-14T10:00:00.000Z', 'task-2:2026-10-14T11:00:00.000Z'];

		await sendDedupedPushBulk(recipient.id, 'due-task', keys, payload, mockSend);
		const second = await sendDedupedPushBulk(recipient.id, 'due-task', keys, payload, mockSend);

		assert.equal(second.sent, 0);
		assert.equal(pushCalls.length, 1, 'kein erneuter Versand');
		assert.equal(await NotificationLog.count(), 3, 'keine zweiten Log-Einträge (+1 Budget-Marker, #2853)');
	});
});
