import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runMonthlyRecapPush } from './monthlyRecapPush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #1995 (Spec docs/spec/issue-1995.md) — monatlicher Rückblicks-Push.
 * AK3: `runMonthlyRecapPush` versendet je Nutzer und Kalendermonat höchstens **eine** Push-
 * Ankündigung des Vormonats (NotificationLog `kind: 'monthly-recap'`, dedupeKey
 * `<userId>:<JJJJ-MM>`); ein zweiter Lauf im selben Monat sendet nichts (Idempotenz), ohne
 * erfolgreichen Versand entsteht kein Log-Eintrag — der nächste Lauf sendet erneut.
 * Muster: `streakReminder.ts` (Log erst bei sent > 0, injizierbarer PushSender).
 * `monthlyRecapPush.ts` existiert noch nicht — der fehlende Modul-Import ist der legitime
 * erste Rot-Zustand.
 */

// 03:00 UTC am 01.10.2026 — erster Scheduler-Lauf im neuen Monat; Recap-Monat = 2026-09.
const NOW = new Date('2026-10-01T03:00:00Z');

/** Empfänger mit Push-Subscription (ohne Subscription: sent = 0, kein Log — Muster streakReminder). */
const seedEmpfaenger = async (email: string) => {
	const user = await User.create({
		email,
		displayName: 'Rueckblick',
		passwordHash: '__test__',
	} as never);
	await PushSubscription.create({
		endpoint: `https://push.example.com/${user.id}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: user.id,
	});
	return user;
};

// Test-Pflege (#1995): `PushSender` erhält die Wire-Payload als STRING (web-push-Vertrag,
// `logics/push.ts`) — doppelt zu kodieren würde das Auswerten der Felder unmöglich machen.
const okSender =
	(calls: string[]): PushSender =>
	(_subscription, payload) => {
		calls.push(payload);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

// Test-Pflege (#1995): Fehlschlag heißt WERFEN — `deliver` zählt jeden nicht-wirfenden Aufruf
// als zugestellt, ein aufgelöstes 500-Ergebnis wäre also ein Erfolg.
const failSender: PushSender = () => Promise.reject({ statusCode: 500, body: '', headers: {} });

describe('runMonthlyRecapPush (#1995 AK3)', () => {
	beforeEach(resetDb);
	after(closeDb);

	it('sendet je Nutzer genau eine Ankündigung des Vormonats und loggt erst nach erfolgreichem Versand', async () => {
		const anna = await seedEmpfaenger('recap-anna@example.com');
		const ben = await seedEmpfaenger('recap-ben@example.com');
		const calls: string[] = [];

		const ergebnis = await runMonthlyRecapPush(NOW, okSender(calls));

		assert.equal(ergebnis.usersNotified, 2);
		assert.equal(calls.length, 2);
		const payload = JSON.parse(calls[0]!) as { title?: string; body?: string; url?: string };
		assert.equal(typeof payload.title, 'string');
		assert.ok(payload.title!.length > 0, 'Push-Titel darf nicht leer sein');
		assert.equal(typeof payload.body, 'string');
		assert.ok(payload.body!.length > 0, 'Push-Text darf nicht leer sein');
		assert.equal(typeof payload.url, 'string');
		assert.ok(payload.url!.startsWith('/'), 'Push-URL ist ein App-Pfad (push-sw-Vertrag)');
		for (const user of [anna, ben]) {
			const log = await NotificationLog.findOne({ where: { userId: user.id, kind: 'monthly-recap' } });
			assert.ok(log, `Log-Eintrag für ${user.email} fehlt`);
			assert.equal(log!.dedupeKey, `${user.id}:2026-09`, 'dedupeKey = <userId>:<JJJJ-MM> des Vormonats');
		}
	});

	it('zweiter Lauf im selben Monat sendet nichts (Idempotenz)', async () => {
		await seedEmpfaenger('recap-once@example.com');
		const calls: string[] = [];
		await runMonthlyRecapPush(NOW, okSender(calls));

		const ergebnis = await runMonthlyRecapPush(NOW, okSender(calls));

		assert.equal(ergebnis.usersNotified, 0);
		assert.equal(calls.length, 1, 'Der Zweitlauf darf keinen weiteren Versand auslösen');
	});

	it('ohne erfolgreichen Versand entsteht kein Log-Eintrag — der nächste Lauf sendet erneut', async () => {
		const anna = await seedEmpfaenger('recap-retry@example.com');
		const calls: string[] = [];

		const fehl = await runMonthlyRecapPush(NOW, failSender);
		assert.equal(fehl.usersNotified, 0);
		assert.equal(await NotificationLog.count({ where: { userId: anna.id, kind: 'monthly-recap' } }), 0);

		const retry = await runMonthlyRecapPush(NOW, okSender(calls));
		assert.equal(retry.usersNotified, 1, 'Ohne Log-Eintrag muss der nächste Lauf erneut zustellen');
		assert.equal(calls.length, 1);
		assert.equal(await NotificationLog.count({ where: { userId: anna.id, kind: 'monthly-recap' } }), 1);
	});
});
