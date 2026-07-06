import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PushSubscription } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Datenisolation für Web-Push (#207): Push-Subscriptions gehören genau **einem** Nutzer. Nutzer B
// darf die Subscription von Nutzer A weder sehen noch abmelden.
//
// Auth-Env über die **Plural**-Variable (`GOOGLE_ALLOWED_EMAILS`) — analog pillars-dataisolation.test.ts:
// `isEmailAllowed` priorisiert Plural vor Singular, nur so gewinnt der Test-Zugriff gegen eine lokale `.env`.
process.env.GOOGLE_ALLOWED_EMAILS = 'a@example.com,b@example.com';
process.env.SESSION_SECRET = 'push-iso-test-secret';
process.env.GOOGLE_CLIENT_ID = 'push-iso-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'push-iso-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

let server: TestServer;

/** Test-Only-Login liefert einen Cookie, der einen echten Session-`userId` repräsentiert. */
const login = async (email: string): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, displayName: email }),
	});
	assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte Set-Cookie setzen');
	return setCookie.split(';')[0];
};

const subscribe = (cookie: string, endpoint: string) =>
	fetch(`${server.baseUrl}/push/subscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify({ endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } }),
	});

const unsubscribe = (cookie: string, endpoint: string) =>
	fetch(`${server.baseUrl}/push/unsubscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify({ endpoint }),
	});

describe('Push-Datenisolation — Subscriptions gehören genau einem Nutzer', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('speichert die Subscription unter der userId des eingeloggten Nutzers', async () => {
		const cookieA = await login('a@example.com');
		const res = await subscribe(cookieA, 'https://push.example.com/a');
		assert.equal(res.status, 201);

		const rows = await PushSubscription.findAll();
		assert.equal(rows.length, 1);
		assert.equal(typeof rows[0].userId, 'number', 'Subscription ist einem Nutzer zugeordnet');
	});

	it('B kann die Subscription von A nicht abmelden (Endpoint bleibt bei A bestehen)', async () => {
		const cookieA = await login('a@example.com');
		const cookieB = await login('b@example.com');
		await subscribe(cookieA, 'https://push.example.com/a');

		// B meldet denselben Endpoint ab — Idempotenz liefert 200, darf aber A's Zeile NICHT löschen.
		const res = await unsubscribe(cookieB, 'https://push.example.com/a');
		assert.equal(res.status, 200);
		assert.equal(await PushSubscription.count(), 1, 'A-Subscription bleibt trotz B-Unsubscribe erhalten');

		// A meldet den eigenen Endpoint ab — jetzt wird gelöscht.
		await unsubscribe(cookieA, 'https://push.example.com/a');
		assert.equal(await PushSubscription.count(), 0);
	});

	it('trennt Subscriptions zweier Nutzer für denselben logischen Endpoint-Namensraum', async () => {
		const cookieA = await login('a@example.com');
		const cookieB = await login('b@example.com');
		await subscribe(cookieA, 'https://push.example.com/a');
		await subscribe(cookieB, 'https://push.example.com/b');

		const rows = await PushSubscription.findAll({ order: [['id', 'ASC']] });
		assert.equal(rows.length, 2);
		assert.notEqual(rows[0].userId, rows[1].userId, 'jede Subscription trägt eine eigene userId');
	});

	it('B subscribe auf Endpoint von A übernimmt die Subscription nicht (kein Owner-Reassign)', async () => {
		const cookieA = await login('a@example.com');
		const cookieB = await login('b@example.com');
		await subscribe(cookieA, 'https://push.example.com/shared');

		// userId von A sichern, bevor B den Endpoint subscribt
		const rows = await PushSubscription.findAll();
		const ownerIdBeforeAttack = rows[0].userId;

		// B versucht denselben Endpoint zu subscriben — idempotentes 201, darf aber Eigentümer nicht ändern
		const res = await subscribe(cookieB, 'https://push.example.com/shared');
		assert.equal(res.status, 201);

		const rowsAfter = await PushSubscription.findAll();
		assert.equal(rowsAfter.length, 1, 'keine neue Zeile für denselben Endpoint');
		assert.equal(
			rowsAfter[0].userId,
			ownerIdBeforeAttack,
			'userId darf nicht auf B wechseln (Owner-Reassign verhindert)',
		);
	});
});
