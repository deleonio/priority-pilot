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
import sequelize from '../database.js';

/**
 * Rote Spec-Tests für #1548 (Spec docs/spec/issue-1548.md) — Auswahl-Endpunkt, Gate- und
 * Kontingent-Bypass für eigene Provider.
 *
 * AK3 (API): PUT/GET /llm-providers/selection persistieren die Auswahl pro Nutzer
 *   (heute rot: PUT läuft in die :id-Route → 400 „Provider-ID muss eine positive Ganzzahl sein").
 * AK4: Free-Nutzer mit ausgewähltem eigenem Provider bekommt auf /lektorat eine fachliche
 *   Antwort statt 403 plan_required; der LLM-Call geht an Endpoint + Key des eigenen Providers
 *   (heute rot: 403, noch bevor die Route den Provider auflöst).
 * AK5: Derselbe Aufruf bucht keinen Kontingentpunkt — kein 429 trotz Free-Limit 0, ai_usage
 *   vor/nach identisch (heute rot: 403).
 * AK7: Free-Nutzer mit angelegtem, aber NICHT ausgewähltem eigenem Provider → 403 plan_required
 *   an allen vier KI-Endpunkten (Vollmatrix free-ohne-Provider deckt plan-gating.test.ts AK2 ab).
 *
 * Der LLM-Upstream wird über einen fetch-Stub gefahren (Muster `ai-quota.test.ts`,
 * `stubLektoratFetch`) — so ist der GET /lektorat-Pfad inkl. echter Provider-Auflösung in
 * der Kaskade getroffen, ohne echten API-Call. KEIN Produktivcode.
 */

applyTestAuthEnv('llm-provider-per-user-test');

const OWN_ENDPOINT = 'https://own.example.com/v1';
const INSTANCE_ENDPOINT = 'https://api.mistral.ai/v1';

let server: TestServer;
const originalFetch = globalThis.fetch;
/** Zeichnet LLM-Calls auf: URL + Authorization-Header — Beleg, WELCHER Provider gegriffen hat. */
let llmCalls: { url: string; auth: string }[] = [];

const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

const aiUsageCount = async (userId: number): Promise<number> => {
	const [rows] = await sequelize.query('SELECT count FROM ai_usage WHERE userId = ? AND yearMonth = ?', {
		replacements: [userId, currentYearMonth()],
	});
	return (rows as { count: number }[])[0]?.count ?? 0;
};

const register = async (email: string): Promise<string> => server.register(email, 'password123');

const createOwnProvider = async (cookie: string, name = 'Eigener Provider'): Promise<number> => {
	const res = await fetch(`${server.baseUrl}/llm-providers`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name, endpoint: `${OWN_ENDPOINT}/chat/completions`, apiKey: 'own-key', model: 'own-model' }),
	});
	assert.equal(res.status, 201, 'Anlegen des eigenen Providers muss nach #1547 funktionieren');
	const body = (await res.json()) as { id: number };
	return body.id;
};

const putSelection = (cookie: string, providerId: number | null): Promise<Response> =>
	fetch(`${server.baseUrl}/llm-providers/selection`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ providerId }),
	});

const getSelection = (cookie: string): Promise<Response> =>
	fetch(`${server.baseUrl}/llm-providers/selection`, { headers: { Cookie: cookie } });

const postLektorat = (cookie: string): Promise<Response> =>
	fetch(`${server.baseUrl}/lektorat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ text: 'Text mit Tippfeln.' }),
	});

const AI_ENDPOINT_CASES: Array<[string, string, string]> = [
	['POST /tasks/parse-text', '/tasks/parse-text', JSON.stringify({ text: 'Steuererklärung bis morgen' })],
	['POST /tasks/parse-search', '/tasks/parse-search', JSON.stringify({ text: 'Suche Steuer' })],
	['POST /pillars/advisor', '/pillars/advisor', JSON.stringify({})],
	['POST /lektorat', '/lektorat', JSON.stringify({ text: 'Text mit Tippfeln.' })],
];

describe('Eigener LLM-Provider pro Nutzer (#1548)', () => {
	before(async () => {
		server = await startTestServer();
		// Stub nur für die zwei LLM-Endpoints (eigener + instanzweiter Provider); alles andere durchreichen.
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			if (typeof url === 'string' && (url.includes(OWN_ENDPOINT) || url.includes(INSTANCE_ENDPOINT))) {
				llmCalls.push({
					url,
					auth: String((init?.headers as Record<string, string>)?.Authorization ?? ''),
				});
				return new Response(
					JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: 'Lektoriert.' }) } }] }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				);
			}
			return originalFetch(url, init);
		}) as typeof fetch;
	});

	beforeEach(async () => {
		await resetDb();
		// Instanzweit aktiver Provider, damit der Fallback-Pfad real existiert (nicht der eigene Endpoint).
		await setTestLlmProvider(true);
		delete process.env.MONETIZATION_ENFORCED;
		llmCalls = [];
	});

	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		globalThis.fetch = originalFetch;
		if (server) await server.close();
		await closeDb();
	});

	describe('AK3 — Auswahl-Endpunkt', () => {
		it('PUT persistiert die Auswahl, GET liefert sie zurück; null hebt sie auf', async () => {
			const cookie = await register('selection@1548.example.com');
			const providerId = await createOwnProvider(cookie);

			const put = await putSelection(cookie, providerId);
			assert.equal(put.status, 200, `PUT /llm-providers/selection muss 200 liefern, war ${put.status}`);
			const got = await getSelection(cookie);
			assert.equal(got.status, 200);
			assert.deepEqual((await got.json()) as { providerId: number | null }, { providerId });

			const deselect = await putSelection(cookie, null);
			assert.equal(deselect.status, 200, 'Abwahl mit null muss erlaubt sein');
			assert.deepEqual((await (await getSelection(cookie)).json()) as { providerId: number | null }, {
				providerId: null,
			});
		});

		it('Fremde Provider-ID → 404 (Zugriffsmodell #1547)', async () => {
			const cookieOwner = await register('owner@1548.example.com');
			const providerId = await createOwnProvider(cookieOwner);
			const cookieIntruder = await register('intruder@1548.example.com');

			const res = await putSelection(cookieIntruder, providerId);
			assert.equal(res.status, 404, 'Auswahl eines fremden Providers muss wie eine unbekannte ID 404 liefern');
		});

		it('ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/llm-providers/selection`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ providerId: 1 }),
			});
			assert.equal(res.status, 401);
		});
	});

	describe('AK4 — Gate-Bypass mit eigenem Provider', () => {
		it('Free-Nutzer mit Auswahl: /lektorat antwortet fachlich, Call geht an den eigenen Provider', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const cookie = await register('bypass-free@1548.example.com');
			const providerId = await createOwnProvider(cookie);
			assert.equal((await putSelection(cookie, providerId)).status, 200);

			const res = await postLektorat(cookie);
			assert.equal(
				res.status,
				200,
				`Free mit eigenem Provider muss eine fachliche Antwort erhalten, war ${res.status}`,
			);
			const body = (await res.json()) as { text?: string; message?: string };
			assert.equal(body.text, 'Lektoriert.');
			assert.equal(llmCalls.length, 1, 'genau ein LLM-Call');
			assert.ok(llmCalls[0]?.url.includes(OWN_ENDPOINT), 'Call muss an den eigenen Endpoint gehen');
			assert.equal(llmCalls[0]?.auth, 'Bearer own-key', 'Call muss den API-Key des eigenen Providers verwenden');
		});
	});

	describe('AK5 — Kontingent-Bypass', () => {
		it('Free (Limit 0): kein 429, ai_usage-Zähler unverändert', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const cookie = await register('quota-free@1548.example.com');
			const providerId = await createOwnProvider(cookie);
			assert.equal((await putSelection(cookie, providerId)).status, 200);
			const [row] = (await sequelize.query('SELECT id FROM users WHERE email = ?', {
				replacements: ['quota-free@1548.example.com'],
			})) as { id: number }[];
			const userId = row.id;

			const before = await aiUsageCount(userId);
			const res = await postLektorat(cookie);
			assert.notEqual(res.status, 429, 'eigener Provider darf nie am Kontingent scheitern');
			assert.equal(res.status, 200);
			assert.equal(await aiUsageCount(userId), before, 'Aufruf über den eigenen Provider darf nicht gezählt werden');
		});
	});

	describe('AK7 — Free ohne wirksame Auswahl', () => {
		it('angelegter, aber nicht ausgewählter Provider: 403 plan_required an allen 4 KI-Endpunkten', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const cookie = await register('free-unselected@1548.example.com');
			await createOwnProvider(cookie); // besitzt Provider, hat aber nichts ausgewählt

			for (const [label, path, body] of AI_ENDPOINT_CASES) {
				const res = await fetch(`${server.baseUrl}${path}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Cookie: cookie },
					body,
				});
				assert.equal(res.status, 403, `${label} muss ohne Auswahl 403 liefern, war ${res.status}`);
				const error = (await res.json()) as { code?: string; feature?: string };
				assert.equal(error.code, 'plan_required', label);
				assert.equal(error.feature, 'ai_assist', label);
			}
		});
	});
});
