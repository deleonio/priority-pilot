import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../../test/helpers.js';
import { AiUsage, Pillar, Task, TaskPillar, User } from '../../models/index.js';
import {
	MistralRequestError,
	type ClassifyPillarsInput,
	type PillarClassifier,
	type PillarSuggestion,
} from '../../llm/llm.js';

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

	it('wartet bei einem Rate-Limit (429) länger und öfter als bei sonstigen Fehlern', async () => {
		let attempts = 0;
		const rateLimited: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			attempts += 1;
			if (attempts < 4) {
				// retryAfterMs: 0 hält den Test schnell; der Zähler zeigt, dass es mehr als die drei
				// Versuche für sonstige Fehler sind.
				throw new MistralRequestError('Mistral antwortete mit HTTP 429', { status: 429, retryAfterMs: 0 });
			}
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;

		const limitedServer = await startTestServer({ pillarClassifier: rateLimited });
		try {
			const cookie = await limitedServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Gedrosselte Aufgabe', status: 'Open', userId: memberId });

			const res = await fetch(`${limitedServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { updated: number; failed: number; failureReasons?: unknown };
			assert.equal(attempts, 4);
			assert.equal(body.updated, 1);
			assert.equal(body.failed, 0);
			assert.equal(body.failureReasons, undefined, 'ohne Fehlschlag kein failureReasons');
		} finally {
			await limitedServer.close();
		}
	});

	it('meldet den Grund fehlgeschlagener Aufgaben zusammengefasst zurück', async () => {
		const alwaysLimited: PillarClassifier = (async () => {
			throw new MistralRequestError('Mistral antwortete mit HTTP 429', { status: 429, retryAfterMs: 0 });
		}) as PillarClassifier;

		const limitedServer = await startTestServer({ pillarClassifier: alwaysLimited });
		try {
			const cookie = await limitedServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Aufgabe 1', status: 'Open', userId: memberId });
			await Task.create({ title: 'Aufgabe 2', status: 'Open', userId: memberId });

			const res = await fetch(`${limitedServer.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { failed: number; failureReasons?: Record<string, number> };
			assert.equal(body.failed, 2);
			assert.deepEqual(body.failureReasons, { 'HTTP 429': 2 });
		} finally {
			await limitedServer.close();
		}
	});

	it('setzt einen Lauf fort: nur fehlgeschlagene und nicht erreichte Aufgaben, nicht alle erneut', async () => {
		const seen: string[] = [];
		let failTitle: string | null = 'Aufgabe 2';
		const classifier: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			seen.push(input.title);
			if (input.title === failTitle) {
				throw new MistralRequestError('HTTP 400', { status: 400 });
			}
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;

		const resumeServer = await startTestServer({ pillarClassifier: classifier });
		try {
			const cookie = await resumeServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			for (const title of ['Aufgabe 1', 'Aufgabe 2', 'Aufgabe 3']) {
				await Task.create({ title, status: 'Open', userId: memberId });
			}
			const call = (method: 'GET' | 'POST', query: string): Promise<Response> =>
				fetch(`${resumeServer.baseUrl}/tasks/reassign-pillars${method === 'GET' ? '/status' : ''}${query}`, {
					method,
					headers: { Cookie: cookie },
				});

			const before = (await (await call('GET', '')).json()) as { startedAt: string | null; pending: number };
			assert.equal(before.startedAt, null, 'noch kein Lauf');
			assert.equal(before.pending, 3);

			// Erste Portion: 2 Aufgaben, davon schlägt „Aufgabe 2“ fehl.
			const first = (await (await call('POST', '?restart=true&limit=2')).json()) as {
				updated: number;
				failed: number;
				remaining: number;
			};
			assert.deepEqual([first.updated, first.failed, first.remaining], [1, 1, 1]);

			const between = (await (await call('GET', '')).json()) as { startedAt: string | null; pending: number };
			assert.ok(between.startedAt, 'Laufstart gemerkt');
			assert.equal(between.pending, 2, 'die fehlgeschlagene und die nicht erreichte Aufgabe');

			// Später fortsetzen (neue Serie, offset 0): „Aufgabe 1“ kommt nicht noch einmal dran.
			failTitle = null;
			seen.length = 0;
			const resumed = (await (await call('POST', '')).json()) as { updated: number; remaining: number };
			assert.deepEqual(seen, ['Aufgabe 2', 'Aufgabe 3']);
			assert.equal(resumed.updated, 2);
			assert.equal(resumed.remaining, 0);
			assert.equal(((await (await call('GET', '')).json()) as { pending: number }).pending, 0);

			// Ein Neustart nimmt wieder alle.
			seen.length = 0;
			await call('POST', '?restart=true');
			assert.deepEqual(seen, ['Aufgabe 1', 'Aufgabe 2', 'Aufgabe 3']);
		} finally {
			await resumeServer.close();
		}
	});

	it('überspringt im Fortsetzen-Modus mit offset nur die fehlgeschlagenen der Serie', async () => {
		const seen: string[] = [];
		const classifier: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			seen.push(input.title);
			if (input.title === 'Aufgabe 1') {
				throw new MistralRequestError('HTTP 400', { status: 400 });
			}
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;

		const offsetServer = await startTestServer({ pillarClassifier: classifier });
		try {
			const cookie = await offsetServer.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			for (const title of ['Aufgabe 1', 'Aufgabe 2', 'Aufgabe 3']) {
				await Task.create({ title, status: 'Open', userId: memberId });
			}
			const post = (query: string) =>
				fetch(`${offsetServer.baseUrl}/tasks/reassign-pillars${query}`, {
					method: 'POST',
					headers: { Cookie: cookie },
				});

			const first = (await (await post('?restart=true&limit=2')).json()) as { failed: number; remaining: number };
			assert.equal(first.failed, 1);
			// Wie das Modal: offset = Zahl der Fehlschläge dieser Serie.
			const second = (await (await post(`?limit=2&offset=${first.failed}`)).json()) as { remaining: number };
			// Retries derselben Aufgabe zählen nicht — es geht um die Reihenfolge der Aufgaben.
			assert.deepEqual([...new Set(seen)], ['Aufgabe 1', 'Aufgabe 2', 'Aufgabe 3'], 'keine ausgelassen');
			assert.equal(seen.filter((title) => title === 'Aufgabe 2').length, 1, 'Aufgabe 2 nicht doppelt');
			assert.equal(second.remaining, 0);
		} finally {
			await offsetServer.close();
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

/**
 * #1614: Die Buchung des KI-Kontingents liegt bei diesem Endpunkt NICHT in der Middleware, sondern
 * je klassifizierter Aufgabe im Lauf — ein Request löst N Provider-Aufrufe aus. Ein Zählfehler hier
 * fällt im Betrieb nirgends auf: nicht im UI, nicht in den Logs, sondern erst auf der Rechnung oder
 * beim Nutzer, dem das Kontingent zu früh ausgeht. Deshalb wird gegen `AiUsage` geprüft.
 */
describe('POST /tasks/reassign-pillars — Kontingent je Aufgabe', () => {
	let server: TestServer;

	const yearMonth = (): string => new Date().toISOString().slice(0, 7);

	const usageOf = async (userId: number): Promise<number> =>
		(await AiUsage.findOne({ where: { userId, yearMonth: yearMonth() } }))?.count ?? 0;

	const seedUsage = async (userId: number, count: number): Promise<void> => {
		await AiUsage.create({ userId, yearMonth: yearMonth(), count });
	};

	/** Konto mit zählbarem Paket: `free` hat Kontingent 0, damit liefe jeder Lauf sofort in die 429. */
	const preparePayingMember = async (): Promise<number> => {
		const memberId = await userIdOf(MEMBER_EMAIL);
		await User.update({ plan: 'pro' }, { where: { id: memberId } });
		return memberId;
	};

	before(async () => {
		server = await startTestServer({ pillarClassifier: firstPillarClassifier });
	});
	beforeEach(async () => {
		await resetDb();
		process.env.MONETIZATION_ENFORCED = 'true';
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const run = (cookie: string, baseUrl = server.baseUrl): Promise<Response> =>
		fetch(`${baseUrl}/tasks/reassign-pillars`, { method: 'POST', headers: { Cookie: cookie } });

	it('bucht genau einen Punkt je Aufgabe — nicht zusätzlich einen für den Request', async () => {
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await preparePayingMember();
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		for (const title of ['A', 'B', 'C']) {
			await Task.create({ title, status: 'Open', userId: memberId });
		}

		const res = await run(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; quotaRemaining?: number };
		assert.equal(body.updated, 3);

		// Drei Aufgaben, drei Punkte. Mit zusätzlich mitlaufender Zähler-Middleware wären es vier.
		assert.equal(await usageOf(memberId), 3, 'genau ein Punkt je klassifizierter Aufgabe');
		// `quotaRemaining` muss den Stand NACH dem Lauf melden, nicht den davor.
		assert.equal(body.quotaRemaining, 60 - 3);
	});

	it('storniert eine gescheiterte Klassifikation, behält aber die ohne brauchbaren Vorschlag', async () => {
		const failing: PillarClassifier = (async () => {
			throw new Error('Upstream tot');
		}) as PillarClassifier;
		const emptySuggestion: PillarClassifier = (async () => []) as PillarClassifier;

		for (const [classifier, expected, label] of [
			[failing, 0, 'gescheiterte Klassifikation wird storniert'],
			[emptySuggestion, 1, 'Antwort ohne brauchbaren Vorschlag bleibt gebucht'],
		] as const) {
			await resetDb();
			const scoped = await startTestServer({ pillarClassifier: classifier });
			try {
				const cookie = await scoped.login(MEMBER_EMAIL, { role: 'member' });
				const memberId = await preparePayingMember();
				await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
				await Task.create({ title: 'Eine Aufgabe', status: 'Open', userId: memberId });

				const res = await run(cookie, scoped.baseUrl);
				assert.equal(res.status, 200);
				assert.equal(await usageOf(memberId), expected, label);
			} finally {
				await scoped.close();
			}
		}
	});

	it('hält an, wenn das Kontingent mitten im Lauf ausgeht, und lässt den Rest unberührt', async () => {
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await preparePayingMember();
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'A', status: 'Open', userId: memberId });
		const zweite = await Task.create({ title: 'B', status: 'Open', userId: memberId });
		const dritte = await Task.create({ title: 'C', status: 'Open', userId: memberId });
		// Genau ein Punkt bleibt übrig (Paket „pro": 60).
		await seedUsage(memberId, 59);

		const res = await run(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			updated: number;
			failed: number;
			skipped: number;
			remaining: number;
			quotaExhausted: boolean;
		};
		assert.equal(body.updated, 1, 'nur die erste Aufgabe passt noch ins Kontingent');
		assert.equal(body.quotaExhausted, true);
		assert.ok(body.remaining > 0, 'die unbearbeiteten Aufgaben bleiben als offen gemeldet');
		// Der Rest zählt weder als Fehler noch als übersprungen — er wurde schlicht nicht angefasst.
		assert.equal(body.failed, 0);
		assert.equal(body.skipped, 0);
		assert.equal((await contributionsOf(zweite.id)).length, 0);
		assert.equal((await contributionsOf(dritte.id)).length, 0);
	});

	it('weist mit 429 ab, wenn das Kontingent schon vor dem ersten Aufruf erschöpft ist', async () => {
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await preparePayingMember();
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'A', status: 'Open', userId: memberId });
		await seedUsage(memberId, 60);

		const res = await run(cookie);
		assert.equal(res.status, 429);
		const body = (await res.json()) as { code?: string; currentPlan?: string };
		assert.equal(body.code, 'quota_exhausted');
		assert.equal(body.currentPlan, 'pro');
	});
});
