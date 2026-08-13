import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../../test/helpers.js';
import { type ActivityAdvisor, type AdviseActivitiesInput, type ActivityAdvice } from '../../llm/llm.js';
import { Pillar, User } from '../../models/index.js';

// Rote Spec-Tests für #430 — nutzerdefinierte Säulen im Säulen-Berater (/pillars/advisor):
// AK1 Berater erhält nur die Säulen des anfragenden Nutzers (Name + Beschreibung).
// AK2 Ergebnis-pillarIds stammen ausschließlich aus gültigen Nutzer-Säulen.
// AK4 Nutzer ohne Säulen → HTTP 503 (unverändert).
// Der Auth-Kontext muss VOR dem Server-Start feststehen (createApp liest die Env-Werte).
process.env.GOOGLE_ALLOWED_EMAILS = 'userA@example.com,userB@example.com';
process.env.SESSION_SECRET = 'test-secret-430-advisor';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

let server: TestServer;

/** Extrahiert das erste `name=value`-Paar aus einem Set-Cookie-Header (ohne Attribute). */
const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

/** Loggt über den Test-Only-Endpunkt ein und gibt den Cookie-Header für Folgeanfragen zurück. */
const testLogin = async (email: string, displayName: string): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, displayName }),
	});
	assert.equal(res.status, 200, `Test-Login für ${email} sollte 200 liefern`);
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte einen Set-Cookie-Header setzen');
	return cookieFromSetCookie(setCookie);
};

const postAs = (cookie: string, path: string, body: unknown) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

/**
 * Liefert die echte DB-User-Id zu einer E-Mail (die Id wird vom Login-Prozess vergeben und ist
 * nicht hartkodiert, damit die Tests unabhängig von der Reihenfolge der Logins bleiben).
 */
const userIdOf = async (email: string): Promise<number> => {
	const u = await User.findOne({ where: { email } });
	assert.ok(u, `Nutzer ${email} muss nach Login existieren`);
	return u.id;
};

describe('POST /pillars/advisor — nutzerdefinierte Säulen (#430)', () => {
	// Austauschbarer Berater — zeichnet den Input auf und liefert eine kontrollierte Antwort.
	let recordedInput: AdviseActivitiesInput | undefined;

	const advisor: ActivityAdvisor = async (input) => {
		recordedInput = input;
		// AK2: Antwort verweist nur auf die erste gültige Säule des Nutzers.
		const firstId = input.pillars[0]?.id;
		const advice: ActivityAdvice[] =
			firstId !== undefined ? [{ activity: 'Beispielaktivität', reason: 'passt', pillarIds: [firstId] }] : [];
		return advice;
	};

	before(async () => {
		server = await startTestServer({ activityAdvisor: advisor });
	});

	beforeEach(async () => {
		await resetDb();
		recordedInput = undefined;
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: Berater erhält nur die Säulen des anfragenden Nutzers (Name + Beschreibung)', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		await testLogin('userB@example.com', 'User B');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		await Pillar.create({ name: 'A-Körper', description: 'Sport & Schlaf', weight: 50, userId: uidA });
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie & Freunde', weight: 100, userId: uidB });

		await postAs(cookieA, '/pillars/advisor', { question: 'Wie kann ich mich verbessern?' });

		assert.ok(recordedInput, 'Berater muss mit dem Input aufgerufen werden');
		const namesA = recordedInput.pillars.map((p) => p.name);
		assert.ok(
			namesA.includes('A-Körper'),
			`User A sieht eigene Säule im Berater-Prompt; erhalten: ${JSON.stringify(namesA)}`,
		);
		assert.ok(
			!namesA.includes('B-Beziehungen'),
			`User A darf B's Säulenname im Berater-Prompt nicht sehen; erhalten: ${JSON.stringify(namesA)}`,
		);
		assert.ok(
			recordedInput.pillars.some((p) => typeof p.description === 'string'),
			'Säulen-Beschreibung muss an den Berater weitergereicht werden',
		);
	});

	it('AK1: User B sieht umgekehrt nur die eigenen Säulen', async () => {
		const cookieB = await testLogin('userB@example.com', 'User B');
		await testLogin('userA@example.com', 'User A');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		await Pillar.create({ name: 'A-Körper', description: 'Sport', weight: 100, userId: uidA });
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie', weight: 100, userId: uidB });

		await postAs(cookieB, '/pillars/advisor', { question: 'Was kann ich tun?' });

		assert.ok(recordedInput, 'Berater muss aufgerufen werden');
		const namesB = recordedInput.pillars.map((p) => p.name);
		assert.ok(namesB.includes('B-Beziehungen'), `User B sieht eigene Säule; erhalten: ${JSON.stringify(namesB)}`);
		assert.ok(
			!namesB.includes('A-Körper'),
			`User B darf A's Säulenname nicht sehen; erhalten: ${JSON.stringify(namesB)}`,
		);
	});

	it('AK2: zurückgegebene pillarIds stammen ausschließlich aus gültigen Nutzer-Säulen', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		await testLogin('userB@example.com', 'User B');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		await Pillar.create({ name: 'A-Körper', description: 'Sport', weight: 100, userId: uidA });
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie', weight: 100, userId: uidB });

		const res = await postAs(cookieA, '/pillars/advisor', { question: 'Aktivität gesucht' });
		assert.equal(res.status, 200);
		const body = (await res.json()) as { advice: ActivityAdvice[] };
		assert.ok(body.advice.length > 0, 'mindestens ein Vorschlag erwartet');

		const ownIds = (await Pillar.findAll({ where: { userId: uidA } })).map((p) => p.id);
		const foreignIds = (await Pillar.findAll({ where: { userId: uidB } })).map((p) => p.id);
		for (const entry of body.advice) {
			for (const id of entry.pillarIds) {
				assert.ok(ownIds.includes(id), `pillarId ${id} muss eine eigene Säule sein`);
				assert.ok(!foreignIds.includes(id), `pillarId ${id} darf keine fremde Säule sein`);
			}
		}
	});

	it('AK4: Nutzer ohne Säulen erhält HTTP 503', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		// Keine Säulen für User A.
		const res = await postAs(cookieA, '/pillars/advisor', { question: 'Etwas tun' });
		assert.equal(res.status, 503);
		assert.equal(recordedInput, undefined, 'Berater darf bei 503 nicht aufgerufen werden');
	});
});
