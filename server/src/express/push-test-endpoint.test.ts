import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { PushSubscription } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { QUOTES } from '../logics/pushTestQuote.js';
import type { PushSender } from '../logics/push.js';

/**
 * ROTE Spec-Tests für #386 „Push-Test-Button mit rotierenden Zitaten" — AK2 (Endpunkt liefert 200 mit
 * gewähltem Zitat und Zustellzähler) und AK4 (503-Gate, 401-Gate, Datenisolation). Die Route
 * `POST /push/test` existiert noch nicht → die Tests sind rot (404 statt 200/503/401).
 *
 * Auth-Env über die Plural-Variable `GOOGLE_ALLOWED_EMAILS` (analog `push-dataisolation.test.ts`),
 * damit der Test-Zugriff gegen eine lokale `.env` gewinnt. Die VAPID-Schlüssel sind bewusst Fake-Werte
 * (nicht-leer → `isPushConfigured()` ist true), der eigentliche Versand wird über einen injizierten
 * Sender ersetzt — so bleibt `sent` deterministisch und es gibt keinen echten Netzwerkzugriff.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'a@example.com,b@example.com';
process.env.SESSION_SECRET = 'push-test-endpoint-secret';
process.env.GOOGLE_CLIENT_ID = 'push-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'push-test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

let server: TestServer;
let sentEndpoints: string[] = [];

/**
 * Injizierter Erfolgs-Sender: zählt die Zustellungen (kein echter Web-Push mit den Fake-Schlüsseln).
 * Die Route `/push/test` muss den Sender über `AppDeps` akzeptieren — analog `pillarClassifier`/
 * `taskTextParser` in `createApp` — das ist Teil der Umsetzung.
 */
const recordingSender: PushSender = (subscription) => {
	sentEndpoints.push(subscription.endpoint);
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

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

const postTest = (cookie?: string) =>
	fetch(`${server.baseUrl}/push/test`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
	});

describe('POST /push/test — Test-Push mit rotierendem Zitat (#386, AK2 + AK4)', () => {
	before(async () => {
		server = await startTestServer({ pushSender: recordingSender });
	});
	beforeEach(async () => {
		await resetDb();
		sentEndpoints = [];
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('AK2: 200 mit { sent, quote: { text, author } } bei vorhandener Subscription', async () => {
		const cookie = await login('a@example.com');
		assert.equal((await subscribe(cookie, 'https://push.example.com/a')).status, 201);

		const res = await postTest(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { sent: number; quote: { text: string; author: string } };

		assert.equal(typeof body.sent, 'number');
		assert.ok(body.sent >= 1, 'mit vorhandener Subscription wird mindestens einmal zugestellt');
		assert.ok(body.quote, 'Response enthält ein Zitat');
		assert.ok(body.quote.text.trim().length > 0, 'quote.text ist nicht leer');
		assert.ok(body.quote.author.trim().length > 0, 'quote.author ist nicht leer');
	});

	it('AK2: das zurückgegebene Zitat ist eines der 10 definierten', async () => {
		const cookie = await login('a@example.com');
		await subscribe(cookie, 'https://push.example.com/a');

		const res = await postTest(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { quote: { text: string; author: string } };

		assert.ok(
			QUOTES.some((quote) => quote.text === body.quote.text && quote.author === body.quote.author),
			`unerwartetes Zitat: ${JSON.stringify(body.quote)}`,
		);
	});

	it('AK2: ohne Subscription liefert es sent: 0 (kein Fehler)', async () => {
		const cookie = await login('a@example.com');

		const res = await postTest(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { sent: number; quote: { text: string; author: string } };
		assert.equal(body.sent, 0);
		assert.ok(body.quote, 'auch ohne Subscription wird ein Zitat gewählt');
	});

	it('AK4: 401, wenn nicht eingeloggt (kein Cookie)', async () => {
		const res = await postTest();
		assert.equal(res.status, 401);
	});

	it('AK4: 503, wenn Web-Push nicht konfiguriert ist (VAPID fehlt)', async () => {
		const cookie = await login('a@example.com');
		const saved = process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PUBLIC_KEY;
		try {
			const res = await postTest(cookie);
			assert.equal(res.status, 503);
		} finally {
			process.env.VAPID_PUBLIC_KEY = saved;
		}
	});

	it('AK4: Datenisolation — sendet nur an Subscriptions des eingeloggten Nutzers', async () => {
		const cookieA = await login('a@example.com');
		const cookieB = await login('b@example.com');
		await subscribe(cookieA, 'https://push.example.com/a');

		// B (ohne eigene Subscription) löst einen Test-Push aus — A's Subscription darf NICHT angesprochen werden.
		const res = await postTest(cookieB);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { sent: number };

		assert.equal(body.sent, 0, 'B hat keine eigene Subscription — es wird nichts zugestellt');
		assert.ok(
			!sentEndpoints.includes('https://push.example.com/a'),
			'die Subscription von A darf durch B NICHT angesprochen werden',
		);
		assert.equal(await PushSubscription.count(), 1, 'A-Subscription bleibt unangetastet erhalten');
	});
});
