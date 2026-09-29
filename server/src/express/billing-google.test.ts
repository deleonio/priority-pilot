import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { GooglePlayClient, PlaySubscription } from '../logics/googlePlay.js';

/**
 * #1687/#1696: `POST /billing/google/purchase` schaltet einen Kauf aus der Android-App frei und
 * ersetzt beim Paketwechsel das bisherige Play-Abo. Die Play
 * Developer API ist über einen injizierten Fake ersetzt (Muster `paypalClient` in
 * `billing-subscriptions.test.ts`).
 */

applyTestAuthEnv('test-secret-issue-1687');

let server: TestServer;
let acknowledged: string[];
/** Abweichungen vom Pro-Monatsabo je Kauf-Token. */
let purchases: Record<string, Partial<PlaySubscription>>;
const PERIOD_END = new Date('2026-10-24T10:00:00Z');

const fakePlay = (accountId: () => string): GooglePlayClient => ({
	getSubscription: async (token) => ({
		productId: 'pro',
		basePlanId: 'monthly',
		expiresAt: PERIOD_END,
		state: 'ACTIVE',
		acknowledged: false,
		obfuscatedAccountId: accountId(),
		...purchases[token],
	}),
	acknowledge: async (_productId, token) => {
		acknowledged.push(token);
	},
});

describe('Play-Kauf freischalten (#1687)', () => {
	let accountIdOfBuyer = '';

	beforeEach(async () => {
		await resetDb();
		acknowledged = [];
		purchases = {};
		server ??= await startTestServer({ googlePlayClient: fakePlay(() => accountIdOfBuyer) });
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const me = async (cookie: string) =>
		(await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
			plan: string;
			playAccountId: string;
		};
	const purchase = (cookie: string, purchaseToken: string, channel = 'play') =>
		fetch(`${server.baseUrl}/billing/google/purchase`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Client-Channel': channel },
			body: JSON.stringify({ purchaseToken }),
		});

	it('schaltet einen gültigen Kauf frei, bestätigt ihn und /auth/me zeigt das Paket', async () => {
		const cookie = await server.login('kaeufer@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;

		const res = await purchase(cookie, 'token-1');

		assert.equal(res.status, 204);
		assert.equal((await me(cookie)).plan, 'pro');
		assert.deepEqual(acknowledged, ['token-1']);
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'token-1' } });
		assert.equal(sub?.get('provider'), 'google_play');
	});

	it('lehnt einen Kauf mit fremder obfuscatedAccountId ab und bestätigt ihn nicht', async () => {
		const buyer = await server.login('echt@example.com');
		accountIdOfBuyer = (await me(buyer)).playAccountId;
		const other = await server.login('fremd@example.com');

		const res = await purchase(other, 'token-2');

		assert.equal(res.status, 403);
		assert.equal(await Subscription.count(), 0);
		assert.deepEqual(acknowledged, []);
		assert.equal((await me(other)).plan, 'free');
	});

	it('derselbe Token zweimal erzeugt kein zweites Abo', async () => {
		const cookie = await server.login('doppelt@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;

		assert.equal((await purchase(cookie, 'token-3')).status, 204);
		assert.equal((await purchase(cookie, 'token-3')).status, 204);

		assert.equal(await Subscription.count(), 1);
	});

	it('derselbe Token gleichzeitig eingereicht erzeugt kein zweites Abo (#1690)', async () => {
		const cookie = await server.login('gleichzeitig@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;

		const [first, second] = await Promise.all([purchase(cookie, 'token-5'), purchase(cookie, 'token-5')]);

		assert.deepEqual([first.status, second.status], [204, 204]);
		assert.equal(await Subscription.count(), 1);
	});

	it('lehnt Anfragen aus dem Web-Kanal mit 409 ab', async () => {
		const cookie = await server.login('web@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;

		const res = await purchase(cookie, 'token-4', 'web');

		assert.equal(res.status, 409);
		assert.equal(await Subscription.count(), 0);
	});

	it('Upgrade: der Kauf mit Verweis auf das alte Token ersetzt das Play-Abo, kein zweites (#1696)', async () => {
		const cookie = await server.login('upgrade@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;
		await purchase(cookie, 'token-alt');
		purchases['token-neu'] = { productId: 'max', basePlanId: 'yearly', linkedPurchaseToken: 'token-alt' };

		assert.equal((await purchase(cookie, 'token-neu')).status, 204);

		const subs = await Subscription.findAll();
		assert.equal(subs.length, 1);
		assert.equal(subs[0].get('externalSubscriptionId'), 'token-neu');
		assert.equal(subs[0].get('period'), 'yearly');
		assert.equal((await me(cookie)).plan, 'max');
		assert.deepEqual(acknowledged, ['token-alt', 'token-neu']);
	});

	it('Downgrade: der neue Kauf merkt das kleinere Paket zum Periodenende vor (#1696)', async () => {
		const cookie = await server.login('downgrade@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;
		purchases['token-alt'] = { productId: 'max' };
		await purchase(cookie, 'token-alt');
		purchases['token-neu'] = {
			productId: 'max',
			linkedPurchaseToken: 'token-alt',
			deferred: { productId: 'pro', basePlanId: 'monthly' },
		};

		assert.equal((await purchase(cookie, 'token-neu')).status, 204);

		const [sub] = await Subscription.findAll();
		assert.equal(sub.get('plan'), 'max');
		assert.equal(sub.get('pendingPlan'), 'pro');
		assert.deepEqual(sub.get('pendingPlanEffectiveAt'), PERIOD_END);
		assert.equal((await me(cookie)).plan, 'max');
	});

	it('ein zweiter Play-Kauf ohne Verweis auf das laufende Abo wird abgelehnt und nicht bestätigt', async () => {
		const cookie = await server.login('zweites@example.com');
		accountIdOfBuyer = (await me(cookie)).playAccountId;
		await purchase(cookie, 'token-eins');

		const res = await purchase(cookie, 'token-zwei');

		assert.equal(res.status, 409);
		assert.equal(await Subscription.count(), 1);
		assert.deepEqual(acknowledged, ['token-eins']);
	});
});
