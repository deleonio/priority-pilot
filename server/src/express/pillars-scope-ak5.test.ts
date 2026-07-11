import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import type { PillarClassifier, ActivityAdvisor, ClassifyPillarsInput, AdviseActivitiesInput } from '../llm/mistral.js';

/**
 * ROTE Spec-Tests (#422, AK5): suggest-pillars, pillar-advisor und scores/by-pillar arbeiten
 * nur mit den Säulen des eingeloggten Nutzers (ownerScope).
 *
 * Aktuell rufen alle drei Endpunkte Pillar.findAll() ohne ownerScope auf — diese Tests sind rot,
 * bis die Umsetzung die Nutzer-Isolation nachrüstet.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
process.env.SESSION_SECRET = 'scope-ak5-secret';
process.env.GOOGLE_CLIENT_ID = 'scope-ak5-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'scope-ak5-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';

let server: TestServer;

const login = async (email: string): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, displayName: email.split('@')[0] }),
	});
	assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte Set-Cookie setzen');
	return setCookie!.split(';')[0];
};

describe('AK5 — Nutzer-Scoping für suggest-pillars, pillar-advisor, scores/by-pillar', () => {
	let lastClassifyInput: ClassifyPillarsInput | undefined;
	let lastAdviseInput: AdviseActivitiesInput | undefined;
	let classifierImpl: PillarClassifier;
	let advisorImpl: ActivityAdvisor;

	const classifier: PillarClassifier = (input) => {
		lastClassifyInput = input;
		return classifierImpl(input);
	};

	const advisor: ActivityAdvisor = (input) => {
		lastAdviseInput = input;
		return advisorImpl(input);
	};

	before(async () => {
		server = await startTestServer({ pillarClassifier: classifier, activityAdvisor: advisor });
	});

	beforeEach(async () => {
		await resetDb();
		lastClassifyInput = undefined;
		lastAdviseInput = undefined;
		classifierImpl = async () => [];
		advisorImpl = async () => [];
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	// ── POST /tasks/suggest-pillars (AK5) ──────────────────────────────────

	describe('POST /tasks/suggest-pillars', () => {
		it('AK5: liefert dem Klassifikator nur die Säulen des eingeloggten Nutzers (Alice)', async () => {
			const aliceCookie = await login(TEST_EMAIL_ALICE);
			// Bob als Nutzer anlegen (damit userId=2 existiert)
			await login(TEST_EMAIL_BOB);

			// Alice legt eigene Säule an (userId 1)
			await Pillar.create({ name: 'AliceOnly', weight: 100, userId: 1 });
			// Bob legt eigene Säule an (userId 2)
			await Pillar.create({ name: 'BobOnly', weight: 100, userId: 2 });

			// Alice ruft suggest-pillars auf
			await fetch(`${server.baseUrl}/tasks/suggest-pillars`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify({ title: 'Test' }),
			});

			assert.ok(lastClassifyInput, 'Klassifikator wurde aufgerufen');
			const pillarNames = lastClassifyInput!.pillars.map((p) => p.name);
			assert.ok(pillarNames.includes('AliceOnly'), 'Alice sieht ihre eigene Säule');
			assert.ok(!pillarNames.includes('BobOnly'), 'Alice sieht NICHT Bobs Säule (AK5)');
		});

		it('AK5: liefert dem Klassifikator nur die Säulen des eingeloggten Nutzers (Bob)', async () => {
			// Alice als Nutzer anlegen (damit userId=1 existiert)
			await login(TEST_EMAIL_ALICE);
			const bobCookie = await login(TEST_EMAIL_BOB);

			await Pillar.create({ name: 'AlicePillar', weight: 100, userId: 1 });
			await Pillar.create({ name: 'BobPillar', weight: 100, userId: 2 });

			lastClassifyInput = undefined;
			await fetch(`${server.baseUrl}/tasks/suggest-pillars`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: bobCookie },
				body: JSON.stringify({ title: 'Test' }),
			});

			assert.ok(lastClassifyInput, 'Klassifikator wurde aufgerufen');
			const pillarNames = lastClassifyInput!.pillars.map((p) => p.name);
			assert.ok(pillarNames.includes('BobPillar'), 'Bob sieht seine eigene Säule');
			assert.ok(!pillarNames.includes('AlicePillar'), 'Bob sieht NICHT Alices Säule (AK5)');
		});
	});

	// ── POST /pillars/advisor (AK5) ────────────────────────────────────────

	describe('POST /pillars/advisor', () => {
		it('AK5: liefert dem Berater nur die Säulen des eingeloggten Nutzers', async () => {
			const aliceCookie = await login(TEST_EMAIL_ALICE);
			// Bob als Nutzer anlegen (damit userId=2 existiert)
			await login(TEST_EMAIL_BOB);

			await Pillar.create({ name: 'AliceHealth', weight: 50, userId: 1 });
			await Pillar.create({ name: 'BobFinance', weight: 50, userId: 2 });

			await fetch(`${server.baseUrl}/pillars/advisor`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify({ question: 'Was tun?' }),
			});

			assert.ok(lastAdviseInput, 'Berater wurde aufgerufen');
			const pillarNames = lastAdviseInput!.pillars.map((p) => p.name);
			assert.ok(pillarNames.includes('AliceHealth'), 'Alice sieht ihre eigene Säule');
			assert.ok(!pillarNames.includes('BobFinance'), 'Alice sieht NICHT Bobs Säule (AK5)');
		});
	});

	// ── GET /scores/by-pillar (AK5) ────────────────────────────────────────

	describe('GET /scores/by-pillar', () => {
		it('AK5: aggregiert Punkte nur über die Säulen des eingeloggten Nutzers', async () => {
			const aliceCookie = await login(TEST_EMAIL_ALICE);
			const bobCookie = await login(TEST_EMAIL_BOB);

			// Alice hat Säule A mit einem Task + Score
			const alicePillar = await Pillar.create({ name: 'AliceMove', weight: 50, userId: 1 });
			const aliceTaskRes = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify({
					title: 'Alice Task',
					status: 'Open',
					priority: 3,
					estimatedEffort: 1,
					pillars: [{ pillarId: alicePillar.id, share: 100, confidence: 100 }],
				}),
			});
			assert.equal(aliceTaskRes.status, 201, 'Alice kann Task anlegen');
			const aliceTaskId = (await aliceTaskRes.json()).id as number;
			await fetch(`${server.baseUrl}/tasks/${aliceTaskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
				body: JSON.stringify({ status: 'Done' }),
			});

			// Bob hat Säule B mit einem Task + Score
			const bobPillar = await Pillar.create({ name: 'BobFinance', weight: 50, userId: 2 });
			const bobTaskRes = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie: bobCookie },
				body: JSON.stringify({
					title: 'Bob Task',
					status: 'Open',
					priority: 3,
					estimatedEffort: 1,
					deadline: '2026-12-31T00:00:00.000Z',
					pillars: [{ pillarId: bobPillar.id, share: 100, confidence: 100 }],
				}),
			});
			assert.equal(bobTaskRes.status, 201, 'Bob kann Task anlegen');
			const bobTaskId = (await bobTaskRes.json()).id as number;
			await fetch(`${server.baseUrl}/tasks/${bobTaskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', cookie: bobCookie },
				body: JSON.stringify({ status: 'Done' }),
			});

			// Alice ruft scores/by-pillar auf
			const scoresRes = await fetch(`${server.baseUrl}/scores/by-pillar`, {
				headers: { cookie: aliceCookie },
			});
			assert.equal(scoresRes.status, 200, 'scores/by-pillar liefert 200');
			const scores = (await scoresRes.json()) as Array<{ pillarId: number; punkte: number }>;
			const alicePoints = scores.find((s) => s.pillarId === alicePillar.id);
			const bobPoints = scores.find((s) => s.pillarId === bobPillar.id);

			assert.ok(alicePoints !== undefined, 'Alice sieht Punkte für ihre eigene Säule');
			assert.ok(alicePoints!.punkte > 0, 'Alice hat Punkte auf ihrer Säule');
			assert.equal(bobPoints, undefined, 'Alice sieht NICHT Bobs Säulen-Punkte (AK5)');
		});
	});
});
