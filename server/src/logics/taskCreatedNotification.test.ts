import { describe, it, beforeEach, afterEach, after, mock } from 'node:test';
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
	// #2849 (Test-Pflege): das Ruhezeit-Gate blockt zone-lose Nutzer (UTC-Fallback) zwischen 21 und 7 —
	// die Suite läuft deshalb mit fester Tageszeit statt echter Wanduhr, sonst wäre sie uhrenabhängig.
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
	after(closeDb);

	it('sendet genau eine Nachricht mit Aufgabentitel und Anzeigename des Erstellers', async () => {
		const recipient = await createRecipientWithSubscription();
		const task = { id: 1, title: 'Wäsche aufhängen', userId: recipient.id };

		await notifyTaskCreated(task, { displayName: 'Anna' }, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0].body) as { title: string; body: string; url: string };
		assert.match(payload.title, /Anna/);
		assert.match(payload.body, /Wäsche aufhängen/);
		assert.equal(payload.url, `/tasks/${task.id}`, '#2851 AK3: Deep-Link zur neu angelegten Aufgabe');
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

// Rote Spec-Tests für #2849 (Spec docs/spec/issue-2849.md): Ereignis-Push bleibt in der
// Ruhezeit (lokale Stunde 21–23, 0–6) aus — kein Versand, kein NotificationLog. KEIN Produktivcode.
describe('notifyTaskCreated — Ruhezeit (#2849 AK4)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('23:00 lokal (Berlin): kein Push, kein Log — 07:00 lokal: Zustellung wie bisher', async () => {
		const recipient = await User.create({
			email: 'ruhe-created@example.com',
			displayName: 'Ruhe',
			passwordHash: '__test__',
			zeitzone: 'Europe/Berlin',
		} as never);
		await PushSubscription.create({
			endpoint: 'https://push.example/ruhe-created',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: recipient.id,
		});

		mock.timers.enable({ apis: ['Date'] });
		try {
			mock.timers.setTime(new Date('2026-07-07T21:00:00Z').getTime()); // 23:00 Berlin
			await notifyTaskCreated(
				{ id: 901, title: 'Nachts angelegt', userId: recipient.id },
				{ displayName: 'Anna' },
				mockSend,
			);
			assert.equal(pushCalls.length, 0, 'Ruhezeit: kein Push');
			assert.equal(await NotificationLog.count(), 0, 'Ruhezeit: kein NotificationLog-Eintrag');

			mock.timers.setTime(new Date('2026-07-07T05:00:00Z').getTime()); // 07:00 Berlin
			await notifyTaskCreated(
				{ id: 902, title: 'Morgens angelegt', userId: recipient.id },
				{ displayName: 'Anna' },
				mockSend,
			);
			assert.equal(pushCalls.length, 1, '07:00 lokal: Zustellung wie bisher');
			assert.equal(await NotificationLog.count({ where: { kind: 'task-created' } }), 1);
		} finally {
			mock.timers.reset();
		}
	});

	it('AK5: ohne Zeitzone gilt die Ruhezeit in UTC — 22:30Z keiner, 09:00Z ja', async () => {
		const recipient = await User.create({
			email: 'ruhe-created-utc@example.com',
			displayName: 'Ruhe UTC',
			passwordHash: '__test__',
		});
		await PushSubscription.create({
			endpoint: 'https://push.example/ruhe-created-utc',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: recipient.id,
		});

		mock.timers.enable({ apis: ['Date'] });
		try {
			mock.timers.setTime(new Date('2026-07-07T22:30:00Z').getTime()); // UTC 22:30 — Ruhezeit
			await notifyTaskCreated({ id: 903, title: 'UTC nachts', userId: recipient.id }, null, mockSend);
			assert.equal(pushCalls.length, 0, 'UTC-Ruhezeit: kein Push');
			assert.equal(await NotificationLog.count(), 0);

			mock.timers.setTime(new Date('2026-07-08T09:00:00Z').getTime()); // UTC 09:00 — erlaubt
			await notifyTaskCreated({ id: 904, title: 'UTC morgens', userId: recipient.id }, null, mockSend);
			assert.equal(pushCalls.length, 1);
		} finally {
			mock.timers.reset();
		}
	});
});
