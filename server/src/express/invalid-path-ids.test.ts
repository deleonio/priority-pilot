import { describe, it, before, beforeEach, after } from 'node:test';
import { User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer, expectError } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2548 (Spec docs/spec/issue-2548.md): nicht-numerische oder nicht-positive
 * Pfad-IDs antworten auf allen betroffenen Routern mit 400 `{ message }` (parseId, Muster
 * admin.ts:335-338) statt heute 404/500.
 *
 * Bewusst eigene Datei statt error-contract.test.ts: deren Suiten laufen im Pass-Through-Modus —
 * `applyTestAuthEnv` setzt SESSION_SECRET und würde damit `isAuthActive()` aktivieren, sodass die
 * bestehenden unauthentifizierten Vertragsfälle 401 bekämen.
 *
 * Dedup: admin ist bereits durch admin.api.test.ts (`PATCH /admin/users/abc/plan` → 400) gedeckt;
 * categories ist heute schon konform und geht als grüner Spiegel in die Suite (AK2 verlangt je
 * Router mindestens eine 400-Route).
 */

applyTestAuthEnv('invalid-path-ids-2548');
process.env.GOOGLE_ALLOWED_EMAILS = 'user@example.com';

type RouteCase = { name: string; method: string; path: string; body?: unknown };

const cases: RouteCase[] = [
	{ name: 'GET /groups/:id', method: 'GET', path: '/groups/abc' },
	{ name: 'DELETE /api-tokens/:id', method: 'DELETE', path: '/api-tokens/abc' },
	// #2549 (PO-Nit aus dem #2595-Review): Body gültig, damit die 400 vom Id-Guard kommt und nicht
	// schon aus validateUpdateBody.
	{ name: 'PATCH /categories/:id', method: 'PATCH', path: '/categories/abc', body: { name: 'X' } },
	{ name: 'DELETE /place-favorites/:id', method: 'DELETE', path: '/place-favorites/abc' },
	{
		name: 'PATCH /knowledge-entries/:id',
		method: 'PATCH',
		path: '/knowledge-entries/abc',
		body: { text: 'Vertragstest' },
	},
	{ name: 'PATCH /journal/:id', method: 'PATCH', path: '/journal/abc', body: { text: 'Vertragstest' } },
	{ name: 'DELETE /calendar-sources/:id', method: 'DELETE', path: '/calendar-sources/abc' },
];

describe('Ungültige Pfad-IDs → 400 mit message (#2548)', () => {
	let server: TestServer;
	let cookie = '';

	const call = (c: RouteCase) =>
		fetch(`${server.baseUrl}${c.path}`, {
			method: c.method,
			headers: { 'Content-Type': 'application/json', cookie },
			body: c.body === undefined ? undefined : JSON.stringify(c.body),
		});

	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
		cookie = await server.login('user@example.com');
		// knowledge-entries hängen am Plan-Guard (`knowledge_entries` = pro).
		await User.update({ plan: 'pro' }, { where: { email: 'user@example.com' } });
	});

	after(async () => {
		await server.close();
		await closeDb();
	});

	for (const c of cases) {
		it(`${c.name} mit "abc" → 400 mit message (AK2)`, async () => {
			await expectError(await call(c), 400);
		});
	}

	it('DELETE /api-tokens/0 und /-1 → 400 (nicht-positive Ids, parseId-Vertrag)', async () => {
		await expectError(await call({ name: '', method: 'DELETE', path: '/api-tokens/0' }), 400);
		await expectError(await call({ name: '', method: 'DELETE', path: '/api-tokens/-1' }), 400);
	});
});
