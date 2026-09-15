import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import { notifyTaskCreated } from './taskCreatedNotification.js';

/**
 * Tests für den Trigger „Aufgabe von jemand anderem angelegt" (#1224), ergänzt für #1471/F-6.
 * Die Dedupe-Zusage („pro Aufgabe höchstens eine Nachricht") fällt nicht von selbst auf, wenn sie
 * bricht: Der Empfänger bekommt dann bei jedem erneuten Auslösen dieselbe Push-Nachricht.
 *
 * Push-Versand über den vorgesehenen Seam (`send`-Parameter), Muster wie
 * `taskCompletedNotification.test.ts` / `seriesGeneratedNotification.test.ts`.
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

/** Empfänger mit genau einer Push-Subscription — die Voraussetzung dafür, dass überhaupt gesendet wird. */
const createRecipientWithSubscription = async (): Promise<User> => {
	const recipient = await User.create({
		email: 'empfaenger@example.com',
		displayName: 'Empfänger',
		passwordHash: '__test__',
	});
	await PushSubscription.create({
		endpoint: 'https://push.example/empfaenger-1',
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: recipient.id,
	});
	return recipient;
};

describe('notifyTaskCreated — Push bei fremd angelegter Aufgabe (#1224)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('sendet genau eine Nachricht mit Aufgabentitel und Anzeigename des Erstellers', async () => {
		const recipient = await createRecipientWithSubscription();

		await notifyTaskCreated(
			{ id: 1, title: 'Wäsche aufhängen', userId: recipient.id },
			{ displayName: 'Anna' },
			mockSend,
		);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0].body) as { title: string; body: string; url: string };
		assert.match(payload.title, /Anna/);
		assert.match(payload.body, /Wäsche aufhängen/);
		assert.equal(payload.url, '/');
	});

	it('ohne bekannten Ersteller steht „Jemand" in der Nachricht', async () => {
		const recipient = await createRecipientWithSubscription();

		await notifyTaskCreated({ id: 2, title: 'Müll rausbringen', userId: recipient.id }, null, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0].body) as { title: string };
		assert.match(payload.title, /Jemand/);
	});

	it('protokolliert den Versand mit kind „task-created" und der Task-Id als dedupeKey', async () => {
		const recipient = await createRecipientWithSubscription();

		await notifyTaskCreated({ id: 3, title: 'Einkaufen', userId: recipient.id }, { displayName: 'Anna' }, mockSend);

		const log = await NotificationLog.findOne({ where: { kind: 'task-created', dedupeKey: '3' } });
		assert.ok(log, 'Es sollte ein NotificationLog-Eintrag für die Aufgabe existieren');
		assert.equal(log.userId, recipient.id);
	});

	it('dieselbe Aufgabe meldet kein zweites Mal', async () => {
		const recipient = await createRecipientWithSubscription();
		const task = { id: 4, title: 'Fenster putzen', userId: recipient.id };

		await notifyTaskCreated(task, { displayName: 'Anna' }, mockSend);
		await notifyTaskCreated(task, { displayName: 'Anna' }, mockSend);

		assert.equal(pushCalls.length, 1, 'Der zweite Aufruf darf nicht erneut senden');
		assert.equal(await NotificationLog.count({ where: { kind: 'task-created', dedupeKey: '4' } }), 1);
	});

	it('ohne Empfänger-Subscription wird nichts protokolliert — der Versuch bleibt wiederholbar', async () => {
		const recipient = await User.create({
			email: 'ohne-push@example.com',
			displayName: 'Ohne Push',
			passwordHash: '__test__',
		});

		await notifyTaskCreated({ id: 5, title: 'Staubsaugen', userId: recipient.id }, { displayName: 'Anna' }, mockSend);

		assert.equal(pushCalls.length, 0);
		assert.equal(await NotificationLog.count({ where: { kind: 'task-created', dedupeKey: '5' } }), 0);
	});
});
