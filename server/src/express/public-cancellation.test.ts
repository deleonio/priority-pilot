import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { AppDeps } from './index.js';
import type { MailSender } from '../logics/mail.js';

/**
 * Rote Spec-Tests für #2317 (Vertrag: docs/spec/issue-2317.md) — AK3–AK6: öffentliche Kündigung
 * ohne Login. Endpunkte `/public/cancellation/request|confirm` und das Modell `CancellationToken`
 * existieren noch nicht. Setup-Muster `billing-subscriptions-cancel.test.ts`. Das IP-Limit (20)
 * ist als Literal aus der Spec gespiegelt.
 */

applyTestAuthEnv('test-secret-issue-2317');

let server: TestServer;
let mails: Parameters<MailSender>[0][];
let cancelCalls: string[];

const ORDINARY = { kind: 'ordinary' };
const REQUEST = '/public/cancellation/request';
const CONFIRM = '/public/cancellation/confirm';

const post = (path: string, body: unknown) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

const requestCancel = (email: string, extra: object = ORDINARY) => post(REQUEST, { email, ...extra });

const tokenFromMail = (mail: Parameters<MailSender>[0]): string => {
	const match = /token=([A-Za-z0-9_-]+)/.exec(mail.text);
	assert.ok(match, 'Mail enthält keinen Bestätigungslink mit token=');
	return match[1];
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Konto mit PayPal-Abo; Rückgabe ist das Abo. */
const accountWithSub = async (email: string, status = 'active') => {
	const cookie = await server.login(email);
	const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
		id: number;
	};
	return Subscription.create({
		userId: me.id,
		provider: 'paypal',
		externalSubscriptionId: `I-2317-${me.id}`,
		plan: 'plus',
		period: 'monthly',
		status,
		currentPeriodEnd: new Date('2027-06-01'),
	});
};

describe('Öffentliche Kündigung #2317', () => {
	beforeEach(async () => {
		await resetDb();
		mails = [];
		cancelCalls = [];
		server = await startTestServer({
			paypalClient: {
				createSubscription: async () => ({ approvalUrl: 'https://paypal.example/x', externalSubscriptionId: 'I-X' }),
				cancel: async (id: string) => {
					cancelCalls.push(id);
				},
				revise: async () => ({}),
			},
			mailSender: async (payload) => {
				mails.push(payload);
			},
		} as unknown as AppDeps);
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK3: gleiche Antwort für unbekannte Adresse, Konto ohne Abo und Konto mit Abo; nur beim Abo genau eine Mail an die Konto-Adresse', async () => {
		await server.login('ohne-abo@example.com');
		await accountWithSub('mit-abo@example.com');

		const unknown = await requestCancel('niemand@example.com');
		const noSub = await requestCancel('ohne-abo@example.com');
		assert.equal(mails.length, 0, 'ohne kündbares Abo darf keine Mail rausgehen');
		const withSub = await requestCancel('mit-abo@example.com');

		for (const res of [unknown, noSub, withSub]) {
			assert.equal(res.status, 202);
		}
		const bodies = await Promise.all([unknown, noSub, withSub].map((r) => r.text()));
		assert.equal(bodies[0], bodies[1]);
		assert.equal(bodies[1], bodies[2]);
		assert.equal(mails.length, 1);
		assert.equal(mails[0].to, 'mit-abo@example.com');
	});

	it('AK4: Token ist einmalig — die zweite Einlösung kündigt nicht erneut', async () => {
		await accountWithSub('einmal@example.com');
		await requestCancel('einmal@example.com');
		const token = tokenFromMail(mails[0]);

		assert.equal((await post(CONFIRM, { token })).status, 200);
		const second = await post(CONFIRM, { token });
		assert.equal(second.status, 400);
		assert.equal(cancelCalls.length, 1, 'checkout.cancel darf nur einmal laufen');
	});

	it('AK4: abgelaufener Token kündigt nicht', async () => {
		await accountWithSub('abgelaufen@example.com');
		await requestCancel('abgelaufen@example.com');
		const token = tokenFromMail(mails[0]);
		const { default: CancellationToken } = await import('../models/cancellationToken.js');
		await CancellationToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });

		assert.equal((await post(CONFIRM, { token })).status, 400);
		assert.equal(cancelCalls.length, 0);
	});

	it('AK4: in der DB liegt nur der SHA-256-Hash des Tokens', async () => {
		await accountWithSub('hash@example.com');
		await requestCancel('hash@example.com');
		const token = tokenFromMail(mails[0]);
		const { default: CancellationToken } = await import('../models/cancellationToken.js');
		const rows = await CancellationToken.findAll();

		assert.equal(rows.length, 1);
		assert.equal(rows[0].get('tokenHash'), sha256(token));
		assert.ok(!JSON.stringify(rows[0].toJSON()).includes(token), 'Klartext-Token darf nicht persistiert sein');
	});

	it('AK5: Bestätigung kündigt bei PayPal, speichert die Felder und sendet die Bestätigungsmail', async () => {
		const sub = await accountWithSub('bestaetigt@example.com');
		await requestCancel('bestaetigt@example.com', { kind: 'ordinary' });
		const token = tokenFromMail(mails[0]);

		assert.equal((await post(CONFIRM, { token })).status, 200);

		assert.deepEqual(cancelCalls, [sub.get('externalSubscriptionId')]);
		await sub.reload();
		assert.equal(sub.get('cancellationKind'), 'ordinary');
		assert.equal(sub.get('cancellationEmail'), 'bestaetigt@example.com');
		assert.ok(sub.get('cancellationRequestedAt'));
		assert.equal(mails.length, 2, 'Anfrage-Mail + Kündigungsbestätigung');
		assert.equal(mails[1].subject, 'Balamentum: Bestätigung deiner Kündigung');
		assert.equal(mails[1].to, 'bestaetigt@example.com');
	});

	it('AK5: außerordentliche Kündigung speichert den Grund', async () => {
		const sub = await accountWithSub('ausserordentlich@example.com');
		await requestCancel('ausserordentlich@example.com', { kind: 'extraordinary', reason: 'Preiserhöhung' });
		await post(CONFIRM, { token: tokenFromMail(mails[0]) });

		await sub.reload();
		assert.equal(sub.get('cancellationKind'), 'extraordinary');
		assert.equal(sub.get('cancellationReason'), 'Preiserhöhung');
	});

	it('AK5: GET auf den Link kündigt nicht und verbraucht den Token nicht', async () => {
		await accountWithSub('prefetch@example.com');
		await requestCancel('prefetch@example.com');
		const token = tokenFromMail(mails[0]);

		const get = await fetch(`${server.baseUrl}${CONFIRM}?token=${token}`);
		assert.equal(get.status, 200);
		assert.equal(cancelCalls.length, 0, 'GET darf nichts kündigen');
		assert.equal((await post(CONFIRM, { token })).status, 200, 'Token gilt nach dem GET noch');
	});

	it('AK6: je Adresse begrenzt — Überschreitung → 429 THROTTLED_MESSAGE ohne weitere Mail', async () => {
		await accountWithSub('limit@example.com');
		for (let i = 0; i < 3; i += 1) assert.equal((await requestCancel('limit@example.com')).status, 202);
		const mailsBefore = mails.length;

		const res = await requestCancel('limit@example.com');
		assert.equal(res.status, 429);
		assert.deepEqual(await res.json(), { message: 'Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten.' });
		assert.equal(mails.length, mailsBefore, 'bei 429 geht keine Mail raus');
	});

	it('AK6: je IP begrenzt — mehr als 20 Anfragen für verschiedene Adressen → 429', async () => {
		for (let i = 0; i < 20; i += 1) assert.equal((await requestCancel(`ip${i}@example.com`)).status, 202);
		assert.equal((await requestCancel('ip-zuviel@example.com')).status, 429);
	});
});
