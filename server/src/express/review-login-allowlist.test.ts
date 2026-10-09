import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { AllowedEmail } from '../models/index.js';

/**
 * Prüfzugang Google Play (#2456): Die Prüf-Session muss die Allowlist passieren — der Login umgeht
 * sie bewusst, `requireAuth` prüft sie aber je Request erneut. Eigene Datei, damit der
 * Fehlversuchs-Zähler der Drossel (je Prozess) nicht von `review-login.test.ts` vorbelastet ist.
 */
applyTestAuthEnv('review-login-allowlist');
process.env.PLAY_REVIEW_PASSWORD = 'play-review-secret';
process.env.GOOGLE_ALLOWED_EMAILS = 'someone-else@example.com';

let server: TestServer;

describe('Prüfzugang Google Play — Allowlist (#2456)', () => {
	before(async () => {
		server = await startTestServer();
		await resetDb();
	});
	after(async () => {
		delete process.env.PLAY_REVIEW_PASSWORD;
		delete process.env.GOOGLE_ALLOWED_EMAILS;
		await server.close();
		await closeDb();
	});

	it('AK1: Session passiert requireAuth — Daten-Endpoint 200 statt 401, DB-Zulassung mit Herkunft pruefkonto', async () => {
		const login = await server.json('/auth/review-login', {
			method: 'POST',
			body: JSON.stringify({ password: 'play-review-secret' }),
		});
		assert.equal(login.status, 200);
		const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
		const tasks = await server.json('/tasks', { headers: { cookie } });
		assert.equal(tasks.status, 200, 'Prüf-Session trotz Allowlist zugelassen');
		const allowed = await AllowedEmail.findOne({
			where: { email: 'google-play-review@balamentum.invalid' },
		});
		assert.equal(allowed?.origin, 'pruefkonto');
	});
});
