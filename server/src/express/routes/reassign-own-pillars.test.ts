import { describe, it, before, beforeEach, afterEach, after } from 'node:test';
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

/**
 * Test-Pflege #1642: POST startet nur noch den Hintergrundlauf (202). Der Helper wartet dessen Ende
 * über den Status-Endpunkt ab und liefert das Ergebnis im bisherigen Antwortformat, damit die
 * fachlichen Assertions dieser Tests unverändert bleiben. `remaining` = noch nicht erreichte Aufgaben.
 */
const startAndAwait = async (baseUrl: string, cookie: string, query = ''): Promise<Response> => {
	const res = await fetch(`${baseUrl}/tasks/reassign-pillars${query}`, { method: 'POST', headers: { Cookie: cookie } });
	if (res.status !== 202) {
		return res;
	}
	return awaitRun(baseUrl, cookie, query);
};

const awaitRun = async (baseUrl: string, cookie: string, query = ''): Promise<Response> => {
	for (let tries = 0; tries < 250; tries++) {
		const status = (await (
			await fetch(`${baseUrl}/tasks/reassign-pillars/status${query}`, { headers: { Cookie: cookie } })
		).json()) as { running: boolean; pending: number; result?: { failed: number } };
		if (!status.running) {
			const failed = status.result?.failed ?? 0;
			return new Response(JSON.stringify({ ...status.result, remaining: Math.max(0, status.pending - failed) }), {
				status: 200,
			});
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('Hintergrundlauf endete nicht rechtzeitig');
};

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

	const post = (cookie: string, query = ''): Promise<Response> => startAndAwait(server.baseUrl, cookie, query);

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

	it('speichert den Mindestanteil auch für nicht vorgeschlagene Säulen (#1635)', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);
		const first = await Pillar.create({ userId: memberId, name: 'Wirksamkeit', weight: 1 });
		const second = await Pillar.create({ userId: memberId, name: 'Sinn', weight: 1 });
		const third = await Pillar.create({ userId: memberId, name: 'Körper', weight: 1 });
		const task = await Task.create({ title: 'Nur eine Säule vorgeschlagen', status: 'Done', userId: memberId });

		// `firstPillarClassifier` schlägt ausschließlich die erste Säule vor.
		const res = await post(memberCookie);
		assert.equal(res.status, 200);

		const rows = await contributionsOf(task.id);
		assert.deepEqual(
			rows.map((row) => [row.pillarId, row.share]),
			[
				[first.id, 90],
				[second.id, 5],
				[third.id, 5],
			],
			'vorher: 100 / 0 / 0 — jetzt jede Säule mindestens 5 %',
		);
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

			const res = await startAndAwait(flakyServer.baseUrl, cookie);
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

			const res = await startAndAwait(limitedServer.baseUrl, cookie);
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

			const res = await startAndAwait(limitedServer.baseUrl, cookie);
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
				method === 'POST'
					? startAndAwait(resumeServer.baseUrl, cookie, query)
					: fetch(`${resumeServer.baseUrl}/tasks/reassign-pillars/status${query}`, { headers: { Cookie: cookie } });

			const before = (await (await call('GET', '')).json()) as { startedAt: string | null; pending: number };
			assert.equal(before.startedAt, null, 'noch kein Lauf');
			assert.equal(before.pending, 3);

			// Test-Pflege #1642: der Hintergrundlauf holt alle Portionen selbst ab — „Aufgabe 2“ schlägt fehl.
			const first = (await (await call('POST', '?restart=true&limit=2')).json()) as {
				updated: number;
				failed: number;
				remaining: number;
			};
			assert.deepEqual([first.updated, first.failed, first.remaining], [2, 1, 0]);

			const between = (await (await call('GET', '')).json()) as { startedAt: string | null; pending: number };
			assert.ok(between.startedAt, 'Laufstart gemerkt');
			assert.equal(between.pending, 1, 'nur die fehlgeschlagene Aufgabe');

			// Später fortsetzen: „Aufgabe 1“ und „Aufgabe 3“ kommen nicht noch einmal dran.
			failTitle = null;
			seen.length = 0;
			const resumed = (await (await call('POST', '')).json()) as { updated: number; remaining: number };
			assert.deepEqual(seen, ['Aufgabe 2']);
			assert.equal(resumed.updated, 1);
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
			// Test-Pflege #1642: der Hintergrundlauf schiebt den offset zwischen seinen Portionen
			// (limit=2) selbst um die Fehlschläge weiter — vorher tat das der Client.
			const second = (await (await startAndAwait(offsetServer.baseUrl, cookie, '?restart=true&limit=2')).json()) as {
				failed: number;
				remaining: number;
			};
			assert.equal(second.failed, 1);
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

			const res = await startAndAwait(brokenServer.baseUrl, cookie);
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
			const second = await startAndAwait(slowServer.baseUrl, cookie);
			assert.equal(second.status, 409);
			release();
			assert.equal((await first).status, 202);
			await awaitRun(slowServer.baseUrl, cookie);
		} finally {
			await slowServer.close();
		}
	});
});

/**
 * #1642: Die Neuberechnung läuft serverseitig im Hintergrund weiter, statt den Request bis zum Ende
 * offenzuhalten — POST startet nur noch den Lauf, `GET .../status` liefert währenddessen `running`
 * mit Fortschritt und danach das Ergebnis. Siehe docs/spec/issue-1642.md.
 */
describe('POST/GET /tasks/reassign-pillars — Hintergrundlauf (#1642)', () => {
	let server: TestServer;

	const statusOf = async (
		cookie: string,
	): Promise<{
		running: boolean;
		processed?: number;
		total: number;
		pending: number;
		result?: { updated: number; failed: number; skipped: number; quotaExhausted: boolean };
	}> => {
		const res = await fetch(`${server.baseUrl}/tasks/reassign-pillars/status`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200);
		return res.json();
	};

	const pollUntilDone = async (cookie: string, maxTries = 100): Promise<Awaited<ReturnType<typeof statusOf>>> => {
		for (let remaining = maxTries; remaining > 0; remaining--) {
			const status = await statusOf(cookie);
			if (!status.running) {
				return status;
			}
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		throw new Error('Hintergrundlauf endete nicht rechtzeitig');
	};

	/** Ein steuerbares Gate je Aufgabe — der Test entscheidet, wann welcher Klassifikator-Aufruf durchläuft. */
	const gatedClassifier = (): {
		classifier: PillarClassifier;
		release: (index: number) => void;
		calls: () => number;
	} => {
		const gates: (() => void)[] = [];
		// Test-Pflege #1642: ein vor dem Aufruf freigegebenes Gate lässt ihn sofort durch — der
		// Lauf klassifiziert sequenziell, Aufruf 2 existiert beim Freigeben noch nicht.
		const released = new Set<number>();
		let calls = 0;
		const classifier: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			const index = calls;
			calls += 1;
			if (!released.has(index)) {
				await new Promise<void>((resolve) => {
					gates[index] = resolve;
				});
			}
			const suggestions: PillarSuggestion[] =
				input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
			return suggestions;
		}) as PillarClassifier;
		return {
			classifier,
			release: (index: number) => {
				released.add(index);
				gates[index]?.();
			},
			calls: () => calls,
		};
	};

	afterEach(async () => {
		if (server) {
			await server.close();
		}
	});

	it('AK1/AK2: POST antwortet, bevor der Lauf fertig ist; der Status meldet running mit Fortschritt', async () => {
		await resetDb();
		const { classifier, release } = gatedClassifier();
		server = await startTestServer({ pillarClassifier: classifier });
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Erste', status: 'Open', userId: memberId });
		await Task.create({ title: 'Zweite', status: 'Open', userId: memberId });

		// Nicht sofort awaiten: mit dem BISHERIGEN synchronen Verhalten würde der Request bis zum
		// Freigeben beider Gates blockieren — genau das darf laut AK1 nicht mehr passieren, und ein
		// `await` an dieser Stelle würde den Test dann hängen statt rot fehlschlagen lassen.
		const postPromise = fetch(`${server.baseUrl}/tasks/reassign-pillars`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		try {
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Der erste Klassifikator-Aufruf hängt noch am Gate — der Lauf kann also noch nicht fertig sein.
			const midRun = await statusOf(cookie);
			assert.equal(midRun.running, true, 'Hintergrundlauf muss noch laufen, während der Klassifikator blockiert');
			assert.equal(midRun.processed, 0, 'noch keine Aufgabe abgeschlossen');
		} finally {
			// IMMER freigeben, auch wenn eine Assertion oben scheitert — sonst hängt die POST-Verbindung
			// dauerhaft am Gate und `server.close()` in afterEach blockiert den restlichen Testlauf.
			release(0);
			release(1);
		}
		const res = await postPromise;
		assert.ok(res.status >= 200 && res.status < 300, `POST muss den Start bestätigen, Status war ${res.status}`);
		const done = await pollUntilDone(cookie);
		assert.equal(done.running, false);
		assert.ok(done.result, 'nach Lauf-Ende muss ein Ergebnis vorliegen');
		assert.equal(done.result?.updated, 2, 'beide Aufgaben verarbeitet, ohne dass der Client erneut posten musste');
	});

	it('AK3: die Sperre bleibt bis Lauf-Ende belegt, auch wenn die POST-Antwort bereits da ist', async () => {
		await resetDb();
		const { classifier, release } = gatedClassifier();
		server = await startTestServer({ pillarClassifier: classifier });
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Erste', status: 'Open', userId: memberId });

		const firstPost = fetch(`${server.baseUrl}/tasks/reassign-pillars`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		try {
			// Race statt await: belegt, dass die erste Antwort da sein KANN, ohne den Test bei noch
			// synchronem Verhalten hängen zu lassen (das Gate ist bewusst noch nicht freigegeben).
			const raceResult = await Promise.race([
				firstPost.then(() => 'responded' as const),
				new Promise<'still-pending'>((resolve) => setTimeout(() => resolve('still-pending'), 200)),
			]);
			assert.equal(
				raceResult,
				'responded',
				'AK1: POST muss innerhalb von 200ms antworten, auch während der Klassifikator noch blockiert',
			);

			const duringRun = await fetch(`${server.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(
				duringRun.status,
				409,
				'ein zweiter Start bleibt gesperrt, obwohl die erste Antwort schon eingetroffen ist',
			);
		} finally {
			release(0);
		}
		await pollUntilDone(cookie);

		const afterRun = await fetch(`${server.baseUrl}/tasks/reassign-pillars?restart=true`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		assert.ok(
			afterRun.status >= 200 && afterRun.status < 300,
			`nach Lauf-Ende muss ein Neustart möglich sein, Status war ${afterRun.status}`,
		);
	});

	it('AK4: Kontingent-Erschöpfung beendet den Hintergrundlauf mit Teilfortschritt', async () => {
		await resetDb();
		const { classifier, release } = gatedClassifier();
		server = await startTestServer({ pillarClassifier: classifier });
		process.env.MONETIZATION_ENFORCED = 'true';
		try {
			const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
			const memberId = await userIdOf(MEMBER_EMAIL);
			await User.update({ plan: 'pro' }, { where: { id: memberId } });
			await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
			await Task.create({ title: 'Erste', status: 'Open', userId: memberId });
			await Task.create({ title: 'Zweite', status: 'Open', userId: memberId });
			await AiUsage.create({ userId: memberId, yearMonth: new Date().toISOString().slice(0, 7), count: 59 });

			const postPromise = fetch(`${server.baseUrl}/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			await new Promise((resolve) => setTimeout(resolve, 50));
			release(0);
			await postPromise;
			const done = await pollUntilDone(cookie);
			assert.equal(done.running, false);
			assert.equal(done.result?.updated, 1, 'nur die erste Aufgabe passte noch ins Kontingent');
			assert.equal(done.result?.quotaExhausted, true);
		} finally {
			delete process.env.MONETIZATION_ENFORCED;
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

	const run = (cookie: string, baseUrl = server.baseUrl): Promise<Response> => startAndAwait(baseUrl, cookie);

	it('bucht genau einen Punkt je Aufgabe — nicht zusätzlich einen für den Request', async () => {
		const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await preparePayingMember();
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		for (const title of ['A', 'B', 'C']) {
			await Task.create({ title, status: 'Open', userId: memberId });
		}

		const res = await run(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number };
		assert.equal(body.updated, 3);

		// Drei Aufgaben, drei Punkte. Mit zusätzlich mitlaufender Zähler-Middleware wären es vier.
		assert.equal(await usageOf(memberId), 3, 'genau ein Punkt je klassifizierter Aufgabe');
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
