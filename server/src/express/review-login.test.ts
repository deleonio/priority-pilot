import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';

/**
 * Prüfzugang für Google Play (#2426, AK1–AK4): `POST /auth/review-login` und das Flag
 * `reviewAccess` in `GET /auth/providers`. Vertrag: docs/spec/issue-2426.md.
 * Die Drossel (AK5) steht in `review-login-throttle.test.ts` (eigener Prozess, eigener Zähler).
 */
applyTestAuthEnv('review-login');

const PASSWORD = 'play-review-secret';

let server: TestServer;

const reviewLogin = (password: unknown) =>
	server.json('/auth/review-login', { method: 'POST', body: JSON.stringify({ password }) });

const meWith = async (res: Response) => {
	const cookie = res.headers.get('set-cookie')?.split(';')[0];
	assert.ok(cookie, 'Erfolgreicher Login setzt einen Session-Cookie');
	return server.json('/auth/me', { headers: { cookie } });
};

describe('Prüfzugang Google Play (#2426)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		process.env.PLAY_REVIEW_PASSWORD = PASSWORD;
		delete process.env.PLAY_REVIEW_EMAIL;
	});
	after(async () => {
		delete process.env.PLAY_REVIEW_PASSWORD;
		await server.close();
		await closeDb();
	});

	it('AK1: /auth/providers meldet reviewAccess nur bei gesetztem, nicht leerem Passwort', async () => {
		assert.equal(
			((await (await server.json('/auth/providers')).json()) as { reviewAccess: boolean }).reviewAccess,
			true,
		);
		process.env.PLAY_REVIEW_PASSWORD = '';
		assert.equal(
			((await (await server.json('/auth/providers')).json()) as { reviewAccess: boolean }).reviewAccess,
			false,
		);
		delete process.env.PLAY_REVIEW_PASSWORD;
		assert.equal(
			((await (await server.json('/auth/providers')).json()) as { reviewAccess: boolean }).reviewAccess,
			false,
		);
	});

	it('AK2: korrektes Passwort → 200, Session als Pro-Prüfkonto, zweiter Login legt kein zweites Konto an', async () => {
		const res = await reviewLogin(PASSWORD);
		assert.equal(res.status, 200);
		const me = await meWith(res);
		assert.equal(me.status, 200);
		const body = (await me.json()) as { plan: string; email: string };
		assert.equal(body.plan, 'pro');

		const again = await reviewLogin(PASSWORD);
		assert.equal(again.status, 200);
		assert.equal(await User.count({ where: { email: body.email } }), 1);
		assert.equal(await User.count(), 1, 'genau ein Konto insgesamt');
	});

	it('AK3: plan wird bei jedem Login auf pro zurückgesetzt, auch nach zwischenzeitlich free', async () => {
		await reviewLogin(PASSWORD);
		await User.update({ plan: 'free' }, { where: {} });

		const res = await reviewLogin(PASSWORD);
		assert.equal(res.status, 200);
		assert.equal(((await (await meWith(res)).json()) as { plan: string }).plan, 'pro');
		assert.equal((await User.findAll()).at(0)?.plan, 'pro');
	});

	it('AK4: falsches oder leeres Passwort → 401 ohne Session', async () => {
		assert.equal((await reviewLogin(PASSWORD)).status, 200, 'Route existiert und akzeptiert das richtige Passwort');
		for (const password of ['falsch', '', undefined]) {
			const res = await reviewLogin(password);
			assert.equal(res.status, 401);
			assert.equal(res.headers.get('set-cookie'), null, 'keine Session bei Fehlversuch');
		}
	});

	it('AK4: abgeschalteter Prüfzugang → auch das zuvor gültige Passwort liefert 401', async () => {
		assert.equal((await reviewLogin(PASSWORD)).status, 200);
		delete process.env.PLAY_REVIEW_PASSWORD;
		const res = await reviewLogin(PASSWORD);
		assert.equal(res.status, 401);
		assert.equal(res.headers.get('set-cookie'), null);
	});
});
