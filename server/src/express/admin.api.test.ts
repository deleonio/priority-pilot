import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { UserRole } from '../models/user.js';

// Rote Spec-Tests für das Rollensystem admin/member — Nutzerverwaltung (GET/PATCH /admin/users).
// Muster: groups-dataisolation.test.ts — zwei Konten, eines Admin (per Test-Login-Rolle), eines
// Member; Autorisierung läuft über `requireRole('admin')` (server/src/express/requireAuth.ts).
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,admin2@example.com,tester@example.com';
applyTestAuthEnv('admin-api-test');

const ADMIN_EMAIL = 'admin@example.com';
const MEMBER_EMAIL = 'member@example.com';
const OTHER_ADMIN_EMAIL = 'admin2@example.com';
const TESTER_EMAIL = 'tester@example.com';

// #1566: `UserRole` kennt 'tester' noch nicht (rote Spec-Tests) — Doppel-Cast statt Literal,
// damit der Pre-Commit-tsc nicht an dieser Stelle stirbt (MEMORY-Muster 2026-08-23). Der
// Laufzeitwert ist schlicht 'tester'; test-login validiert die Rolle zur Laufzeit nicht.
const TESTER_ROLE = 'tester' as unknown as UserRole;

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

	// #1456 (AK6, Spec docs/spec/issue-1456.md): PATCH /admin/users/:id/plan — Muster oben
	// (PATCH /admin/users/:id/role).
	it('#1456 — PATCH /admin/users/:id/plan liefert 403 für einen Member', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const member = users.find((u) => u.email === MEMBER_EMAIL);
		assert.ok(member, 'Setup: Member muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${member.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: memberCookie },
			body: JSON.stringify({ plan: 'max' }),
		});
		assert.equal(res.status, 403, 'Member darf den Plan nicht ändern');
	});

	it('#1456 — PATCH /admin/users/:id/plan setzt den Plan als Admin und persistiert ihn', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const member = users.find((u) => u.email === MEMBER_EMAIL);
		assert.ok(member, 'Setup: Member muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${member.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ plan: 'max' }),
		});
		assert.equal(res.status, 200);
		const updated = (await res.json()) as AdminUserDto & { plan?: string };
		assert.equal(updated.plan, 'max', 'Response-DTO trägt den neuen Plan');

		const persisted = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.equal((persisted as unknown as { plan?: string })?.plan, 'max', 'Plan ist in der DB persistiert');
	});

	it('#1456 — PATCH /admin/users/:id/plan liefert 400 bei ungültigem Plan-Wert', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		assert.ok(admin, 'Setup: Admin muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${admin.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ plan: 'gold' }),
		});
		assert.equal(res.status, 400);
	});

	it('#1456 — PATCH /admin/users/:id/plan liefert 404 für unbekannte Id', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });

		const res = await fetch(`${server.baseUrl}/admin/users/99999/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ plan: 'max' }),
		});
		assert.equal(res.status, 404);
	});

	it('#1456 — PATCH /admin/users/abc/plan liefert 400 bei nicht-numerischer Id', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });

		const res = await fetch(`${server.baseUrl}/admin/users/abc/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ plan: 'max' }),
		});
		assert.equal(res.status, 400);
	});

	// #1556 (AK4, Spec docs/spec/issue-1556.md): Selbst-Versetzen über die eigene Id — der einzige
	// Call ist der Plan-PATCH (kein Zahlungs-/Abo-Pfad), und danach liefern GET /admin/users UND
	// GET /auth/me (gleiche Session, ohne Re-Login) das neue Paket. Bewusst als grüner
	// Vertragstest angelegt: das Backend aus #1456 existiert bereits, dieser Test bewacht den
	// Session-Sync, auf den sich die Frontend-Wirksamkeit („nach Neuladen") stützt.
	it('#1556 — PATCH /admin/users/:id/plan auf das eigene Konto wirkt sofort in /admin/users und /auth/me', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const users = (await listRes.json()) as AdminUserDto[];
		const admin = users.find((u) => u.email === ADMIN_EMAIL);
		assert.ok(admin, 'Setup: eigenes Konto muss existieren');

		const patchRes = await fetch(`${server.baseUrl}/admin/users/${admin.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ plan: 'pro' }),
		});
		assert.equal(patchRes.status, 200);

		const refreshed = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		const refreshedUsers = (await refreshed.json()) as Array<AdminUserDto & { plan?: string }>;
		assert.equal(
			refreshedUsers.find((u) => u.email === ADMIN_EMAIL)?.plan,
			'pro',
			'GET /admin/users liefert den neuen Plan',
		);

		const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie: adminCookie } });
		assert.equal(meRes.status, 200);
		assert.equal(((await meRes.json()) as { plan?: string }).plan, 'pro', 'auth/me synct ohne Re-Login');
	});

	// #1566 (Spec docs/spec/issue-1566.md): Rolle „Tester" — Admin ohne Nutzerverwaltung. Die
	// 403-Assertions für tester auf den nutzerverwaltungs-spezifischen Routen sind Guards (der
	// Status-Quo liefert sie bereits); Rot kommt aus AK1 (Rollen-PATCH auf tester, heute 400)
	// und AK4 (Paket-PATCH auf die eigene Id, heute 403).
	it('#1566 AK1 — PATCH /admin/users/:id/role auf tester: 200, Response und DB tragen tester', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const member = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.ok(member, 'Setup: Ziel-Konto muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${member.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: TESTER_ROLE }),
		});
		assert.equal(res.status, 200, 'Admin darf die Rolle tester vergeben');
		assert.equal(((await res.json()) as AdminUserDto).role, 'tester', 'Response-DTO trägt tester');

		const persisted = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.equal(persisted?.role, 'tester', 'Rolle tester ist in der DB persistiert');
	});

	it('#1566 AK1 — Rückstufung des letzten Admins auf tester liefert 409 (Letzter-Admin-Guard)', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const admin = await User.findOne({ where: { email: ADMIN_EMAIL } });
		assert.ok(admin, 'Setup: Admin muss existieren');

		const res = await fetch(`${server.baseUrl}/admin/users/${admin.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ role: TESTER_ROLE }),
		});
		assert.equal(res.status, 409, 'die App darf nie ohne Administrator dastehen — auch nicht via tester');
	});

	it('#1566 AK2 — GET /admin/users mit Rolle tester liefert 403 (Nutzerliste bleibt Admin-only)', async () => {
		await server.login(ADMIN_EMAIL, { role: 'admin' });
		const testerCookie = await server.login(TESTER_EMAIL, { role: TESTER_ROLE });

		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: testerCookie } });
		assert.equal(res.status, 403, 'Tester darf die Nutzerliste nicht sehen — auch nicht nach Öffnung für Arrays');
	});

	it('#1566 AK4 — tester: PATCH plan auf eigene Id 200, auf fremde Id 403, PATCH role 403', async () => {
		await server.login(ADMIN_EMAIL, { role: 'admin' });
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const testerCookie = await server.login(TESTER_EMAIL, { role: TESTER_ROLE });
		const tester = await User.findOne({ where: { email: TESTER_EMAIL } });
		const member = await User.findOne({ where: { email: MEMBER_EMAIL } });
		assert.ok(tester && member, 'Setup: beide Konten müssen existieren');

		const ownRes = await fetch(`${server.baseUrl}/admin/users/${tester.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: testerCookie },
			body: JSON.stringify({ plan: 'pro' }),
		});
		assert.equal(
			ownRes.status,
			200,
			'Tester darf das eigene Paket setzen (kostenfreier Selbstwechsel, #1565 für tester)',
		);

		const foreignRes = await fetch(`${server.baseUrl}/admin/users/${member.id}/plan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: testerCookie },
			body: JSON.stringify({ plan: 'max' }),
		});
		assert.equal(
			foreignRes.status,
			403,
			'Frontend-Gating allein reicht nicht: fremdes Paket ist serverseitig gesperrt',
		);

		const roleRes = await fetch(`${server.baseUrl}/admin/users/${member.id}/role`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: testerCookie },
			body: JSON.stringify({ role: 'member' }),
		});
		assert.equal(roleRes.status, 403, 'Rollenvergabe bleibt Admin-only');
	});
});
