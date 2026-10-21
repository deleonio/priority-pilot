import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb } from '../test/helpers.js';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import type { PushSender } from './push.js';
import { notifyTaskCompleted } from './taskCompletedNotification.js';

/**
 * ROTE Spec-Tests für #1426 (SMTP-Feature) — TF5 (AK5), Vertrag: docs/spec/issue-1426.md.
 * `taskCompletedNotification.ts` hatte bisher keine eigene Testdatei; dieser Test deckt nur den
 * neuen Mail-Kanal ab (Push-Verhalten selbst ist unverändert, vgl. `dueTaskReminders.test.ts` /
 * `seriesGeneratedNotification.test.ts` für das etablierte Push-Muster). Kein Import von
 * `logics/mail.ts` (existiert noch nicht) — lokaler Stub + Cast (Muster: die beiden anderen
 * Trigger-Testdateien). KEIN Produktivcode.
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

type MailSenderStub = (payload: { to: string; subject: string; text: string }) => Promise<void>;
type NotifyTaskCompletedWithMail = (
	task: Parameters<typeof notifyTaskCompleted>[0],
	completer: Parameters<typeof notifyTaskCompleted>[1],
	send?: PushSender,
	mailSend?: MailSenderStub,
) => Promise<void>;
const notifyTaskCompletedWithMail = notifyTaskCompleted as unknown as NotifyTaskCompletedWithMail;

describe('notifyTaskCompleted — Mail-Kanal (#1426, TF5/AK5)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('AK5: verschickt zusätzlich zur Push-Nachricht genau eine Mail; ein Log-Eintrag für beide Kanäle', async () => {
		const creator = await User.create({
			email: 'creator@example.com',
			displayName: 'Aufgaben-Ersteller',
			passwordHash: '__test__',
		});
		await PushSubscription.create({
			endpoint: 'https://push.example/creator-1',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: creator.id,
		});
		const mailCalls: { to: string; subject: string; text: string }[] = [];
		const mailSend: MailSenderStub = (payload) => {
			mailCalls.push(payload);
			return Promise.resolve();
		};

		await notifyTaskCompletedWithMail(
			{ id: 1, title: 'Wäsche aufhängen', createdById: creator.id },
			{ displayName: 'Erlediger' },
			mockSend,
			mailSend,
		);

		assert.equal(pushCalls.length, 1, 'genau eine Push-Nachricht');
		assert.equal(mailCalls.length, 1, 'genau eine Mail zusätzlich zur Push-Nachricht');
		assert.equal(mailCalls[0].to, 'creator@example.com', 'Mail geht an den Ersteller (Empfänger der Erinnerung)');
		const logs = await NotificationLog.findAll({ where: { kind: 'task-completed' } });
		assert.equal(logs.length, 1, 'ein NotificationLog-Eintrag pro Auslöser, nicht pro Kanal');
	});
});

// Rote Spec-Tests für #2849 (Spec docs/spec/issue-2849.md): Ruhezeit 21–7 Uhr Nutzer-Zeitzone —
// kein Push, kein NotificationLog. KEIN Produktivcode.
describe('notifyTaskCompleted — Ruhezeit (#2849 AK4)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(closeDb);

	it('23:00 lokal (Berlin): kein Push, kein Log — 07:00 lokal: Zustellung wie bisher', async () => {
		const creator = await User.create({
			email: 'ruhe-completed@example.com',
			displayName: 'Ersteller',
			passwordHash: '__test__',
			zeitzone: 'Europe/Berlin',
		} as never);
		await PushSubscription.create({
			endpoint: 'https://push.example/ruhe-completed',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: creator.id,
		});

		mock.timers.enable({ apis: ['Date'] });
		try {
			mock.timers.setTime(new Date('2026-07-07T21:00:00Z').getTime()); // 23:00 Berlin
			await notifyTaskCompleted(
				{ id: 801, title: 'Nachts erledigt', createdById: creator.id },
				{ displayName: 'Ben' },
				mockSend,
			);
			assert.equal(pushCalls.length, 0, 'Ruhezeit: kein Push');
			assert.equal(await NotificationLog.count(), 0, 'Ruhezeit: kein NotificationLog-Eintrag');

			mock.timers.setTime(new Date('2026-07-07T05:00:00Z').getTime()); // 07:00 Berlin
			await notifyTaskCompleted(
				{ id: 802, title: 'Morgens erledigt', createdById: creator.id },
				{ displayName: 'Ben' },
				mockSend,
			);
			assert.equal(pushCalls.length, 1, '07:00 lokal: Zustellung wie bisher');
			assert.equal(await NotificationLog.count({ where: { kind: 'task-completed' } }), 1);
		} finally {
			mock.timers.reset();
		}
	});
});
