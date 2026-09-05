import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import { verifyPassword } from '../logics/auth.js';

/**
 * Rote Spec-Tests für #1219 (Spec docs/spec/issue-1219.md) — Anzeigename selbst festlegen.
 *
 * Neuer Endpunkt `/profile` (GET/PUT, Vorbild routes/geoConfig.ts):
 * - AK1: GET liefert `{displayName, email, avatarUrl}` des angemeldeten Nutzers.
 * - AK2: PUT `{"displayName":"Anna"}` → 200; `GET /auth/me` liefert danach „Anna"
 *   (Session-Pflege: `/auth/me` antwortet aus `req.session.user`, nicht aus der DB).
 * - AK3: leerer (auch nur Whitespace) oder > 60 Zeichen → 400 mit deutscher Meldung,
 *   die „Anzeigename" nennt; nichts wird persistiert. 60 Zeichen sind der gültige Grenzfall.
 * - AK4: PUT ignoriert `email`, `passwordHash` und unbekannte Felder (DB-Zeile unverändert).
 * - AK5: GET und PUT ohne Session → 401 (Auth-Kontext aktiv via applyTestAuthEnv).
 *
 * Rot, bis der profileRouter existiert (heute: 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1219');

type ProfileDto = { displayName: string; email: string; avatarUrl: string | null };

let server: TestServer;

const getProfile = (cookie: string): Promise<Response> => server.json('/profile', { headers: { Cookie: cookie } });

const putProfile = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/profile', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const me = (cookie: string): Promise<Response> => server.json('/auth/me', { headers: { Cookie: cookie } });

describe('Profil — Anzeigename (#1219 AK1–AK5)', () => {
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

	it('AK5: ohne Session → 401 (GET und PUT)', async () => {
		assert.equal((await getProfile('cookie=none')).status, 401);
		assert.equal((await putProfile('cookie=none', { displayName: 'Anna' })).status, 401);
	});

	it('AK1: GET /profile liefert displayName, email und avatarUrl des angemeldeten Nutzers', async () => {
		const cookie = await server.login('profile-ak1@example.com', {
			displayName: 'Erika Muster',
			avatarUrl: 'https://example.com/erika.png',
		});
		const res = await getProfile(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as ProfileDto, {
			displayName: 'Erika Muster',
			email: 'profile-ak1@example.com',
			avatarUrl: 'https://example.com/erika.png',
		});
	});

	it('AK2: PUT {"displayName":"Anna"} → 200; GET /auth/me liefert danach „Anna" (Session nachgezogen)', async () => {
		// Register setzt displayName = E-Mail (auth.ts:55) — genau der gemeldete Bug-Kern.
		const cookie = await server.register('profile-ak2@example.com', 'password123');
		const put = await putProfile(cookie, { displayName: 'Anna' });
		assert.equal(put.status, 200, 'valider Anzeigename muss 200 liefern');

		const afterMe = (await (await me(cookie)).json()) as ProfileDto;
		assert.equal(afterMe.displayName, 'Anna', '/auth/me muss den neuen Namen liefern (Session-Pflege)');

		const afterGet = (await (await getProfile(cookie)).json()) as ProfileDto;
		assert.equal(afterGet.displayName, 'Anna', 'GET /profile muss den gespeicherten Namen liefern');
	});

	const invalid: Array<[string, string]> = [
		['leerer String', ''],
		['nur Whitespace', '   '],
		['61 Zeichen', 'A'.repeat(61)],
	];
	for (const [label, value] of invalid) {
		it(`AK3: PUT weist ${label} mit 400 und deutscher Meldung ab (nichts persistiert)`, async () => {
			const cookie = await server.register('profile-ak3@example.com', 'password123');
			const res = await putProfile(cookie, { displayName: value });
			assert.equal(res.status, 400, `${label} ist kein gültiger Anzeigename`);
			const body = (await res.json()) as { message?: string };
			assert.match(
				body.message ?? '',
				/Anzeigename/,
				'Die Fehlermeldung muss deutsch sein und das Wort „Anzeigename" enthalten',
			);
			// Der Verstoß darf nichts persistieren (Session wie DB bleiben beim alten Namen):
			const afterMe = (await (await me(cookie)).json()) as ProfileDto;
			assert.equal(afterMe.displayName, 'profile-ak3@example.com');
		});
	}

	it('AK3: Grenzfall 60 Zeichen ist gültig (200)', async () => {
		const cookie = await server.register('profile-ak3-boundary@example.com', 'password123');
		const res = await putProfile(cookie, { displayName: 'A'.repeat(60) });
		assert.equal(res.status, 200, '60 Zeichen sind erlaubt');
	});

	it('AK4: PUT ignoriert email, passwordHash und unbekannte Felder (DB-Zeile unverändert)', async () => {
		const cookie = await server.register('profile-ak4@example.com', 'password123');
		const res = await putProfile(cookie, {
			displayName: 'Anna',
			email: 'angreifer@evil.example',
			passwordHash: 'owned',
			isAdmin: true,
		});
		assert.equal(res.status, 200);

		const row = await User.findOne({ where: { email: 'profile-ak4@example.com' } });
		assert.ok(row, 'Nutzer muss in der DB existieren');
		assert.equal(row.email, 'profile-ak4@example.com', 'E-Mail darf nicht überschrieben werden');
		assert.equal(
			await verifyPassword('password123', row.passwordHash),
			true,
			'passwordHash darf nicht überschrieben werden',
		);

		const session = (await (await me(cookie)).json()) as ProfileDto;
		assert.equal(session.email, 'profile-ak4@example.com', 'Auch die Session-E-Mail bleibt unverändert');
		assert.equal(session.displayName, 'Anna', 'Der Anzeigename selbst wird gespeichert');
	});
});
