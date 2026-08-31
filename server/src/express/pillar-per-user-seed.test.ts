import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { User } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer, registerResponse } from '../test/helpers.js';

// ── Rote Spec-Tests für #421, AK4 — neuer Nutzer bekommt beim ersten Login die fünf Standard-Säulen ──
//
// Ziel (Epic #420, Teil 1): Säulen sind nutzer-eigen. Ein frisch registrierter Nutzer erhält bei der
// Anlage (erster Login) seine EIGENEN fünf Standard-Säulen (je 20 %). Ein zweiter Login/Registrierungs-
// versuch derselben E-Mail sät NICHT erneut (keine Dubletten).
//
// Da dieser Teil nur Datenmodell + Seed umfasst (die API-Route `GET /pillars` bleibt vorerst unscoped),
// wird der Seed auf DB-Ebene geprüft: `SELECT ... FROM pillars WHERE userId = ?`. Vor der Umsetzung
// existiert die Spalte `userId` an `pillars` nicht → die Query bricht ab → die Tests sind ROT. Nach der
// Umsetzung (Modell + Seed in der Registrierung) werden sie grün.

process.env.SESSION_SECRET = 'seed-test-secret';

let server: TestServer;

const login = (email: string, password = 'password123'): Promise<Response> =>
	fetch(`${server.baseUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});

/** Die eigenen Säulen eines Nutzers (Raw-SQL, modellunabhängig gegen `pillars.userId`). */
const ownPillars = async (userId: number): Promise<{ name: string; weight: number }[]> => {
	const [rows] = await sequelize.query('SELECT `name`, `weight` FROM `pillars` WHERE `userId` = ? ORDER BY `id` ASC', {
		replacements: [userId],
	});
	return rows as { name: string; weight: number }[];
};

const userIdByEmail = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Nutzer ${email} sollte nach der Registrierung existieren`);
	return user.id;
};

describe('Säulen pro Nutzer — Standard-Säulen beim ersten Login (#421, AK4)', () => {
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

	it('sät einem frisch registrierten Nutzer seine eigenen fünf Standard-Säulen (je 20 %)', async () => {
		const res = await registerResponse(server, 'neu@example.com', 'password123');
		assert.equal(res.status, 201, 'Registrierung liefert 201');

		const userId = await userIdByEmail('neu@example.com');
		const pillars = await ownPillars(userId);

		assert.equal(pillars.length, SEED_PILLARS.length, 'der neue Nutzer hat genau fünf eigene Säulen');
		assert.deepEqual(
			pillars.map((p) => p.name).sort(),
			SEED_PILLARS.map((p) => p.name).sort(),
			'die eigenen Säulen tragen die kanonischen Standard-Namen',
		);
		for (const pillar of pillars) {
			assert.equal(pillar.weight, 20, `Standard-Säule „${pillar.name}" startet mit 20 %`);
		}
	});

	it('sät bei einem zweiten Login/Registrierungsversuch nicht erneut (keine Dubletten)', async () => {
		assert.equal(
			(await registerResponse(server, 'doppel@example.com', 'password123')).status,
			201,
			'erste Registrierung: 201',
		);
		const userId = await userIdByEmail('doppel@example.com');
		assert.equal((await ownPillars(userId)).length, 5, 'nach erster Registrierung genau fünf Säulen');

		// Zweiter Registrierungsversuch derselben E-Mail wird abgewiesen (409) und sät nichts nach.
		assert.equal(
			(await registerResponse(server, 'doppel@example.com', 'password123')).status,
			409,
			'zweite Registrierung: 409 (E-Mail vergeben)',
		);
		assert.equal((await ownPillars(userId)).length, 5, 'kein Nachsäen durch den zweiten Registrierungsversuch');

		// Auch ein regulärer erneuter Login sät nicht doppelt.
		assert.equal((await login('doppel@example.com')).status, 200, 'erneuter Login: 200');
		assert.equal((await ownPillars(userId)).length, 5, 'kein Nachsäen durch erneuten Login');
	});

	it('isoliert die Säulen zweier Nutzer — jeder bekommt seine eigenen fünf', async () => {
		assert.equal((await registerResponse(server, 'alice@example.com', 'password123')).status, 201);
		assert.equal((await registerResponse(server, 'bob@example.com', 'password123')).status, 201);

		const aliceId = await userIdByEmail('alice@example.com');
		const bobId = await userIdByEmail('bob@example.com');

		assert.equal((await ownPillars(aliceId)).length, 5, 'Alice hat fünf eigene Säulen');
		assert.equal((await ownPillars(bobId)).length, 5, 'Bob hat fünf eigene Säulen');
		assert.notEqual(aliceId, bobId, 'Alice und Bob sind verschiedene Nutzer');
	});
});
