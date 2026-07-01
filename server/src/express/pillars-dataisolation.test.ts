import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Regression-Test für die Säulen-Datenisolation: Säulen sind **globale Stammdaten** (für alle
// Nutzer identisch). Issue #207 hatte sie versehentlich pro Nutzer isoliert (`ownerScope(userId)`).
// Folge für einen eingeloggten Nutzer, dessen Säulen `userId = NULL` trugen (wie der echte Seed):
// `GET /pillars` lieferte leer, `POST /tasks` mit Säulen-Beitrag wurde mit 400 abgewiesen, und die
// KI-Säulen-Suggestion (`pillars-suggest`) lieferte nichts. Diese Tests sichern das unscoped Verhalten.
//
// Auth-Env wird bewusst über die **Plural**-Variable (`GOOGLE_ALLOWED_EMAILS`) überschrieben, da
// `isEmailAllowed` Plural vor Singular priorisiert (siehe allowedEmails.ts) — nur so gewinnt der
// Test-Zugriff zuverlässig gegen eine lokale `.env` (dort steht die Plural-Variable auf modevel@…).
// Die Zuweisung läuft nach dem `.env`-Lade-Import und überschreibt damit den `.env`-Wert.
process.env.GOOGLE_ALLOWED_EMAILS = 'iso@example.com';
process.env.SESSION_SECRET = 'iso-test-secret';
process.env.GOOGLE_CLIENT_ID = 'iso-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'iso-test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

const TEST_EMAIL = 'iso@example.com';

let server: TestServer;

/** Legt die fünf Standard-Säulen OHNE userId an (wie der echte Seed: `userId = NULL`). */
const seedGlobalPillars = async (): Promise<Pillar[]> =>
	Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight })));

/** Test-Only-Login liefert einen Cookie, der einen echten Session-`userId` repräsentiert. */
const login = async (email = TEST_EMAIL): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, displayName: 'ISO Test' }),
	});
	assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte Set-Cookie setzen');
	return setCookie.split(';')[0];
};

describe('Säulen-Datenisolation — globale Stammdaten für eingeloggte Nutzer', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	// Früher (`ownerScope(userId)`): eingeloggter Nutzer + NULL-owned Säulen → leere Liste.
	it('GET /pillars liefert einem eingeloggten Nutzer alle fünf Säulen (nicht leer)', async () => {
		await seedGlobalPillars();
		const cookie = await login();

		const res = await fetch(`${server.baseUrl}/pillars`, { headers: { cookie } });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { id: number }[];
		assert.equal(body.length, SEED_PILLARS.length, 'eingeloggter Nutzer sieht alle 5 globalen Säulen');
	});

	// Früher (`arePillarsExistent` mit `ownerScope(userId)`): count 0 → 400. Jetzt: globale
	// Existenzprüfung → 201. Das ist der Kern des reported Bugs (Säulen-Zuweisung blockiert).
	it('POST /tasks mit Säulen-Beitrag wird nicht abgewiesen, obwohl Säulen NULL-owned sind', async () => {
		const pillars = await seedGlobalPillars();
		const cookie = await login();

		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({
				title: 'Joggen gehen 10km',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				pillars: [{ pillarId: pillars[0].id, share: 100, confidence: 95 }],
			}),
		});

		assert.equal(res.status, 201, 'Task mit NULL-owned Säule wird angelegt (kein 400 mehr)');
		const created = (await res.json()) as { id: number; pillars: { pillarId: number }[] };
		assert.equal(created.pillars.length, 1);
		assert.equal(created.pillars[0]?.pillarId, pillars[0].id);
	});
});
