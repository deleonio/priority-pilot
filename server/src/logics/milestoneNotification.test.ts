import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, applyTestAuthEnv } from '../test/helpers.js';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import type { PushSender } from './push.js';
// @ts-expect-error — Modul existiert noch nicht (roter Spec-Test, #1363).
import { notifyReachedMilestones } from './milestoneNotification.js';

/**
 * Rote Spec-Tests für #1363 — lobende Push-Meldung bei neu erreichten Meilensteinen
 * (Vertrag: docs/spec/issue-1363.md, TF3–TF5 für AK3–AK5).
 *
 * Rot, bis `milestoneNotification.ts` `notifyReachedMilestones(userId, vorher, nachher, send?)`
 * exportiert. KEIN Produktivcode in dieser Spec-Phase.
 */
applyTestAuthEnv('milestone-notification-test');
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

interface Meilenstein {
	schluessel: string;
	typ: 'streak' | 'punkte';
	schwelle: number;
	erreicht: boolean;
}

const meilenstein = (schluessel: string, erreicht: boolean): Meilenstein => ({
	schluessel,
	typ: 'punkte',
	schwelle: 50,
	erreicht,
});

let calls: { endpoint: string; body: string }[] = [];

const mockSender: PushSender = (subscription, payload) => {
	calls.push({ endpoint: subscription.endpoint, body: payload });
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

describe('notifyReachedMilestones (#1363)', () => {
	let userId: number;

	beforeEach(async () => {
		await resetDb();
		calls = [];
		const user = await User.create({
			email: 'milestone-user@example.com',
			passwordHash: '__test__',
			displayName: 'Meilenstein-Nutzerin',
		});
		userId = user.id;
		// Ohne Push-Subscription liefert `sendPushToUser` `sent: 0` (kein Versand) — der Vertrag
		// (docs/spec/issue-1363.md) ruft `sendPushToUser` auf, das erst über eine vorhandene
		// Subscription den injizierten `send` erreicht (Test-Pflege-Bedarf, s. PR-Body).
		await PushSubscription.create({
			endpoint: 'https://push.example/milestone-unit',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId,
		});
	});

	after(async () => {
		await closeDb();
	});

	// ── AK3: Dedupe über Prozessgrenzen — zweiter Aufruf mit demselben Übergang sendet nicht erneut ──

	it('zweimaliger Aufruf mit demselben Übergang sendet nur einmal, zweiter Aufruf legt keinen zweiten Log an (AK3)', async () => {
		const vorher = [meilenstein('punkte-50', false)];
		const nachher = [meilenstein('punkte-50', true)];

		await notifyReachedMilestones(userId, vorher, nachher, mockSender);
		assert.equal(calls.length, 1, 'erster Aufruf sendet genau einmal');
		const logsNach1 = await NotificationLog.findAll({ where: { kind: 'milestone' } });
		assert.equal(logsNach1.length, 1, 'erster Aufruf legt genau einen Dedupe-Eintrag an');

		await notifyReachedMilestones(userId, vorher, nachher, mockSender);
		assert.equal(calls.length, 1, 'zweiter Aufruf mit demselben Übergang sendet nicht erneut');
		const logsNach2 = await NotificationLog.findAll({ where: { kind: 'milestone' } });
		assert.equal(logsNach2.length, 1, 'kein zweiter Dedupe-Eintrag');
	});

	// ── AK4: kein Backfill — Meilenstein in der Vorher-Liste bereits erreicht ────────

	it('Meilenstein bereits vorher erreicht → kein Versand, kein Log (AK4)', async () => {
		const vorher = [meilenstein('streak-3', true)];
		const nachher = [meilenstein('streak-3', true)];

		await notifyReachedMilestones(userId, vorher, nachher, mockSender);

		assert.equal(calls.length, 0, 'kein Versand, wenn der Meilenstein schon vorher erreicht war');
		const logs = await NotificationLog.findAll({ where: { kind: 'milestone' } });
		assert.equal(logs.length, 0, 'kein Dedupe-Eintrag ohne echten Übergang');
	});

	// ── AK5: mehrere gleichzeitig neu erreichte Schwellen → je eine Meldung ─────────

	it('zwei gleichzeitig neu erreichte Schwellen → zwei Versände mit unterschiedlichen dedupeKeys (AK5)', async () => {
		const vorher = [meilenstein('punkte-50', false), meilenstein('punkte-250', false)];
		const nachher = [meilenstein('punkte-50', true), meilenstein('punkte-250', true)];

		await notifyReachedMilestones(userId, vorher, nachher, mockSender);

		assert.equal(calls.length, 2, 'je neu erreichtem Meilenstein genau ein Versand, kein Bündeln');
		const logs = await NotificationLog.findAll({ where: { kind: 'milestone' } });
		assert.equal(logs.length, 2, 'je Meilenstein ein eigener Dedupe-Eintrag');
		assert.deepEqual(
			logs.map((log) => log.dedupeKey).sort(),
			[`${userId}:punkte-250`, `${userId}:punkte-50`].sort(),
			'dedupeKey enthält userId UND schluessel (sonst wäre der Meilenstein global statt je Nutzer eindeutig)',
		);
	});
});
