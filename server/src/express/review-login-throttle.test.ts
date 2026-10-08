import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Prüfzugang Google Play (#2426, AK5): Fehlversuchs-Drossel von `POST /auth/review-login`.
 * Eigene Datei, damit der Zähler (je Prozess) nicht von den Fehlversuchen in
 * `review-login.test.ts` vorbelastet ist. Die Drossel greift bewusst auch außerhalb von production.
 */
applyTestAuthEnv('review-login-throttle');
process.env.PLAY_REVIEW_PASSWORD = 'play-review-secret';

let server: TestServer;

const reviewLogin = (password: string) =>
	server.json('/auth/review-login', { method: 'POST', body: JSON.stringify({ password }) });

describe('Prüfzugang Google Play — Drossel (#2426)', () => {
	before(async () => {
		server = await startTestServer();
		await resetDb();
	});
	after(async () => {
		delete process.env.PLAY_REVIEW_PASSWORD;
		await server.close();
		await closeDb();
	});

	it('AK5: nach 5 Fehlversuchen → 429, auch auf das anschließend korrekte Passwort', async () => {
		assert.equal((await reviewLogin('play-review-secret')).status, 200, 'Route existiert (Erfolge zählen nicht)');
		for (let i = 0; i < 5; i += 1) {
			assert.equal((await reviewLogin('falsch')).status, 401, `Fehlversuch ${i + 1} → 401`);
		}
		const res = await reviewLogin('play-review-secret');
		assert.equal(res.status, 429);
		assert.equal(res.headers.get('set-cookie'), null, 'gedrosselt → keine Session');
	});
});
