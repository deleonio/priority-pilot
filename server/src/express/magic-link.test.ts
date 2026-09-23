import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import type { MailSender } from '../logics/mail.js';
import { LoginToken, User } from '../models/index.js';

/**
 * Magic-Link-Login per E-Mail: Anfordern (`POST /auth/magic-link`), Einlösen
 * (`POST /auth/magic-link/verify`) und die Anbieter-Übersicht (`GET /auth/providers`).
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'erlaubt@example.com,google@example.com';
applyTestAuthEnv('magic-link');
process.env.SMTP_HOST = 'smtp.example.com';
process.env.MAIL_FROM = 'noreply@example.com';
process.env.PUBLIC_BASE_URL = 'https://app.example.com/';

const ALLOWED = 'erlaubt@example.com';

let server: TestServer;
let sent: { to: string; text: string }[] = [];

const recordingSender: MailSender = (payload) => {
	sent.push({ to: payload.to, text: payload.text });
	return Promise.resolve();
};

const requestLink = (email: unknown) =>
	server.json('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) });

const verify = (token: unknown) =>
	server.json('/auth/magic-link/verify', { method: 'POST', body: JSON.stringify({ token }) });

/** Token aus dem Link der zuletzt verschickten Mail. */
const lastToken = (): string => {
	const match = /\?magic=([\w-]+)/.exec(sent.at(-1)?.text ?? '');
	assert.ok(match, 'Die Mail enthält einen Link mit ?magic=');
	return decodeURIComponent(match[1]);
};

const meWith = async (res: Response) => {
	const cookie = res.headers.get('set-cookie')?.split(';')[0];
	assert.ok(cookie, 'Einlösen setzt einen Session-Cookie');
	return server.json('/auth/me', { headers: { cookie } });
};

describe('Magic-Link-Login per E-Mail', () => {
	before(async () => {
		server = await startTestServer({ mailSender: recordingSender });
	});
	beforeEach(async () => {
		await resetDb();
		sent = [];
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('GET /auth/providers meldet Google und Magic Link als konfiguriert', async () => {
		const res = await server.json('/auth/providers');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { google: true, magicLink: true });
	});

	it('zugelassene Adresse: 202, genau eine Mail mit Link auf PUBLIC_BASE_URL, DB hält nur den Hash', async () => {
		const res = await requestLink('  Erlaubt@Example.com ');
		assert.equal(res.status, 202);
		assert.equal(sent.length, 1);
		assert.equal(sent[0].to, ALLOWED, 'Adresse wird normalisiert');
		assert.match(sent[0].text, /https:\/\/app\.example\.com\/app\/\?magic=/);

		const token = lastToken();
		const rows = await LoginToken.findAll();
		assert.equal(rows.length, 1);
		assert.equal(rows[0].tokenHash, createHash('sha256').update(token).digest('hex'));
		assert.notEqual(rows[0].tokenHash, token, 'Klartext wird nie gespeichert');
	});

	it('nicht zugelassene Adresse: dieselbe 202-Antwort, aber keine Mail und kein Token', async () => {
		const allowed = await (await requestLink(ALLOWED)).json();
		const res = await requestLink('fremd@example.com');
		assert.equal(res.status, 202);
		assert.deepEqual(await res.json(), allowed, 'Antwort verrät nicht, ob die Adresse zugelassen ist');
		assert.equal(sent.length, 1, 'nur die zugelassene Adresse bekam eine Mail');
		assert.equal(await LoginToken.count({ where: { email: 'fremd@example.com' } }), 0);
	});

	it('ungültige Eingabe → 400', async () => {
		assert.equal((await requestLink('keine-adresse')).status, 400);
		assert.equal((await requestLink(42)).status, 400);
	});

	it('höchstens drei Links pro Adresse und Zeitfenster, danach still 202 ohne Mail', async () => {
		for (let i = 0; i < 4; i++) {
			assert.equal((await requestLink(ALLOWED)).status, 202);
		}
		assert.equal(sent.length, 3);
	});

	it('Einlösen legt einen neuen Nutzer an und meldet ihn an', async () => {
		await requestLink(ALLOWED);
		const res = await verify(lastToken());
		assert.equal(res.status, 204);

		const me = await meWith(res);
		assert.equal(me.status, 200);
		const body = (await me.json()) as { email: string; displayName: string };
		assert.equal(body.email, ALLOWED);
		assert.equal(body.displayName, ALLOWED, 'ohne Profilname gilt die E-Mail');
		assert.equal(await User.count({ where: { email: ALLOWED } }), 1);
	});

	it('ein Token gilt genau einmal', async () => {
		await requestLink(ALLOWED);
		const token = lastToken();
		assert.equal((await verify(token)).status, 204);
		assert.equal((await verify(token)).status, 400);
	});

	it('paralleles Doppel-Einlösen: nur ein Versuch gewinnt', async () => {
		await requestLink(ALLOWED);
		const token = lastToken();
		const statuses = (await Promise.all([verify(token), verify(token), verify(token)])).map((r) => r.status).sort();
		assert.deepEqual(statuses, [204, 400, 400]);
	});

	it('abgelaufener, unbekannter oder fehlender Token → 400', async () => {
		await requestLink(ALLOWED);
		const token = lastToken();
		await LoginToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });
		assert.equal((await verify(token)).status, 400);
		assert.equal((await verify('gibt-es-nicht')).status, 400);
		assert.equal((await verify(undefined)).status, 400);
	});

	it('Bestandsnutzer aus Google: Name und Avatar bleiben beim Magic-Link-Login erhalten', async () => {
		await User.create({
			email: 'google@example.com',
			passwordHash: '__oauth__',
			displayName: 'Google Name',
			avatarUrl: 'https://lh3.googleusercontent.com/a.jpg',
		});
		await requestLink('google@example.com');
		assert.equal((await verify(lastToken())).status, 204);

		const user = await User.findOne({ where: { email: 'google@example.com' } });
		assert.equal(user?.displayName, 'Google Name');
		assert.equal(user?.avatarUrl, 'https://lh3.googleusercontent.com/a.jpg');
		assert.equal(await User.count({ where: { email: 'google@example.com' } }), 1, 'kein zweites Konto');
	});

	it('ohne SMTP/PUBLIC_BASE_URL: 503 und providers meldet magicLink=false', async () => {
		const saved = process.env.PUBLIC_BASE_URL;
		delete process.env.PUBLIC_BASE_URL;
		try {
			assert.equal((await requestLink(ALLOWED)).status, 503);
			assert.equal((await verify('x')).status, 503);
			const providers = (await (await server.json('/auth/providers')).json()) as { magicLink: boolean };
			assert.equal(providers.magicLink, false);
		} finally {
			process.env.PUBLIC_BASE_URL = saved;
		}
	});
});
