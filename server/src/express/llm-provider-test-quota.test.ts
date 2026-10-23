/**
 * Rote Spec-Tests für Issue #2542 (Spec docs/spec/issue-2542.md) — Provider-Test bucht KI-Kontingent
 * (AK1-AK4) und ist pro Nutzer gedrosselt (AK5). Route: `POST /llm-providers/:id/test`.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	applyTestAuthEnv,
	setTestLlmProvider,
	type TestServer,
} from '../test/helpers.js';
import { resetProviderTestCache } from './routes/llmProviders.js';
import { AiUsage, LlmProvider, User } from '../models/index.js';
import { AI_ASSIST_MONTHLY_QUOTA } from '../logics/plans.js';

applyTestAuthEnv('llm-provider-test-quota');

let server: TestServer;
let upstreamCalls = 0;
const originalFetch = globalThis.fetch;

const yearMonth = (): string => new Date().toISOString().slice(0, 7);
const countOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	return (await AiUsage.findOne({ where: { userId: user!.id, yearMonth: yearMonth() } }))?.count ?? 0;
};
const seedUsage = async (email: string, count: number): Promise<void> => {
	const user = await User.findOne({ where: { email } });
	await AiUsage.create({ userId: user!.id, yearMonth: yearMonth(), count });
};

/** Registriert einen Pro-Nutzer (Rollout aktiv, damit das Kontingent drosselt). */
const newUser = async (email: string): Promise<string> => {
	const cookie = await server.register(email);
	await User.update({ plan: 'pro' }, { where: { email } });
	return cookie;
};

let providerSeq = 0;
/** Instanzweiter Custom-Provider (userId null) mit Key und Modell. */
const sharedProvider = async (extra: Record<string, unknown> = {}): Promise<number> => {
	providerSeq += 1;
	const row = await LlmProvider.create({
		name: `shared-${providerSeq}`,
		endpoint: 'https://shared.example.com/v1',
		apiKey: 'shared-key',
		model: 'shared-model',
		kind: 'custom',
		...extra,
	});
	return row.id;
};

const postTest = (cookie: string, id: number | string): Promise<Response> =>
	fetch(`${server.baseUrl}/llm-providers/${id}/test`, { method: 'POST', headers: { Cookie: cookie } });

const postLektorat = (cookie: string): Promise<Response> =>
	fetch(`${server.baseUrl}/lektorat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ text: 'Text mit Tippfehlern.' }),
	});

/** Mockt nur den Mistral-Endpoint von /lektorat. */
const stubMistral = (): void => {
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		if (typeof url === 'string' && url.includes('api.mistral.ai')) {
			return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: 'ok' }) } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return originalFetch(url, init);
	}) as typeof fetch;
};

/** Sekundenangaben im Text normalisieren (Wartezeit schwankt um 1 s). */
const norm = (value: unknown): string => JSON.stringify(value).replace(/\d+ Sekunden/g, 'N Sekunden');

describe('Provider-Test: KI-Kontingent und Rate-Limit (#2542)', () => {
	before(async () => {
		server = await startTestServer({
			runProviderTest: async (runtime) => {
				upstreamCalls += 1;
				return { ok: true, model: runtime.model, latencyMs: 1, sample: '{}' };
			},
		});
	});
	beforeEach(async () => {
		await resetDb();
		await setTestLlmProvider(true);
		process.env.MONETIZATION_ENFORCED = 'true';
		resetProviderTestCache(); // Provider-IDs starten nach resetDb von vorn
		upstreamCalls = 0;
		stubMistral();
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		globalThis.fetch = originalFetch;
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: Test eines instanzweiten Providers bucht genau 1 Punkt', async () => {
		const email = 'ak1@2542.example.com';
		const cookie = await newUser(email);
		const id = await sharedProvider();
		const res = await postTest(cookie, id);
		assert.equal(res.status, 200);
		assert.equal(upstreamCalls, 1, 'Vorbedingung: Upstream wurde aufgerufen');
		assert.equal(await countOf(email), 1);
	});

	it('AK1: instanzweiter Provider zählt auch, wenn der Nutzer einen eigenen Provider aktiv gewählt hat', async () => {
		const email = 'ak1-own@2542.example.com';
		const cookie = await newUser(email);
		const user = await User.findOne({ where: { email } });
		await LlmProvider.create({
			name: 'eigen',
			endpoint: 'https://own.example.com/v1',
			apiKey: 'own-key',
			model: 'own-model',
			kind: 'custom',
			userId: user!.id,
			isActive: true,
		});
		const id = await sharedProvider();
		assert.equal((await postTest(cookie, id)).status, 200);
		assert.equal(await countOf(email), 1);
	});

	it('AK2: erschöpftes Kontingent → Status, Body, Retry-After wie /lektorat; Upstream nicht aufgerufen', async () => {
		const quota = AI_ASSIST_MONTHLY_QUOTA.pro;
		const emailA = 'ak2-lektorat@2542.example.com';
		const emailB = 'ak2-test@2542.example.com';
		const cookieA = await newUser(emailA);
		const cookieB = await newUser(emailB);
		await seedUsage(emailA, quota);
		await seedUsage(emailB, quota);
		const [first, second] = [await sharedProvider(), await sharedProvider()];

		// Erste Anfrage über dem Budget belegt das Fair-Use-Intervall, die zweite wird gedrosselt.
		assert.equal((await postLektorat(cookieA)).status, 200);
		assert.equal((await postTest(cookieB, first)).status, 200);
		const callsBefore = upstreamCalls;

		const expected = await postLektorat(cookieA);
		const actual = await postTest(cookieB, second);
		assert.equal(expected.status, 429, 'Vorbedingung: /lektorat drosselt');
		assert.equal(actual.status, expected.status);
		assert.equal(norm(await actual.json()), norm(await expected.json()));
		assert.ok(actual.headers.get('retry-after'), 'Retry-After gesetzt');
		assert.equal(upstreamCalls, callsBefore, 'Upstream bei Drossel nicht aufgerufen');
	});

	it('AK3: eigener Provider mit eigenem Key bucht nichts und wird nie vom Kontingent blockiert', async () => {
		const email = 'ak3@2542.example.com';
		const cookie = await newUser(email);
		const user = await User.findOne({ where: { email } });
		await seedUsage(email, AI_ASSIST_MONTHLY_QUOTA.pro);
		const ids: number[] = [];
		for (const name of ['eigen-1', 'eigen-2', 'eigen-3']) {
			ids.push(
				(
					await LlmProvider.create({
						name,
						endpoint: 'https://own.example.com/v1',
						apiKey: 'own-key',
						model: 'own-model',
						kind: 'custom',
						userId: user!.id,
					})
				).id,
			);
		}
		for (const id of ids) {
			const res = await postTest(cookie, id);
			assert.equal(res.status, 200, 'kein Kontingent-Fehler');
		}
		assert.equal(await countOf(email), AI_ASSIST_MONTHLY_QUOTA.pro, 'Zähler unverändert');
	});

	it('AK4: Vorab-Abbrüche (400, 404, ohne Key, ohne Modell) buchen nichts', async () => {
		const email = 'ak4@2542.example.com';
		const cookie = await newUser(email);
		const noKey = await sharedProvider({ apiKey: '' });
		const noModel = await sharedProvider({ model: '' });
		assert.equal((await postTest(cookie, 'abc')).status, 400);
		assert.equal((await postTest(cookie, 99999)).status, 404);
		const a = (await (await postTest(cookie, noKey)).json()) as { ok: boolean };
		const b = (await (await postTest(cookie, noModel)).json()) as { ok: boolean };
		assert.equal(a.ok, false);
		assert.equal(b.ok, false);
		assert.equal(upstreamCalls, 0, 'Vorbedingung: kein Upstream-Aufruf');
		assert.equal(await countOf(email), 0);
	});

	it('AK4: Cache-Treffer bucht nichts (nur der erste Aufruf zählt)', async () => {
		const email = 'ak4-cache@2542.example.com';
		const cookie = await newUser(email);
		const id = await sharedProvider();
		assert.equal((await postTest(cookie, id)).status, 200);
		assert.equal((await postTest(cookie, id)).status, 200);
		assert.equal(upstreamCalls, 1, 'Vorbedingung: zweiter Aufruf kam aus dem Cache');
		assert.equal(await countOf(email), 1);
	});

	it('AK5: zu schnelle Wiederholungen → 429 mit { message } und Retry-After; anderer Nutzer unberührt', async () => {
		const cookieA = await newUser('ak5-a@2542.example.com');
		const cookieB = await newUser('ak5-b@2542.example.com');
		const id = await sharedProvider();
		const savedEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production'; // Limiter greifen nur in Produktion (Muster rate-limit-scope.test.ts)
		try {
			let throttled: Response | undefined;
			let position = 0;
			for (let i = 1; i <= 12 && !throttled; i++) {
				const res = await postTest(cookieA, id);
				if (res.status === 429) {
					throttled = res;
					position = i;
				}
			}
			assert.ok(throttled, 'spätestens der 12. Aufruf wird gedrosselt');
			assert.ok(position > 1, 'der erste Aufruf bleibt frei');
			assert.ok(throttled.headers.get('retry-after'), 'Retry-After gesetzt');
			const body = (await throttled.json()) as { message?: string; code?: string };
			assert.match(body.message ?? '', /Zu viele Anfragen/);
			assert.notEqual(body.code, 'ai_throttled', 'Limiter-Antwort, nicht Kontingent-Drossel');
			assert.notEqual((await postTest(cookieB, id)).status, 429, 'anderer Nutzer nicht betroffen');
		} finally {
			process.env.NODE_ENV = savedEnv;
		}
	});
});
