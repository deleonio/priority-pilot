import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { getPlansCatalog } from '../logics/plans.js';

/**
 * Rote Spec-Tests für #1456 (Spec docs/spec/issue-1456.md, T1 AK3) — öffentlicher `GET /plans`.
 *
 * Der Router ist bewusst VOR `app.use(requireAuth)` gemountet (Muster `inviteLinksPublicRouter`)
 * — ein Request ohne Session muss 200 bekommen. Die gelieferte Matrix/Preise stammen aus
 * `plans.ts`, keine zweite Kopie im Router.
 *
 * Rot, bis `GET /plans` existiert (heute: 404, da kein Router registriert ist). KEIN Produktivcode.
 */

let server: TestServer;

describe('GET /plans (#1456 AK3) — öffentlich, ohne Session', () => {
	before(async () => {
		server = await startTestServer();
		await resetDb();
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('liefert 200 ohne Session-Cookie', async () => {
		const res = await fetch(`${server.baseUrl}/plans`);
		assert.equal(res.status, 200, 'GET /plans muss ohne Session erreichbar sein');
	});

	it('liefert exakt die Matrix und Preise aus plans.ts (keine Dubletten-Literale im Router)', async () => {
		const res = await fetch(`${server.baseUrl}/plans`);
		const body = await res.json();
		assert.deepEqual(body, getPlansCatalog(), 'Response muss byte-identisch zu getPlansCatalog() sein');
	});
});
