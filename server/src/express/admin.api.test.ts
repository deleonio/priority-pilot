import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';

// Rote Spec-Tests für das Rollensystem admin/member — Nutzerverwaltung (GET/PATCH /admin/users).
// Muster: groups-dataisolation.test.ts — zwei Konten, eines Admin (per Test-Login-Rolle), eines
// Member; Autorisierung läuft über `requireRole('admin')` (server/src/express/requireAuth.ts).
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,admin2@example.com';
applyTestAuthEnv('admin-api-test');

const ADMIN_EMAIL = 'admin@example.com';
const MEMBER_EMAIL = 'member@example.com';
const OTHER_ADMIN_EMAIL = 'admin2@example.com';

let server: TestServer;

type AdminUserDto = { id: number; email: string; displayName: string; role: string; createdAt: string };

describe('Admin-API — Nutzerverwaltung (Rollensystem admin/member)', () => {
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

	it('GET /admin/users liefert 403 für einen Member', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: memberCookie } });
		assert.equal(res.status, 403, 'Member darf die Nutzerliste nicht sehen');
	});

	it('GET /admin/users liefert 200 mit allen Nutzern für einen Admin', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });

		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		assert.equal(res.status, 200);
		const users = (await res.json()) as AdminUserDto[];
		assert.equal(users.length, 2, 'beide angelegten Nutzer sind gelistet');
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		const member = users.find((u) => u.email === MEMBER_EMAIL);
		assert.equal(admin?.role, 'admin');
		assert.equal(member?.role, 'member');
	});

	it('PATCH /admin/users/:id/role befördert einen Member zu Admin', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });

		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const member = users.find((u) => u.email === MEMBER_EMAIL);
		assert.ok(member, 'Setup: Member muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${member.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: 'admin' }),
		});
		assert.equal(res.status, 200);
		const updated = (await res.json()) as AdminUserDto;
		assert.equal(updated.role, 'admin');
	});

	it('PATCH /admin/users/:id/role liefert 403, wenn ein Member die Rolle ändern will', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });

		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		assert.ok(admin, 'Setup: Admin muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${admin.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: memberCookie },
			body: JSON.stringify({ role: 'member' }),
		});
		assert.equal(res.status, 403);
	});

	it('PATCH /admin/users/:id/role liefert 409, wenn der letzte Admin auf member zurückgestuft werden soll', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });

		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		assert.ok(admin, 'Setup: Admin muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${admin.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: 'member' }),
		});
		assert.equal(res.status, 409, 'letzter Admin darf nicht zurückgestuft werden');
	});

	it('GET /admin/users liefert 403, wenn die Rolle nach dem Login in der DB zurückgestuft wurde', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(OTHER_ADMIN_EMAIL, { role: 'admin' }); // damit kein Letzter-Admin-Konflikt entsteht

		const demoted = await User.findOne({ where: { email: ADMIN_EMAIL } });
		assert.ok(demoted, 'Setup: zurückzustufender Admin muss existieren');
		await demoted.update({ role: 'member' });

		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		assert.equal(res.status, 403, 'alte Session darf nach DB-Rückstufung nicht mehr durchkommen');
	});

	it('PATCH /admin/users/:id/role: zwei parallele Rückstufungen der beiden letzten Admins lassen genau einen Admin übrig', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const otherCookie = await server.login(OTHER_ADMIN_EMAIL, { role: 'admin' });
		const admin = await User.findOne({ where: { email: ADMIN_EMAIL } });
		const other = await User.findOne({ where: { email: OTHER_ADMIN_EMAIL } });
		assert.ok(admin && other, 'Setup: beide Admins müssen existieren');

		const demote = (id: number, cookie: string): Promise<Response> =>
			fetch(`${server.baseUrl}/admin/users/${id}/role`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ role: 'member' }),
			});
		// Gegenseitige Rückstufung gleichzeitig: „erst zählen, dann schreiben“ sähe zweimal Count 2.
		const statuses = (await Promise.all([demote(admin.id, otherCookie), demote(other.id, adminCookie)])).map(
			(res) => res.status,
		);

		assert.equal(statuses.filter((status) => status === 200).length, 1, `genau eine Rückstufung greift (${statuses})`);
		assert.ok(
			statuses.some((status) => status === 409 || status === 403),
			`die andere scheitert am Letzter-Admin-Schutz oder am frischen Rollen-Check (${statuses})`,
		);
		assert.equal(await User.count({ where: { role: 'admin' } }), 1, 'die App behält genau einen Administrator');
	});

	it('PATCH /admin/users/:id/role bleibt für ein bereits zurückgestuftes Konto idempotent (200, kein 409)', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const member = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.ok(member, 'Setup: Member muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${member.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: 'member' }),
		});
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as AdminUserDto).role, 'member');
	});

	it('GET /auth/me liefert die frische DB-Rolle statt des Session-Snapshots (Rückstufung und Beförderung)', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });

		const demoted = await User.findOne({ where: { email: ADMIN_EMAIL } });
		const promoted = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.ok(demoted && promoted, 'Setup: beide Konten müssen existieren');
		await demoted.update({ role: 'member' });
		await promoted.update({ role: 'admin' });

		const meDemoted = await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie: adminCookie } });
		assert.equal(meDemoted.status, 200);
		assert.equal(((await meDemoted.json()) as { role: string }).role, 'member', 'Rückstufung sofort sichtbar');

		const mePromoted = await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie: memberCookie } });
		assert.equal(mePromoted.status, 200);
		assert.equal(((await mePromoted.json()) as { role: string }).role, 'admin', 'Beförderung ohne Re-Login sichtbar');
	});

	it('PATCH /admin/users/:id/role liefert 400 bei ungültiger Rolle', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		assert.ok(admin, 'Setup: Admin muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${admin.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: 'superadmin' }),
		});
		assert.equal(res.status, 400);
	});
});
