import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { PushSubscription, Task } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import { runDailyDigest } from './dailyDigest.js';

/**
 * ROTE Spec-Tests für #2853 AK3 — die Morgen-Bündelung „Dein Tag“ (Spec
 * `docs/spec/issue-2853.md`): fällige Aufgaben und Top-Aufgaben gehen als **genau eine**
 * Push-Nachricht je Nutzer und lokalem Tag raus, mit den URL-Regeln aus Konzept §6. Ein
 * Wiederholungtick am selben lokalen Tag sendet nichts — auch nicht mit neuer fälliger Aufgabe.
 *
 * Nutzer ohne `zeitzone` fallen auf UTC — `NOW` (08:00Z) liegt im Morgenfenster 7–9 UTC.
 */

const NOW = new Date('2026-07-07T08:00:00Z');

const pushCalls: string[] = [];
const mockSend: PushSender = (_subscription, p) => {
	pushCalls.push(p);
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

const seedSubscription = async (userId: number): Promise<void> => {
	await PushSubscription.create({
		endpoint: `https://push.example/user-${userId}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId,
	});
};

const createTask = (overrides: Partial<{ title: string; deadline: Date | null; priority: number }>) =>
	Task.create({
		title: 'Aufgabe',
		status: 'Open',
		priority: 2,
		estimatedEffort: 1,
		deadline: null,
		userId: 1,
		...overrides,
	});

describe('dailyDigest — Morgen-Push „Dein Tag“ (#2853 AK3)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(async () => {
		await closeDb();
	});

	it('AK3/TF3: bündelt fällige und Top-Aufgaben zu genau einer Nachricht „Dein Tag“ mit Karte-Deadlines-URL', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
		await createTask({ title: 'Laufen', priority: 3 });

		const result = await runDailyDigest(NOW, mockSend);

		assert.equal(result.usersNotified, 1);
		assert.equal(pushCalls.length, 1, 'genau eine gebündelte Nachricht statt zwei Morgen-Pushes');
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.title, 'Dein Tag');
		assert.equal(payload.url, '/#karte-deadlines', 'mehrere Aufgaben mit fälliger dabei → Karte „Fällig“');
	});

	it('AK3: enthält die Nachricht genau eine Aufgabe, öffnet sie diese Aufgabe', async () => {
		await seedSubscription(1);
		const task = await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });

		await runDailyDigest(NOW, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.url, `/tasks/${task.id}`);
	});

	it('AK3: mehrere Top-Aufgaben ohne fällige öffnen die Karte „Top-Aufgaben“', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', priority: 1 });
		await createTask({ title: 'Laufen', priority: 3 });

		await runDailyDigest(NOW, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.url, '/#karte-top-aufgaben');
	});

	it('AK3: ein Wiederholungstick am selben lokalen Tag sendet nichts — auch nicht mit neuer fälliger Aufgabe', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
		await runDailyDigest(NOW, mockSend);
		assert.equal(pushCalls.length, 1);

		await createTask({ title: 'Neu dazugekommen', deadline: new Date('2026-07-07T12:00:00Z') });
		const result = await runDailyDigest(NOW, mockSend);

		assert.equal(result.usersNotified, 0);
		assert.equal(pushCalls.length, 1, 'kein zweiter „Dein Tag“-Push am selben lokalen Tag');
	});
});
