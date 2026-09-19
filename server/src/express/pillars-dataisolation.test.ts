import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Spec-Tests für #428 (Teil 2, AK4): Säulen sind nutzer-eigen (scoping). Nutzer A sieht nur
// seine eigenen Säulen, kann die von B weder lesen/ändern/löschen. Diese Tests sichern das
// `ownerScope(userId)`-Verhalten auf allen Säulen-Endpunkten.
//
// Auth-Env wird bewusst über die **Plural**-Variable (`GOOGLE_ALLOWED_EMAILS`) überschrieben, da
// `isEmailAllowed` Plural vor Singular priorisiert (siehe allowedEmails.ts) — nur so gewinnt der
// Test-Zugriff zuverlässig gegen eine lokale `.env` (dort steht die Plural-Variable auf modevel@…).
// Die Zuweisung läuft nach dem `.env`-Lade-Import und überschreibt damit den `.env`-Wert.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,charlie@example.com';
applyTestAuthEnv('iso-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';

let server: TestServer;

/** Legt die fünf Standard-Säulen MIT userId an (pro Nutzer eigene Kopie). */
const seedPillarsForUser = async (userId: number): Promise<Pillar[]> =>
	Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight, userId })));

/** Test-Only-Login liefert einen Cookie, der einen echten Session-`userId` repräsentiert. */

describe('Säulen-Datenisolation — nutzer-eigene Säulen (Teil 2, #428, AK4)', () => {
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

	// ── GET /pillars — nur eigene Säulen ───────────────────────────────────────────────

	it('GET /pillars liefert einem eingeloggten Nutzer nur seine eigenen Säulen (AK4)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		// Alice's Nutzer-ID ist 1 (test-login create order)
		await seedPillarsForUser(1);
		// Bob's Nutzer-ID ist 2
		await seedPillarsForUser(2);

		// Alice sieht nur ihre eigenen 5 Säulen
		const aliceRes = await fetch(`${server.baseUrl}/pillars`, { headers: { cookie: aliceCookie } });
		assert.equal(aliceRes.status, 200);
		const alicePillars = (await aliceRes.json()) as { userId?: number }[];
		assert.equal(alicePillars.length, 5, 'Alice sieht genau 5 Säulen');

		// Bob sieht nur seine eigenen 5 Säulen (ANDERE IDs)
		const bobRes = await fetch(`${server.baseUrl}/pillars`, { headers: { cookie: bobCookie } });
		assert.equal(bobRes.status, 200);
		const bobPillars = (await bobRes.json()) as { id: number }[];
		assert.equal(bobPillars.length, 5, 'Bob sieht genau 5 Säulen');

		// IDs sind verschieden (verschiedene Nutzer-Kopien)
		assert.notEqual(
			alicePillars[0]?.id,
			bobPillars[0]?.id,
			'Alice und Bob haben verschiedene Säulen-IDs (eigene Kopien)',
		);
	});

	it('GET /pillars liefert 401 ohne Cookie (Auth nötig)', async () => {
		const res = await fetch(`${server.baseUrl}/pillars`);
		assert.equal(res.status, 401, 'ohne Cookie wird 401 verlangt');
	});

	// ── POST /tasks mit Säulen-Beiträgen — nur eigene Säulen zulässig ─────────────────────

	it('POST /tasks mit Säulen-Beiträgen wird 400, wenn pillarId fremder Säule gehört (AK4)', async () => {
		// Login legt Alice als Nutzer id 1 an (Grundlage für seedPillarsForUser); ihr Cookie wird
		// hier nicht gebraucht — der Task-Post läuft mit Bobs Cookie gegen Alices Säulen-id.
		await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		// Alice' Säulen stehen per Seed bereit (Säulen-CRUD ist seit #1573 gesperrt)
		const alicePillars = await seedPillarsForUser(1);
		const alicePillarId = alicePillars[0]!.id;

		// Bob versucht Task mit Alices Säule zu erstellen → 400 (Säule nicht für Bob existent)
		const bobTaskRes = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: bobCookie },
			body: JSON.stringify({
				title: 'Bobs Task',
				status: 'Open',
				priority: 3,
				estimatedEffort: 1,
				pillars: [{ pillarId: alicePillarId, share: 100, confidence: 100 }],
			}),
		});
		assert.equal(bobTaskRes.status, 400, 'Bob darf Alices Säule nicht verwenden');
	});
});
