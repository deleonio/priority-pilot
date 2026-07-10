/**
 * Rote Spec-Tests für Issue #207: API-Schutz & Datenisolation
 *
 * AK 4 — API-Schutz: Alle Endpunkte ohne gültige Session → 401
 * AK 5 — Datenisolation: User A sieht nur eigene Tasks/Säulen, nicht die von User B
 *
 * Diese Tests werden grün, sobald:
 *  - requireAuth-Middleware auf alle Routen angewendet wird (unabhängig von GOOGLE_ALLOWED_EMAIL)
 *  - Tasks und Säulen an userId gebunden werden (DB-Migration + Query-Filter)
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Auth-Kontext: Der Test-Login-Endpunkt braucht SESSION_SECRET; Google-Felder für Passport-Init.
process.env.SESSION_SECRET = 'test-secret-issue-207';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/** Registriert einen neuen Nutzer und gibt den Session-Cookie zurück. */
const register = async (email: string, password: string): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	assert.equal(res.status, 201, `Register ${email} muss 201 liefern`);
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
	return setCookie.split(';')[0];
};

describe('API-Schutz & Datenisolation (#207)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const fetchJson = (path: string, init: RequestInit = {}) =>
		fetch(`${server.baseUrl}${path}`, {
			...init,
			headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
		});

	const withCookie = (cookie: string): Record<string, string> => ({ Cookie: cookie });

	// ── AK 4 — Alle Endpunkte ohne Session → 401 ─────────────────────────────
	//
	// Die neue requireAuth-Middleware greift ohne hasAllowlist()-Bedingung: Eine fehlende
	// Session liefert immer 401, unabhängig davon, ob GOOGLE_ALLOWED_EMAIL gesetzt ist.

	describe('AK 4 — Kein Session-Cookie → 401 für alle API-Endpunkte', () => {
		it('GET /tasks ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/tasks`);
			assert.equal(res.status, 401);
		});

		it('POST /tasks ohne Session → 401', async () => {
			const res = await fetchJson('/tasks', {
				method: 'POST',
				body: JSON.stringify({ title: 'Unauth', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(res.status, 401);
		});

		it('PATCH /tasks/1 ohne Session → 401', async () => {
			const res = await fetchJson('/tasks/1', {
				method: 'PATCH',
				body: JSON.stringify({ title: 'Updated' }),
			});
			assert.equal(res.status, 401);
		});

		it('DELETE /tasks/1 ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/tasks/1`, { method: 'DELETE' });
			assert.equal(res.status, 401);
		});

		it('GET /pillars ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/pillars`);
			assert.equal(res.status, 401);
		});

		it('PUT /pillars/weights ohne Session → 401', async () => {
			const res = await fetchJson('/pillars/weights', {
				method: 'PUT',
				body: JSON.stringify({ weights: [] }),
			});
			assert.equal(res.status, 401);
		});

		it('GET /forest ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/forest`);
			assert.equal(res.status, 401);
		});

		it('GET /next ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/next`);
			assert.equal(res.status, 401);
		});
	});

	// ── AK 5 — Datenisolation: User A sieht nur eigene Tasks ─────────────────

	describe('AK 5 — Datenisolation zwischen zwei Nutzern (Tasks)', () => {
		it('GET /tasks liefert nur die Tasks des eingeloggten Nutzers', async () => {
			const cookieA = await register('alice@example.com', 'passwort-alice');
			const cookieB = await register('bob@example.com', 'passwort-bob');

			// Alice erstellt einen Task
			const resA = await fetchJson('/tasks', {
				method: 'POST',
				headers: withCookie(cookieA),
				body: JSON.stringify({ title: 'Task von Alice', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(resA.status, 201, 'Alice soll Task erstellen können');

			// Bob erstellt einen Task
			const resB = await fetchJson('/tasks', {
				method: 'POST',
				headers: withCookie(cookieB),
				body: JSON.stringify({ title: 'Task von Bob', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(resB.status, 201, 'Bob soll Task erstellen können');

			// Alice sieht nur ihren Task
			const listA = await fetch(`${server.baseUrl}/tasks`, { headers: withCookie(cookieA) });
			assert.equal(listA.status, 200);
			const tasksA = (await listA.json()) as { title: string }[];
			assert.equal(tasksA.length, 1, `Alice soll genau 1 Task sehen, sieht ${tasksA.length}`);
			assert.equal(tasksA[0].title, 'Task von Alice');

			// Bob sieht nur seinen Task
			const listB = await fetch(`${server.baseUrl}/tasks`, { headers: withCookie(cookieB) });
			assert.equal(listB.status, 200);
			const tasksB = (await listB.json()) as { title: string }[];
			assert.equal(tasksB.length, 1, `Bob soll genau 1 Task sehen, sieht ${tasksB.length}`);
			assert.equal(tasksB[0].title, 'Task von Bob');
		});

		it('PATCH auf fremden Task → 403 oder 404', async () => {
			const cookieA = await register('alice@example.com', 'passwort-alice');
			const cookieB = await register('bob@example.com', 'passwort-bob');

			const createRes = await fetchJson('/tasks', {
				method: 'POST',
				headers: withCookie(cookieB),
				body: JSON.stringify({ title: 'Bobs Task', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(createRes.status, 201);
			const bobsTask = (await createRes.json()) as { id: number };

			const patchRes = await fetchJson(`/tasks/${bobsTask.id}`, {
				method: 'PATCH',
				headers: withCookie(cookieA),
				body: JSON.stringify({ title: 'Von Alice manipuliert' }),
			});
			assert.ok(
				patchRes.status === 403 || patchRes.status === 404,
				`PATCH auf fremden Task muss 403 oder 404 liefern, war ${patchRes.status}`,
			);
		});

		it('DELETE auf fremden Task → 403 oder 404', async () => {
			const cookieA = await register('alice@example.com', 'passwort-alice');
			const cookieB = await register('bob@example.com', 'passwort-bob');

			const createRes = await fetchJson('/tasks', {
				method: 'POST',
				headers: withCookie(cookieB),
				body: JSON.stringify({ title: 'Bobs Task', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(createRes.status, 201);
			const bobsTask = (await createRes.json()) as { id: number };

			const delRes = await fetch(`${server.baseUrl}/tasks/${bobsTask.id}`, {
				method: 'DELETE',
				headers: withCookie(cookieA),
			});
			assert.ok(
				delRes.status === 403 || delRes.status === 404,
				`DELETE auf fremden Task muss 403 oder 404 liefern, war ${delRes.status}`,
			);
		});
	});

	// ── AK 5 — Säulen: nutzer-eigene Stammdaten (#421, Epic #420, Teil 1) ────
	//
	// Mit #421 sind Säulen wieder nutzer-eigen: jeder frisch registrierte Nutzer erhält beim Anlegen
	// seine EIGENEN fünf Standard-Säulen (Seed in der Registrierung). Die Route `GET /pillars` bleibt
	// in Teil 1 bewusst UNSCOPED — die Isolation auf Route-Ebene (Query-Filter nach userId) folgt in
	// Teil 2. Der Endpunkt braucht aber weiterhin eine gültige Session (kein 401).

	describe('AK 5 — Säulen sind nutzer-eigen, Route noch unscoped (#421, Teil 1)', () => {
		it('sät jedem Nutzer eigene Säulen; GET /pillars ist erreichbar und (Teil 1) noch unscoped', async () => {
			const cookieA = await register('alice@example.com', 'passwort-alice');
			const cookieB = await register('bob@example.com', 'passwort-bob');

			// Session vorhanden ⇒ der Säulen-Endpunkt darf nicht mit 401 abweisen.
			const putResA = await fetchJson('/pillars/weights', {
				method: 'PUT',
				headers: withCookie(cookieA),
				body: JSON.stringify({ weights: [{ id: 1, weight: 100 }] }),
			});
			assert.notEqual(putResA.status, 401, 'PUT /pillars/weights mit Session darf nicht 401 liefern');

			const pillarsA = await fetch(`${server.baseUrl}/pillars`, { headers: withCookie(cookieA) });
			const pillarsB = await fetch(`${server.baseUrl}/pillars`, { headers: withCookie(cookieB) });
			assert.equal(pillarsA.status, 200);
			assert.equal(pillarsB.status, 200);

			const listA = (await pillarsA.json()) as unknown[];
			const listB = (await pillarsB.json()) as unknown[];

			// Beide Nutzer haben je fünf eigene Säulen bekommen ⇒ die (noch unscoped) Route liefert die
			// Vereinigung (2×5). Route-Scoping folgt in Teil 2; die Daten-Isolation (pillars.userId) ist
			// in pillar-per-user-seed.test.ts per Raw-SQL abgesichert.
			assert.equal(listA.length, 10, `unscoped Route zeigt beide Säulen-Sätze, sieht ${listA.length}`);
			assert.equal(listB.length, listA.length, 'die noch unscoped Route liefert beiden dieselbe Liste');
		});
	});
});
