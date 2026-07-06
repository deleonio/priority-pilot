import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import type { SendResult } from 'web-push';
import { PushSubscription } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { getVapidPublicKey, isPushConfigured, sendPushToUser, type PushSender } from './push.js';

// Echte VAPID-Schlüssel erzeugen, damit der Default-Sender `webpush.setVapidDetails` nicht wegen
// ungültigem Schlüsselformat wirft (der Versand selbst wird über einen bewusst kaputten Endpoint
// vor jedem Netzwerkzugriff abgebrochen — s. u.).
const vapidKeys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;

/** Legt eine Subscription-Zeile direkt an (umgeht die Route, um die Versand-Logik isoliert zu testen). */
const seedSubscription = (userId: number | null, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

/** Erfolgs-Sender: zählt die Aufrufe und liefert ein SendResult-artiges Ergebnis. */
const okSender =
	(calls: string[]): PushSender =>
	(subscription) => {
		calls.push(subscription.endpoint);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

/** Fehler-Sender: wirft für jede Subscription einen Fehler mit gegebenem Statuscode. */
const failingSender =
	(statusCode: number): PushSender =>
	() =>
		Promise.reject(Object.assign(new Error(`push failed ${statusCode}`), { statusCode }));

describe('logics/push — Versand-Helfer', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('getVapidPublicKey/isPushConfigured spiegeln die Env-Konfiguration', () => {
		assert.equal(getVapidPublicKey(), vapidKeys.publicKey);
		assert.equal(isPushConfigured(), true);

		const savedPublic = process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PUBLIC_KEY;
		try {
			assert.equal(getVapidPublicKey(), undefined);
			assert.equal(isPushConfigured(), false);
		} finally {
			process.env.VAPID_PUBLIC_KEY = savedPublic;
		}
	});

	it('verschickt an alle Subscriptions des Nutzers und zählt die Zustellungen', async () => {
		await seedSubscription(1, 'https://push.example.com/a1');
		await seedSubscription(1, 'https://push.example.com/a2');
		const calls: string[] = [];

		const result = await sendPushToUser(1, { title: 'Hallo', body: 'Welt', url: '/' }, okSender(calls));

		assert.deepEqual(result, { sent: 2, removed: 0 });
		assert.deepEqual(calls.sort(), ['https://push.example.com/a1', 'https://push.example.com/a2']);
	});

	it('isoliert nach userId — fremde Subscriptions werden nicht angesprochen', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await seedSubscription(2, 'https://push.example.com/b');
		const calls: string[] = [];

		const result = await sendPushToUser(1, { title: 'nur A' }, okSender(calls));

		assert.deepEqual(result, { sent: 1, removed: 0 });
		assert.deepEqual(calls, ['https://push.example.com/a']);
	});

	it('entfernt abgelaufene Subscriptions bei 410 Gone', async () => {
		await seedSubscription(1, 'https://push.example.com/gone');
		const result = await sendPushToUser(1, { title: 'x' }, failingSender(410));

		assert.deepEqual(result, { sent: 0, removed: 1 });
		assert.equal(await PushSubscription.count(), 0, 'abgelaufene Subscription wurde gelöscht');
	});

	it('entfernt Subscriptions auch bei 404 Not Found', async () => {
		await seedSubscription(1, 'https://push.example.com/missing');
		const result = await sendPushToUser(1, { title: 'x' }, failingSender(404));

		assert.deepEqual(result, { sent: 0, removed: 1 });
		assert.equal(await PushSubscription.count(), 0);
	});

	it('behält Subscriptions bei anderen Fehlern (z. B. 500) bestehen', async () => {
		await seedSubscription(1, 'https://push.example.com/flaky');
		const result = await sendPushToUser(1, { title: 'x' }, failingSender(500));

		assert.deepEqual(result, { sent: 0, removed: 0 });
		assert.equal(await PushSubscription.count(), 1, 'transienter Fehler löscht die Subscription nicht');
	});

	it('nutzt ohne injizierten Sender den web-push-Default (Versand bricht vor dem Netzwerk ab)', async () => {
		// Bewusst kaputter Endpoint: web-push wirft beim URL-Parsen (kein Statuscode) → die Subscription
		// gilt nicht als abgelaufen und bleibt bestehen. Deckt den Default-Sender-Pfad ohne Netzwerk ab.
		await seedSubscription(1, 'kein-gueltiger-endpoint');
		const result = await sendPushToUser(1, { title: 'default' });

		assert.deepEqual(result, { sent: 0, removed: 0 });
		assert.equal(await PushSubscription.count(), 1);
	});
});
