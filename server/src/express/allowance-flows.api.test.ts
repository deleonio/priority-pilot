import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
// Rote Spec-Tests für #1983 (AK2/AK3/AK5/AK6) — Vertrag: docs/spec/issue-1983.md.
// AK2/AK5: Einladung bzw. Aufgaben-Übergabe an eine UNBEKANNTE E-Mail-Adresse schaltet die
// Adresse mit Herkunft frei (heute 404/400). AK3: Magic-Link-Verify akzeptiert die
// freigeschaltete Adresse (heute 400). AK6: Admin listet Zulassungen mit Herkunft (heute 404).
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('allowance-flows-test');

const TEST_EMAIL_ALICE = 'alice@example.com';

let server: TestServer;

type AllowedEmailDto = { email: string; origin: string };

describe('Zulassung unbekannter Adressen durch Einladung/Delegation (#1983)', () => {
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

	// ── AK2: Gruppen-Einladung an unbekannte Adresse ────────────────────────────────

	it('POST /groups/{id}/invitations mit unbekannter E-Mail → 201 + Freischaltung origin einladung (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin', role: 'admin' });
		const groupRes = await fetch(`${server.baseUrl}/groups`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ name: 'Familie' }),
		});
		assert.equal(groupRes.status, 201, 'Setup: Gruppe muss anlegbar sein');
		const group = (await groupRes.json()) as { id: number };

		const res = await fetch(`${server.baseUrl}/groups/${group.id}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ email: 'neu@beispiel.de' }),
		});
		assert.equal(res.status, 201, `unbekannte Adresse darf nicht mehr 404 liefern, kam ${res.status}`);
		const body = (await res.json()) as { status?: string };
		assert.equal(body.status, 'pending');

		const { isDbEmailAllowed } = await import('../logics/allowedEmails.js');
		assert.equal(await isDbEmailAllowed('neu@beispiel.de'), true, 'Adresse muss freigeschaltet sein');
	});

	// ── AK3: Magic-Link-Zugang für freigeschaltete Adresse ──────────────────────────

	it('POST /auth/magic-link/verify akzeptiert Token einer freigeschalteten Adresse (AK3)', async () => {
		const { AllowedEmail } = await import('../models/allowedEmail.js');
		const { createLoginToken } = await import('../logics/magicLink.js');
		process.env.SMTP_HOST = 'smtp.test';
		process.env.MAIL_FROM = 'test@balamentum.de';
		process.env.PUBLIC_BASE_URL = 'https://test';
		await AllowedEmail.create({ email: 'eingeladen@beispiel.de', origin: 'einladung' });
		const token = await createLoginToken('eingeladen@beispiel.de');
		assert.ok(token, 'Setup: Login-Token muss erzeugbar sein');

		const res = await fetch(`${server.baseUrl}/auth/magic-link/verify`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		});
		assert.equal(res.status, 200, `freigeschaltete Adresse muss Zugang bekommen, kam ${res.status}`);
		const cookie = res.headers.get('set-cookie');
		assert.ok(cookie, 'Verify muss eine Session setzen');
	});

	// ── AK5: Aufgaben-Übergabe an unbekannte Adresse ────────────────────────────────

	it('Aufgaben-Übergabe an unbekannte E-Mail → Freischaltung origin delegation (AK5)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin', role: 'admin' });
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ title: 'Blumen gießen', recipientEmail: 'delegiert@beispiel.de' }),
		});
		assert.equal(res.status, 201, `Übergabe an unbekannte Adresse darf nicht 400/403 liefern, kam ${res.status}`);

		const { isDbEmailAllowed } = await import('../logics/allowedEmails.js');
		assert.equal(await isDbEmailAllowed('delegiert@beispiel.de'), true, 'Adresse muss freigeschaltet sein');
	});

	// ── AK6: Admin-Sicht der Zulassungen ────────────────────────────────────────────

	it('GET /admin/allowed-emails listet Adressen mit Herkunft (AK6)', async () => {
		const { AllowedEmail } = await import('../models/allowedEmail.js');
		await AllowedEmail.create({ email: 'a@beispiel.de', origin: 'einladung' });
		await AllowedEmail.create({ email: 'b@beispiel.de', origin: 'delegation' });
		const adminCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin', role: 'admin' });

		const res = await fetch(`${server.baseUrl}/admin/allowed-emails`, { headers: { cookie: adminCookie } });
		assert.equal(res.status, 200, `Admin-Route muss existieren, kam ${res.status}`);
		const list = (await res.json()) as AllowedEmailDto[];
		const a = list.find((entry) => entry.email === 'a@beispiel.de');
		const b = list.find((entry) => entry.email === 'b@beispiel.de');
		assert.ok(a && a.origin === 'einladung', 'Herkunft einladung muss sichtbar sein');
		assert.ok(b && b.origin === 'delegation', 'Herkunft delegation muss sichtbar sein');
	});
});
