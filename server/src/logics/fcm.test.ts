import { describe, it, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SendResult } from 'web-push';
import { FcmToken, NotificationLog, PushSubscription, Task } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runDueTaskReminders } from './dueTaskReminders.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * FCM als zweiter Kanal hinter `sendPushToUser` (#1675). Google wird über ein gemocktes
 * `globalThis.fetch` ersetzt; der Service-Account ist ein frisch erzeugtes Schlüsselpaar, damit der
 * Test auch die JWT-Signatur gegen den öffentlichen Schlüssel prüfen kann.
 */

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	publicKeyEncoding: { type: 'spki', format: 'pem' },
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const dir = mkdtempSync(join(tmpdir(), 'fcm-'));
let fileCounter = 0;

/** Neue Schlüsseldatei je Test, damit kein zwischengespeichertes Zugriffstoken aus einem Vortest greift. */
const configureFcm = () => {
	const file = join(dir, `sa-${++fileCounter}.json`);
	writeFileSync(
		file,
		JSON.stringify({ project_id: 'demo', client_email: 'push@demo.iam.gserviceaccount.com', private_key: privateKey }),
	);
	process.env.FCM_SERVICE_ACCOUNT_FILE = file;
};

interface Call {
	url: string;
	init: RequestInit;
}

/** Google-Attrappe: Token-Endpunkt liefert ein Zugriffstoken, der Versand antwortet mit `sendStatus`/`sendBody`. */
const mockGoogle = (sendStatus = 200, sendBody: unknown = {}): Call[] => {
	const calls: Call[] = [];
	mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		if (url === 'https://oauth2.googleapis.com/token') {
			return Response.json({ access_token: 'access-1', expires_in: 3600 });
		}
		return Response.json(sendBody, { status: sendStatus });
	});
	return calls;
};

const sendCalls = (calls: Call[]) => calls.filter((call) => call.url.includes('fcm.googleapis.com'));

const webSender =
	(endpoints: string[]): PushSender =>
	(subscription) => {
		endpoints.push(subscription.endpoint);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

const seedBoth = async () => {
	await PushSubscription.create({
		endpoint: 'https://push.example.com/a',
		p256dh: 'p',
		auth: 'a',
		expirationTime: null,
		userId: 1,
	});
	await FcmToken.create({ token: 'device-1', userId: 1 });
};

describe('logics/push — Versand zusätzlich über FCM (#1675)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	afterEach(() => {
		mock.restoreAll();
		delete process.env.FCM_SERVICE_ACCOUNT_FILE;
	});
	after(async () => {
		await closeDb();
	});

	it('stellt über Web-Push und FCM zu und meldet sich mit signiertem JWT an', async () => {
		configureFcm();
		await seedBoth();
		const calls = mockGoogle();
		const endpoints: string[] = [];

		const result = await sendPushToUser(1, { title: 'Hallo', body: 'Welt', url: '/app/' }, webSender(endpoints));

		assert.deepEqual(result, { sent: 2, removed: 0 });
		assert.deepEqual(endpoints, ['https://push.example.com/a']);
		const [send] = sendCalls(calls);
		assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/demo/messages:send');
		assert.equal((send.init.headers as Record<string, string>).Authorization, 'Bearer access-1');
		assert.deepEqual(JSON.parse(send.init.body as string), {
			message: { token: 'device-1', notification: { title: 'Hallo', body: 'Welt' }, data: { url: '/app/' } },
		});

		const assertion = new URLSearchParams(calls[0].init.body as URLSearchParams).get('assertion') ?? '';
		const [header, claims, signature] = assertion.split('.');
		const verified = createVerify('RSA-SHA256')
			.update(`${header}.${claims}`)
			.verify(publicKey, Buffer.from(signature, 'base64url'));
		assert.equal(verified, true);
		assert.equal(
			JSON.parse(Buffer.from(claims, 'base64url').toString()).scope,
			'https://www.googleapis.com/auth/firebase.messaging',
		);
	});

	it('entfernt ein Token, das FCM als unbekannt meldet (404 UNREGISTERED)', async () => {
		configureFcm();
		await FcmToken.create({ token: 'stale', userId: 1 });
		mockGoogle(404, { error: { code: 404, status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });

		const result = await sendPushToUser(1, { title: 'x' }, webSender([]));

		assert.deepEqual(result, { sent: 0, removed: 1 });
		assert.equal(await FcmToken.count(), 0);
	});

	it('behält Tokens bei einem 404 ohne UNREGISTERED, etwa bei falscher project_id', async () => {
		configureFcm();
		await FcmToken.create({ token: 'device-1', userId: 1 });
		mockGoogle(404, { error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.' } });

		const result = await sendPushToUser(1, { title: 'x' }, webSender([]));

		assert.deepEqual(result, { sent: 0, removed: 0 });
		assert.equal(await FcmToken.count(), 1);
	});

	it('zählt eine Erinnerung trotz zweier Kanäle nur einmal in notification_logs', async () => {
		configureFcm();
		await seedBoth();
		const calls = mockGoogle();
		await Task.create({
			title: 'Steuer',
			status: 'Open',
			priority: 3,
			estimatedEffort: 1,
			deadline: new Date('2026-07-07T10:00:00Z'),
			userId: 1,
		});

		const result = await runDueTaskReminders(new Date('2026-07-07T08:00:00Z'), webSender([]));

		assert.equal(result.usersNotified, 1);
		assert.equal(sendCalls(calls).length, 1);
		assert.equal(await NotificationLog.count(), 1);
	});

	it('ohne Service-Account bleibt es beim Web-Push, FCM wird nicht angesprochen', async () => {
		await seedBoth();
		const calls = mockGoogle();
		const endpoints: string[] = [];

		const result = await sendPushToUser(1, { title: 'x' }, webSender(endpoints));

		assert.deepEqual(result, { sent: 1, removed: 0 });
		assert.equal(endpoints.length, 1);
		assert.equal(calls.length, 0);
		assert.equal(await FcmToken.count(), 1);
	});
});
