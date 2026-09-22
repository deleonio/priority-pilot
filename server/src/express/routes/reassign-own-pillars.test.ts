import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../../test/helpers.js';
import { Pillar, Task, TaskPillar, User } from '../../models/index.js';
import type { ClassifyPillarsInput, PillarClassifier, PillarSuggestion } from '../../llm/llm.js';

/**
 * Tests für die Neuberechnung der EIGENEN Säulenverteilung (POST /tasks/reassign-pillars, #1614).
 *
 * Der Endpunkt ist das nutzereigene Gegenstück zum app-weiten Admin-Batch: dieselbe serverseitige
 * Logik, aber auf das Konto des Aufrufers beschränkt. Geprüft wird die Abgrenzung gegen fremde
 * Konten, die Statusauswahl aus dem Ticket und der Retry, der den in #1614 gemeldeten Anteil
 * „blockierter" Aufgaben auffangen soll.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,other@example.com';
applyTestAuthEnv('reassign-own-pillars-test');

const MEMBER_EMAIL = 'member@example.com';
const OTHER_EMAIL = 'other@example.com';

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Nutzer ${email} muss existieren`);
	return user.id;
};

const contributionsOf = async (taskId: number) =>
	TaskPillar.findAll({ where: { taskId }, order: [['pillarId', 'ASC']] });

/** Schlägt die erste Säule des Kontos vor — reicht, damit eine Aufgabe als `updated` zählt. */
const firstPillarClassifier: PillarClassifier = (async (input: ClassifyPillarsInput) => {
	const suggestions: PillarSuggestion[] =
		input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
	return suggestions;
}) as PillarClassifier;

describe('POST /tasks/reassign-pillars — Neuberechnung der eigenen Säulenverteilung', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({ pillarClassifier: firstPillarClassifier });
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

	const post = (cookie: string, query = ''): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks/reassign-pillars${query}`, { method: 'POST', headers: { Cookie: cookie } });

	it('verarbeitet die eigenen Aufgaben und lässt fremde Konten unberührt', async () => {
		const otherCookie = await server.login(OTHER_EMAIL, { role: 'member' });
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);
		const otherId = await userIdOf(OTHER_EMAIL);
		assert.ok(otherCookie);

		const mine = await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		const theirs = await Pillar.create({ userId: otherId, name: 'Familie', weight: 1 });
		const myTask = await Task.create({ title: 'Meine Aufgabe', status: 'Open', userId: memberId });
		const theirTask = await Task.create({ title: 'Fremde Aufgabe', status: 'Open', userId: otherId });
		await TaskPillar.create({ taskId: theirTask.id, pillarId: theirs.id, share: 100, confidence: 42 });

		const res = await post(memberCookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; remaining: number; quotaExhausted: boolean };
		assert.equal(body.updated, 1, 'nur die eigene Aufgabe');
		assert.equal(body.remaining, 0);
		assert.equal(body.quotaExhausted, false);

		const mineNow = await contributionsOf(myTask.id);
		assert.equal(mineNow.length, 1);
		assert.equal(mineNow[0].pillarId, mine.id);

		// Das fremde Konto bleibt exakt, wie es war — inkl. der ursprünglichen Konfidenz.
		const theirsNow = await contributionsOf(theirTask.id);
		assert.equal(theirsNow.length, 1);
		assert.equal(theirsNow[0].confidence, 42);
	});

	it('beschränkt den Lauf mit status=open auf offene und laufende Aufgaben', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Offen', status: 'Open', userId: memberId });
		// „In process" ist der Vertragswert — mit einem falsch geschriebenen Status fiele diese
		// Aufgabe still aus der Auswahl, genau der Fehler, den #1614 beschreibt.
		await Task.create({ title: 'Läuft', status: 'In process', userId: memberId });
		const done = await Task.create({ title: 'Erledigt', status: 'Done', userId: memberId });

		const res = await post(memberCookie, '?status=open');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; remaining: number };
		assert.equal(body.updated, 2, 'offene UND laufende Aufgabe');
		assert.equal(body.remaining, 0, 'die erledigte Aufgabe zählt bei status=open gar nicht mit');

		assert.equal((await contributionsOf(done.id)).length, 0, 'erledigte Aufgabe unberührt');
	});

	it('beschränkt den Lauf mit status=done auf erledigte Aufgaben', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		const open = await Task.create({ title: 'Offen', status: 'Open', userId: memberId });
		await Task.create({ title: 'Erledigt', status: 'Done', userId: memberId });

		const res = await post(memberCookie, '?status=done');
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { updated: number }).updated, 1);
		assert.equal((await contributionsOf(open.id)).length, 0, 'offene Aufgabe unberührt');
	});

	it('weist einen ungültigen status mit 400 ab', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const res = await post(memberCookie, '?status=halboffen');
		assert.equal(res.status, 400);
	});

	it('wiederholt eine fehlgeschlagene Klassifikation, statt die Aufgabe sofort aufzugeben', async () => {
		let attempts = 0;
		const flaky: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			attempts += 1;
			if (attempts < 3) {
				throw new Error('Rate limit');
			}
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;

		const flakyServer = await startTestServer({ pillarClassifier: flaky });
		try {
			const cookie = await flakyServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Wackelige Aufgabe', status: 'Open', userId: memberId });

			const res = await fetch(`${flakyServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { updated: number; failed: number };
			assert.equal(attempts, 3, 'zwei Fehlversuche, dann Erfolg');
			assert.equal(body.updated, 1, 'die Aufgabe zählt als erfolgreich, nicht als blockiert');
			assert.equal(body.failed, 0);
		} finally {
			await flakyServer.close();
		}
	});

	it('gibt nach erschöpften Versuchen auf und reißt den Lauf nicht ab', async () => {
		const alwaysFailing: PillarClassifier = (async () => {
			throw new Error('Upstream tot');
		}) as PillarClassifier;

		const brokenServer = await startTestServer({ pillarClassifier: alwaysFailing });
		try {
			const cookie = await brokenServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Aufgabe 1', status: 'Open', userId: memberId });
			await Task.create({ title: 'Aufgabe 2', status: 'Open', userId: memberId });

			const res = await fetch(`${brokenServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { updated: number; failed: number };
			assert.equal(body.failed, 2, 'beide Aufgaben gezählt — der Lauf läuft trotz Fehler weiter');
			assert.equal(body.updated, 0);
		} finally {
			await brokenServer.close();
		}
	});

	it('weist einen zweiten, gleichzeitigen Lauf desselben Kontos mit 409 ab', async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slow: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			await gate;
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;

		const slowServer = await startTestServer({ pillarClassifier: slow });
		try {
			const cookie = await slowServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Aufgabe', status: 'Open', userId: memberId });

			const first = fetch(`${slowServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			await new Promise((resolve) => setTimeout(resolve, 20));
			const second = await fetch(`${slowServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(second.status, 409);
			release();
			assert.equal((await first).status, 200);
		} finally {
			await slowServer.close();
		}
	});
});
