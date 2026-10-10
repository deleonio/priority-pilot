import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Task, User } from '../models/index.js';

/**
 * Prüfzugang für Google Play (#2426, AK1–AK4): `POST /auth/review-login` und das Flag
 * `reviewAccess` in `GET /auth/providers`. Vertrag: docs/spec/issue-2426.md.
 * Reset bei jedem Login (#2442): `describe` am Dateiende, Vertrag docs/spec/issue-2442.md.
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

	it('#2471 AK1: nach Prüf-Login meldet /auth/me demoHint, wenn der Schalter an ist', async () => {
		process.env.PLAY_REVIEW_PASSWORD = PASSWORD;
		process.env.DEMO_HINT_ENABLED = 'true';
		try {
			const res = await reviewLogin(PASSWORD);
			assert.equal(res.status, 200);
			const me = await meWith(res);
			assert.equal(((await me.json()) as { demoHint?: boolean }).demoHint, true);
		} finally {
			delete process.env.DEMO_HINT_ENABLED;
		}
	});

	describe('Reset bei jedem Login (#2442)', () => {
		const cookieOf = (res: Response) => res.headers.get('set-cookie')?.split(';')[0] ?? '';
		const tasksOf = async (cookie: string) =>
			(await (await server.json('/tasks', { headers: { cookie } })).json()) as unknown[];

		it('AK1: Aufgabe aus der vorherigen Sitzung ist nach erneutem Login weg', async () => {
			const cookie = cookieOf(await reviewLogin(PASSWORD));
			const created = await server.json('/tasks', {
				method: 'POST',
				headers: { cookie },
				body: JSON.stringify({ title: 'Altlast', priority: 3, estimatedEffort: 1 }),
			});
			assert.equal(created.status, 201);
			assert.equal((await tasksOf(cookie)).length, 1);

			const again = await reviewLogin(PASSWORD);
			assert.equal(again.status, 200);
			assert.deepEqual(await tasksOf(cookieOf(again)), []);
		});

		it('AK2: neue User-Id und termsAccepted=false trotz zuvor erteilter Zustimmung', async () => {
			const first = await reviewLogin(PASSWORD);
			const cookie = cookieOf(first);
			const firstMe = (await (await meWith(first)).json()) as { id: number };
			const accepted = await server.json('/auth/terms', {
				method: 'POST',
				headers: { cookie },
				body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true }),
			});
			assert.equal(accepted.status, 204);
			const acceptedMe = (await (await server.json('/auth/me', { headers: { cookie } })).json()) as {
				termsAccepted: boolean;
			};
			assert.equal(acceptedMe.termsAccepted, true, 'Vorbedingung: Zustimmung erteilt');

			const second = await meWith(await reviewLogin(PASSWORD));
			const secondMe = (await second.json()) as { id: number; termsAccepted: boolean };
			assert.equal(secondMe.termsAccepted, false);
			assert.notEqual(secondMe.id, firstMe.id);
		});

		it('AK3: plan ist nach dem Reset pro', async () => {
			await reviewLogin(PASSWORD);
			await User.update({ plan: 'free' }, { where: {} });
			const me = (await (await meWith(await reviewLogin(PASSWORD))).json()) as { plan: string };
			assert.equal(me.plan, 'pro');
		});

		it('AK4: Daten eines anderen Kontos bleiben unverändert', async () => {
			const otherCookie = await server.login('other@example.com');
			await server.json('/tasks', {
				method: 'POST',
				headers: { cookie: otherCookie },
				body: JSON.stringify({ title: 'Fremd', priority: 2, estimatedEffort: 1 }),
			});
			await reviewLogin(PASSWORD);
			await reviewLogin(PASSWORD);

			assert.equal((await tasksOf(otherCookie)).length, 1);
			assert.equal(await Task.count({ where: { title: 'Fremd' } }), 1);
			assert.ok(await User.findOne({ where: { email: 'other@example.com' } }));
		});

		it('AK5: Fehlversuch (401) löscht das bestehende Prüfkonto nicht', async () => {
			const first = await reviewLogin(PASSWORD);
			const firstMe = (await (await meWith(first)).json()) as { id: number };
			await server.json('/tasks', {
				method: 'POST',
				headers: { cookie: cookieOf(first) },
				body: JSON.stringify({ title: 'Bleibt', priority: 3, estimatedEffort: 1 }),
			});

			assert.equal((await reviewLogin('falsch')).status, 401);

			assert.ok(await User.findByPk(firstMe.id), 'Konto besteht weiter');
			assert.equal(await Task.count({ where: { title: 'Bleibt' } }), 1);
		});
	});
});
