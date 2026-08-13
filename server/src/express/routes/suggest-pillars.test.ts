import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../../test/helpers.js';
import { type PillarClassifier, type ClassifyPillarsInput, type PillarSuggestion } from '../../llm/llm.js';
import { Pillar, PillarFeedback, User } from '../../models/index.js';

// Rote Spec-Tests für #430 — nutzerdefinierte Säulen in suggest-pillars:
// AK1 Classifier erhält nur die Säulen des anfragenden Nutzers (ownerScope).
// AK2 Ergebnis-pillarIds stammen ausschließlich aus gültigen Nutzer-Säulen.
// AK3 Few-Shot-Feedback-Beispiele nur aus Korrekturen desselben Nutzers.
// AK4 Nutzer ohne Säulen → HTTP 503 (unverändert).
// Der Auth-Kontext muss VOR dem Server-Start feststehen (createApp liest die Env-Werte).
process.env.GOOGLE_ALLOWED_EMAILS = 'userA@example.com,userB@example.com';
process.env.SESSION_SECRET = 'test-secret-430-suggest';
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

describe('POST /tasks/suggest-pillars — nutzerdefinierte Säulen (#430)', () => {
	// Austauschbarer Klassifikator — zeichnet den Input auf und liefert eine kontrollierte Antwort.
	let recordedInput: ClassifyPillarsInput | undefined;
	let recordedExamples: ClassifyPillarsInput['examples'] | undefined;

	const classifier: PillarClassifier = async (input) => {
		recordedInput = input;
		recordedExamples = input.examples;
		// AK2: Antwort verweist nur auf gültige IDs — hier nehmen wir die erste gültige Säule.
		const firstId = input.pillars[0]?.id;
		const suggestions: PillarSuggestion[] = firstId !== undefined ? [{ pillarId: firstId, confidence: 80 }] : [];
		return suggestions;
	};

	before(async () => {
		server = await startTestServer({ pillarClassifier: classifier });
	});

	beforeEach(async () => {
		await resetDb();
		recordedInput = undefined;
		recordedExamples = undefined;
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: Classifier erhält nur die Säulen des anfragenden Nutzers', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		await testLogin('userB@example.com', 'User B');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		// Jede:r Nutzer:in legt eigene Säulen an (verschiedene Namen).
		await Pillar.create({ name: 'A-Körper', description: 'Sport', weight: 50, userId: uidA });
		await Pillar.create({ name: 'A-Sinn', description: 'Werte', weight: 50, userId: uidA });
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie', weight: 100, userId: uidB });

		await postAs(cookieA, '/tasks/suggest-pillars', { title: 'Joggen gehen' });

		assert.ok(recordedInput, 'Classifier muss mit dem Klassifikations-Input aufgerufen werden');
		const namesA = recordedInput.pillars.map((p) => p.name);
		assert.ok(
			namesA.includes('A-Körper') && namesA.includes('A-Sinn'),
			`User A sieht eigene Säulen im Prompt; erhalten: ${JSON.stringify(namesA)}`,
		);
		assert.ok(
			!namesA.includes('B-Beziehungen'),
			`User A darf B's Säulenname nicht im Prompt sehen; erhalten: ${JSON.stringify(namesA)}`,
		);
	});

	it('AK1: User B sieht umgekehrt nur die eigenen Säulen', async () => {
		const cookieB = await testLogin('userB@example.com', 'User B');
		await testLogin('userA@example.com', 'User A');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		await Pillar.create({ name: 'A-Körper', description: 'Sport', weight: 100, userId: uidA });
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie', weight: 100, userId: uidB });

		await postAs(cookieB, '/tasks/suggest-pillars', { title: 'Familienausflug' });

		assert.ok(recordedInput, 'Classifier muss aufgerufen werden');
		const namesB = recordedInput.pillars.map((p) => p.name);
		assert.ok(namesB.includes('B-Beziehungen'), `User B sieht eigene Säule; erhalten: ${JSON.stringify(namesB)}`);
		assert.ok(
			!namesB.includes('A-Körper'),
			`User B darf A's Säulenname nicht sehen; erhalten: ${JSON.stringify(namesB)}`,
		);
	});

	it('AK2: zurückgegebene pillarIds stammen ausschließlich aus den gültigen Nutzer-Säulen', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		await testLogin('userB@example.com', 'User B');
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');

		await Pillar.create({ name: 'A-Körper', description: 'Sport', weight: 100, userId: uidA });
		// Eine fremde Säule (User B), die im Ergebnis nicht auftauchen darf.
		await Pillar.create({ name: 'B-Beziehungen', description: 'Familie', weight: 100, userId: uidB });

		const res = await postAs(cookieA, '/tasks/suggest-pillars', { title: 'Laufen' });
		assert.equal(res.status, 200);
		const body = (await res.json()) as { suggestions: PillarSuggestion[] };
		assert.ok(body.suggestions.length > 0, 'mindestens ein Vorschlag erwartet');

		const ownIds = (await Pillar.findAll({ where: { userId: uidA } })).map((p) => p.id);
		const foreignIds = (await Pillar.findAll({ where: { userId: uidB } })).map((p) => p.id);
		for (const s of body.suggestions) {
			assert.ok(ownIds.includes(s.pillarId), `pillarId ${s.pillarId} muss eine eigene Säule sein`);
			assert.ok(!foreignIds.includes(s.pillarId), `pillarId ${s.pillarId} darf keine fremde Säule sein`);
		}
	});

	it('AK3: Few-Shot-Feedback-Beispiele kommen nur aus Korrekturen desselben Nutzers', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		const cookieB = await testLogin('userB@example.com', 'User B');

		// Beide haben jeweils eine Säule, damit Feedback gespeichert werden kann.
		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');
		const pillarA = await Pillar.create({ name: 'A-Säule', description: 'a', weight: 100, userId: uidA });
		await Pillar.create({ name: 'B-Säule', description: 'b', weight: 100, userId: uidB });

		// User A speichert ein Feedback-Sample.
		const fbA = await postAs(cookieA, '/tasks/suggest-pillars/feedback', {
			title: 'Task von A',
			pillars: [{ pillarId: pillarA.id, confidence: 90 }],
		});
		assert.equal(fbA.status, 201, 'User A kann Feedback speichern');

		// Aktuelle Modell-Annahme: PillarFeedback hat (noch) keine userId → das Sample ist global
		// sichtbar. AK3 verlangt die Nutzerscopung, sodass User B das Sample von A NICHT sieht.
		await postAs(cookieB, '/tasks/suggest-pillars', { title: 'Task von B' });

		assert.ok(recordedExamples !== undefined, 'Classifier muss examples erhalten');
		const titles = recordedExamples.map((e) => e.title);
		assert.ok(
			!titles.includes('Task von A'),
			`User B darf A's Feedback-Titel nicht als Few-Shot sehen; erhalten: ${JSON.stringify(titles)}`,
		);
	});

	it('AK3: User A sieht umgekehrt nur die eigenen Feedback-Beispiele', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		const cookieB = await testLogin('userB@example.com', 'User B');

		const uidA = await userIdOf('userA@example.com');
		const uidB = await userIdOf('userB@example.com');
		await Pillar.create({ name: 'A-Säule', description: 'a', weight: 100, userId: uidA });
		const pillarB = await Pillar.create({ name: 'B-Säule', description: 'b', weight: 100, userId: uidB });

		await postAs(cookieB, '/tasks/suggest-pillars/feedback', {
			title: 'Task von B',
			pillars: [{ pillarId: pillarB.id, confidence: 90 }],
		});

		await postAs(cookieA, '/tasks/suggest-pillars', { title: 'Task von A (wieder)' });

		assert.ok(recordedExamples !== undefined, 'Classifier muss examples erhalten');
		const titles = recordedExamples.map((e) => e.title);
		assert.ok(
			!titles.includes('Task von B'),
			`User A darf B's Feedback-Titel nicht als Few-Shot sehen; erhalten: ${JSON.stringify(titles)}`,
		);
	});

	it('AK4: Nutzer ohne Säulen erhält HTTP 503', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		// Keine Säulen für User A angelegt.
		const res = await postAs(cookieA, '/tasks/suggest-pillars', { title: 'Etwas tun' });
		assert.equal(res.status, 503);
	});

	it('AK4: leere Säulen eines Nutzers führen nicht dazu, dass fremde Säulen sichtbar werden', async () => {
		const cookieA = await testLogin('userA@example.com', 'User A');
		await testLogin('userB@example.com', 'User B');
		const uidB = await userIdOf('userB@example.com');
		// Nur User B hat Säulen.
		await Pillar.create({ name: 'B-Säule', description: 'b', weight: 100, userId: uidB });

		const res = await postAs(cookieA, '/tasks/suggest-pillars', { title: 'Etwas tun' });
		assert.equal(res.status, 503);
		// Classifier darf bei leerer Säulenliste gar nicht erst mit fremden Säulen gerufen werden.
		assert.equal(recordedInput, undefined, 'Classifier darf bei 503 nicht aufgerufen werden');
	});
});

// Abdeckung der Modell-Annahme: PillarFeedback muss pro Nutzer isoliert sein, damit AK3 greift.
// Die Umsetzung wird PillarFeedback um eine userId-Spalte erweitern; dieser Test sichert den Vertrag.
describe('PillarFeedback — Nutzerscopung (AK3 #430)', () => {
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

	it('AK3: PillarFeedback besitzt eine userId-Spalte', async () => {
		// Ein Feedback-Sample mit userId muss persistierbar sein (Vertrag für die Nutzerscopung).
		// Der Cast umgeht den Compile-Fehler bis die Umsetzung die Spalte ergänzt; der echte Vertrag
		// ist die Assertion weiter unten (reloaded?.userId === 42).
		const created = await PillarFeedback.create({
			title: 'Sample',
			description: null,
			pillars: [{ pillarId: 1, confidence: 80 }],
			...({} as Record<string, unknown>),
			userId: 42,
		});
		assert.ok(created.id > 0, 'Feedback muss persistiert werden');
		// Gelesen zurück mit userId, um die Spalte zu verifizieren.
		const reloaded = await PillarFeedback.findByPk(created.id);
		// AK3-Vertrag: sobald die Umsetzung PillarFeedback.userId ergänzt, wird diese Assertion grün.
		assert.equal(
			(reloaded as PillarFeedback & { userId?: number }).userId,
			42,
			'PillarFeedback.userId muss persistiert werden',
		);
	});
});
