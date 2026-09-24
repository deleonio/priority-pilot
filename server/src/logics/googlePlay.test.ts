import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acknowledgeIfPending, createGooglePlayClient, GooglePlayError } from './googlePlay.js';

/**
 * #1685: Client der Play Developer API (ADR 0017). Google wird über ein gemocktes `globalThis.fetch`
 * ersetzt (Muster `fcm.test.ts`), der Service-Account ist ein frisch erzeugtes Schlüsselpaar.
 */

const { privateKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const file = join(mkdtempSync(join(tmpdir(), 'play-')), 'sa.json');
writeFileSync(
	file,
	JSON.stringify({ project_id: 'demo', client_email: 'play@demo.iam.gserviceaccount.com', private_key: privateKey }),
);

const PURCHASE = {
	subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
	acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
	externalAccountIdentifiers: { obfuscatedExternalAccountId: 'acc-42' },
	lineItems: [{ productId: 'pro', expiryTime: '2026-10-24T10:00:00Z', offerDetails: { basePlanId: 'monthly' } }],
};

/** Google-Attrappe: Token-Endpunkt liefert ein Zugriffstoken, die API antwortet mit `status`/`body`. */
const mockGoogle = (status = 200, body: unknown = PURCHASE): { url: string; method: string }[] => {
	const calls: { url: string; method: string }[] = [];
	mock.method(globalThis, 'fetch', async (url: string, init: RequestInit = {}) => {
		if (url === 'https://oauth2.googleapis.com/token') {
			return Response.json({ access_token: 'access-1', expires_in: 3600 });
		}
		calls.push({ url, method: init.method ?? 'GET' });
		return Response.json(body, { status });
	});
	return calls;
};

const kindOf = async (promise: Promise<unknown>): Promise<string> => {
	const error = await promise.then(
		() => assert.fail('Aufruf hätte scheitern müssen'),
		(reason: unknown) => reason,
	);
	assert.ok(error instanceof GooglePlayError);
	return error.kind;
};

describe('googlePlay (#1685)', () => {
	beforeEach(() => {
		process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE = file;
	});
	afterEach(() => {
		mock.restoreAll();
		delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE;
	});

	it('liest Produkt, Base Plan, Ablauf, Status und obfuscatedAccountId eines gültigen Tokens', async () => {
		const calls = mockGoogle();

		const subscription = await createGooglePlayClient().getSubscription('token-1');

		assert.deepEqual(subscription, {
			productId: 'pro',
			basePlanId: 'monthly',
			expiresAt: new Date('2026-10-24T10:00:00Z'),
			state: 'ACTIVE',
			acknowledged: false,
			obfuscatedAccountId: 'acc-42',
		});
		assert.equal(
			calls[0].url,
			'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/de.balamentum.app/purchases/subscriptionsv2/tokens/token-1',
		);
	});

	it('bestätigt einen offenen Kauf genau einmal, einen bestätigten gar nicht', async () => {
		const calls = mockGoogle(200, {});
		const client = createGooglePlayClient();
		const pending = {
			productId: 'pro',
			basePlanId: 'monthly',
			expiresAt: new Date(),
			state: 'ACTIVE',
			acknowledged: false,
		};

		await acknowledgeIfPending(client, pending, 'token-1');
		await acknowledgeIfPending(client, { ...pending, acknowledged: true }, 'token-1');

		assert.deepEqual(calls, [
			{
				url: 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/de.balamentum.app/purchases/subscriptions/pro/tokens/token-1:acknowledge',
				method: 'POST',
			},
		]);
	});

	it('unterscheidet ungültigen Token, Ausfall bei Google und fehlende Konfiguration', async () => {
		mockGoogle(410, { error: { code: 410 } });
		assert.equal(await kindOf(createGooglePlayClient().getSubscription('alt')), 'invalid');
		mock.restoreAll();

		mockGoogle(503, {});
		assert.equal(await kindOf(createGooglePlayClient().getSubscription('token-1')), 'unavailable');
		mock.restoreAll();

		delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE;
		const calls = mockGoogle();
		assert.equal(await kindOf(createGooglePlayClient().getSubscription('token-1')), 'not_configured');
		assert.equal(calls.length, 0);
	});
});
