import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für die Warteliste mit Referral-Rang (#1982, Spec docs/spec/issue-1982.md).
// Vertrag: POST /auth/waitlist ({ email, ref? }) → { position, referralCode } (idempotent,
// Normalisierung trim+lowercase); Admin-Endpunkte GET /admin/waitlist,
// POST /admin/waitlist/:id/activate, POST /admin/waitlist/activate-top ({ count }).
// Freischaltung legt eine DB-Zulassung (AllowedEmail, origin 'warteliste') an — geprüft hier
// über POST /auth/test-login, einen echten Aufrufer der kombinierten Login-Prüfung
// (Muster: admin.api.test.ts).
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com';
applyTestAuthEnv('waitlist-test');

const ADMIN_EMAIL = 'admin@example.com';

let server: TestServer;

type WaitlistDto = { id: number; email: string; status: string; position: number; referralCount: number };

/** Trägt eine Adresse in die Warteliste ein und liefert den Antwortkörper. */
const join = async (
	email: string,
	ref?: string,
): Promise<{ status: number; body: { position?: number; referralCode?: string; message?: string } }> => {
	const res = await fetch(`${server.baseUrl}/auth/waitlist`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ref === undefined ? { email } : { email, ref }),
	});
	return {
		status: res.status,
		body: (await res.json()) as { position?: number; referralCode?: string; message?: string },
	};
};

const waitlist = async (cookie: string): Promise<WaitlistDto[]> => {
	const res = await fetch(`${server.baseUrl}/admin/waitlist`, { headers: { cookie } });
	assert.equal(res.status, 200, 'Admin kann die Warteliste lesen (Vertrag GET /admin/waitlist)');
	return (await res.json()) as WaitlistDto[];
};

const testLogin = async (email: string): Promise<number> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});
	return res.status;
};

/** Kleiner Abstand, damit `createdAt` der Einträge eindeutig sortierbar bleibt. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('Warteliste — POST /auth/waitlist (#1982, AK1/AK2)', () => {
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

	it('TF1/AK1: neue Adresse liefert Position 1 und einen Referral-Code', async () => {
		const { status, body } = await join('anna@example.com');
		assert.equal(status, 200);
		assert.equal(body.position, 1, 'erste Adresse steht auf Position 1 (1-basiert)');
		assert.ok(body.referralCode, 'Antwort enthält einen persönlichen Referral-Code');
	});

	it('TF1/AK1: wiederholter Aufruf mit anders normalisierter Schreibweise ist idempotent', async () => {
		const first = await join('anna@example.com');
		const second = await join('  Anna@Example.COM ');
		assert.equal(second.status, 200);
		assert.equal(second.body.position, first.body.position, 'dieselbe Position nach Normalisierung (trim+lowercase)');
		const third = await join('ben@example.com');
		assert.equal(third.body.position, 2, 'kein Zweit-Eintrag angelegt — die nächste neue Adresse ist Position 2');
	});

	it('TF1/AK1: ungültige E-Mail wird mit 400 abgelehnt', async () => {
		const { status } = await join('keine-email');
		assert.equal(status, 400);
	});

	it('TF2/AK2: Referral-Entry rückt vor ältere Einträge ohne Referrals (Rangformel)', async () => {
		const anna = await join('anna@example.com');
		await join('ben@example.com');
		await tick();
		await join('carl@example.com');
		await tick();

		// Dora meldet sich über Annas persönlichen Empfehlungs-Link an.
		const dora = await join('dora@example.com', anna.body.referralCode);
		assert.equal(dora.status, 200);

		const after = await join('anna@example.com');
		assert.equal(after.status, 200);
		assert.equal(after.body.position, 1, 'Anna hat eine geworbene Anmeldung und steht vor allen ohne');

		// Ben, Carl und Dora haben keine Referrals — keiner von ihnen steht über Anna.
		for (const email of ['ben@example.com', 'carl@example.com', 'dora@example.com']) {
			const entry = await join(email);
			assert.ok((entry.body.position ?? 0) > 1, `${email} steht hinter Anna (Rangformel: Referrals absteigend)`);
		}
	});

	it('TF2/AK2: unbekannter und eigener Referral-Code werden ohne Fehler ignoriert', async () => {
		const anna = await join('anna@example.com');
		const unknown = await join('ben@example.com', 'gibtsnicht');
		assert.equal(unknown.status, 200, 'unbekannter Code ist kein Fehler');
		const self = await join('anna@example.com', anna.body.referralCode);
		assert.equal(self.status, 200, 'eigener Code ist kein Fehler');
		assert.equal(self.body.position, 1, 'eigener Code zählt nicht als geworbene Anmeldung');
		const ben = await join('ben@example.com');
		assert.equal(ben.body.position, 2, 'unbekannter Code hat keinen Eintrag erzeugt');
	});
});

describe('Warteliste — Admin-Freischaltung (#1982, AK3/AK4)', () => {
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

	it('TF3/AK3: Aktivierung lässt den Login-Flow die Adresse annehmen, sonst bleibt sie draußen', async () => {
		await join('anna@example.com');
		await join('ben@example.com');

		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const entries = await waitlist(adminCookie);
		const anna = entries.find((e) => e.email === 'anna@example.com');
		assert.ok(anna, 'Setup: Annas Eintrag muss gelistet sein');

		const res = await fetch(`${server.baseUrl}/admin/waitlist/${anna.id}/activate`, {
			method: 'POST',
			headers: { cookie: adminCookie },
		});
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { status?: string }).status, 'activated');

		assert.equal(await testLogin('anna@example.com'), 200, 'freigeschaltete Adresse darf sich anmelden');
		assert.equal(await testLogin('ben@example.com'), 401, 'nicht freigeschaltete Adresse bleibt abgelehnt');
	});

	it('TF4/AK4: Top-N-Welle schaltet genau die N Höchstplatzierten frei, keine Doppelzählung', async () => {
		const anna = await join('anna@example.com');
		await join('ben@example.com');
		await tick();
		await join('carl@example.com');
		await tick();
		await join('dora@example.com');
		// Eine geworbene Anmeldung bringt Anna auf Platz 1.
		await join('emil@example.com', anna.body.referralCode);

		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const res = await fetch(`${server.baseUrl}/admin/waitlist/activate-top`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ count: 2 }),
		});
		assert.equal(res.status, 200);
		assert.equal(
			((await res.json()) as { activatedCount?: number }).activatedCount,
			2,
			'genau zwei Einträge freigeschaltet',
		);

		assert.equal(await testLogin('anna@example.com'), 200, 'Platz 1 (Anna) ist freigeschaltet');
		assert.equal(await testLogin('ben@example.com'), 200, 'Platz 2 (Ben) ist freigeschaltet');
		assert.equal(await testLogin('carl@example.com'), 401, 'Platz 3 (Carl) bleibt draußen');
		assert.equal(await testLogin('dora@example.com'), 401, 'Platz 4 (Dora) bleibt draußen');

		const repeat = await fetch(`${server.baseUrl}/admin/waitlist/activate-top`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ count: 2 }),
		});
		assert.equal(
			((await repeat.json()) as { activatedCount?: number }).activatedCount,
			0,
			'bereits freigeschaltete Einträge werden nicht doppelt gezählt',
		);
	});
});
