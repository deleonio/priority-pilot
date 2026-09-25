import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Subscription, WebhookEvent } from '../models/index.js';
import type { GooglePlayClient } from '../logics/googlePlay.js';

/**
 * #1689: `POST /billing/google/rtdn` nimmt Real-time Developer Notifications per Pub/Sub-Push an.
 * Das OIDC-Token wird mit einem Test-Schlüsselpaar signiert, dessen öffentlicher Teil als
 * `googleKeys` hereingereicht wird; die Play Developer API ist ein Fake.
 */

const AUDIENCE = 'https://example.org/billing/google/rtdn';
process.env.GOOGLE_RTDN_AUDIENCE = AUDIENCE;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const googleKeys = async () => [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1' }];

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const token = (claims: Record<string, unknown>): string => {
	const head = `${base64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
	return `${head}.${base64url(createSign('RSA-SHA256').update(head).sign(privateKey))}`;
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const validClaims = () => ({
	iss: 'https://accounts.google.com',
	aud: AUDIENCE,
	iat: nowSeconds(),
	exp: nowSeconds() + 3600,
});

const push = (messageId: string, purchaseToken: string) =>
	JSON.stringify({
		message: {
			messageId,
			data: Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: 2, purchaseToken } })).toString(
				'base64',
			),
		},
		subscription: 'projects/demo/subscriptions/rtdn',
	});

let server: TestServer;
let lookups: string[];

const fakePlay: GooglePlayClient = {
	getSubscription: async (purchaseToken) => {
		lookups.push(purchaseToken);
		return {
			productId: 'pro',
			basePlanId: 'monthly',
			expiresAt: new Date('2026-11-24T10:00:00Z'),
			state: 'ACTIVE',
			acknowledged: true,
		};
	},
	acknowledge: async () => {},
};

const send = (body: string, authorization?: string) =>
	fetch(`${server.baseUrl}/billing/google/rtdn`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
		body,
	});

describe('RTDN von Google Play (#1689)', () => {
	beforeEach(async () => {
		await resetDb();
		lookups = [];
		server ??= await startTestServer({ googlePlayClient: fakePlay, googleKeys });
		await Subscription.create({
			userId: 1,
			provider: 'google_play',
			externalSubscriptionId: 'token-1',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-10-24T10:00:00Z'),
		});
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('speichert ein Ereignis mit gültigem Token, bestätigt es mit 2xx und legt den Abo-Stand ab', async () => {
		const res = await send(push('m1', 'token-1'), `Bearer ${token(validClaims())}`);

		assert.equal(res.status, 200);
		const stored = await WebhookEvent.findOne({ where: { provider: 'google_play', externalEventId: 'm1' } });
		assert.equal(stored?.get('verified'), true);
		assert.ok(stored?.get('processedAt'));
		const subscription = await Subscription.findOne({ where: { externalSubscriptionId: 'token-1' } });
		assert.deepEqual(subscription?.get('currentPeriodEnd'), new Date('2026-11-24T10:00:00Z'));
	});

	it('lehnt fehlendes, fremdes oder abgelaufenes Token mit 401 ab und speichert nichts', async () => {
		const cases: [string, string | undefined][] = [
			['fehlt', undefined],
			['falsche Audience', `Bearer ${token({ ...validClaims(), aud: 'https://evil.example/rtdn' })}`],
			['abgelaufen', `Bearer ${token({ ...validClaims(), exp: nowSeconds() - 60 })}`],
		];
		for (const [label, authorization] of cases) {
			assert.equal((await send(push(`m-${label}`, 'token-1'), authorization)).status, 401, label);
		}
		assert.equal(await WebhookEvent.count(), 0);
		assert.deepEqual(lookups, []);
	});

	it('verarbeitet dasselbe Ereignis nur einmal', async () => {
		const authorization = `Bearer ${token(validClaims())}`;

		assert.equal((await send(push('m2', 'token-1'), authorization)).status, 200);
		assert.equal((await send(push('m2', 'token-1'), authorization)).status, 200);

		assert.equal(await WebhookEvent.count(), 1);
		assert.deepEqual(lookups, ['token-1']);
	});
});
