import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PushSubscription } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { expectError } from '../test/helpers.js';

// Web-Push benötigt konfigurierte VAPID-Schlüssel — sonst greift das 503-Gate (siehe logics/push.ts).
// Kein echtes Schlüsselpaar nötig: die /push/subscribe-Route speichert nur, sie verschickt nichts.
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

let server: TestServer;

/** Eine gültige Browser-Subscription (Form von `PushManager.subscribe().toJSON()`). */
const subscriptionBody = (endpoint = 'https://push.example.com/abc') => ({
	endpoint,
	expirationTime: null,
	keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
});

describe('Push API', () => {
	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	// ── GET /push/vapid-public-key ─────────────────────────────────────────────

	describe('GET /push/vapid-public-key', () => {
		it('200 mit dem öffentlichen Schlüssel bei konfiguriertem Web-Push', async () => {
			const res = await fetch(`${server.baseUrl}/push/vapid-public-key`);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), { publicKey: 'test-public-key' });
		});

		it('503, wenn kein VAPID-Schlüssel konfiguriert ist', async () => {
			const saved = process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PUBLIC_KEY;
			try {
				const res = await fetch(`${server.baseUrl}/push/vapid-public-key`);
				await expectError(res, 503);
			} finally {
				process.env.VAPID_PUBLIC_KEY = saved;
			}
		});
	});

	// ── POST /push/subscribe ───────────────────────────────────────────────────

	describe('POST /push/subscribe', () => {
		it('201 und speichert die Subscription', async () => {
			const res = await post('/push/subscribe', subscriptionBody());
			assert.equal(res.status, 201);
			assert.deepEqual(await res.json(), { endpoint: 'https://push.example.com/abc' });

			const rows = await PushSubscription.findAll();
			assert.equal(rows.length, 1);
			assert.equal(rows[0].endpoint, 'https://push.example.com/abc');
			assert.equal(rows[0].p256dh, 'p256dh-key');
			assert.equal(rows[0].auth, 'auth-secret');
		});

		it('ist idempotent: gleicher Endpoint aktualisiert statt zu duplizieren', async () => {
			await post('/push/subscribe', subscriptionBody());
			// Zweiter Aufruf mit gleichem Endpoint, aber neuen Schlüsseln.
			const res = await post('/push/subscribe', {
				endpoint: 'https://push.example.com/abc',
				keys: { p256dh: 'neuer-p256dh', auth: 'neues-auth' },
			});
			assert.equal(res.status, 201);

			const rows = await PushSubscription.findAll();
			assert.equal(rows.length, 1, 'kein Duplikat bei gleichem Endpoint');
			assert.equal(rows[0].p256dh, 'neuer-p256dh', 'Schlüssel wurden aktualisiert');
		});

		it('400 bei fehlendem endpoint', async () => {
			const res = await post('/push/subscribe', { keys: { p256dh: 'x', auth: 'y' } });
			await expectError(res, 400);
		});

		it('400 bei fehlenden keys', async () => {
			const res = await post('/push/subscribe', { endpoint: 'https://push.example.com/x' });
			await expectError(res, 400);
		});

		it('503, wenn Web-Push nicht konfiguriert ist', async () => {
			const saved = process.env.VAPID_PRIVATE_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
			try {
				const res = await post('/push/subscribe', subscriptionBody());
				await expectError(res, 503);
			} finally {
				process.env.VAPID_PRIVATE_KEY = saved;
			}
		});
	});

	// ── POST /push/unsubscribe ─────────────────────────────────────────────────

	describe('POST /push/unsubscribe', () => {
		it('200 und entfernt die Subscription', async () => {
			await post('/push/subscribe', subscriptionBody());
			const res = await post('/push/unsubscribe', { endpoint: 'https://push.example.com/abc' });
			assert.equal(res.status, 200);
			assert.equal(await PushSubscription.count(), 0);
		});

		it('ist idempotent: unbekannter Endpoint liefert trotzdem 200', async () => {
			const res = await post('/push/unsubscribe', { endpoint: 'https://push.example.com/unknown' });
			assert.equal(res.status, 200);
		});

		it('400 bei fehlendem endpoint', async () => {
			const res = await post('/push/unsubscribe', {});
			await expectError(res, 400);
		});
	});
});
