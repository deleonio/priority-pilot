/**
 * Rote Spec-Tests für Issue #1459 (Spec docs/spec/issue-1459.md, T4) — KI-Kontingent-Metering.
 * Rot, bis `server/src/models/aiUsage.ts` (Modell `AiUsage`) und die Zähler-Middleware
 * `server/src/express/aiQuotaMeter.ts` existieren — beide fehlen heute komplett.
 *
 * Deckt AK1, AK4, AK6, AK7, AK8 je an allen fünf LLM-Routen ab (Muster: `plan-gating.test.ts`,
 * `GATED_CASES`). AK2 steht in `logics/plans.test.ts`, AK3 in `ai-quota-concurrency.test.ts`, AK5
 * in `ai-quota-coverage.test.ts`, AK9 in `plan-gating.test.ts`.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User, Pillar } from '../models/index.js';
import sequelize from '../database.js';
import { AI_ASSIST_MONTHLY_QUOTA } from '../logics/plans.js';
import { MissingApiKeyError } from '../llm/llm.js';
import type { ParseTaskParser, ParseSearchParser, PillarClassifier, ActivityAdvisor } from '../llm/llm.js';

applyTestAuthEnv('ai-quota-test');

let server: TestServer;

// Austauschbare Fake-Provider — pro Test umgeschaltet (Muster `parseTasks.test.ts`).
let parseTextImpl: ParseTaskParser = async () => ({ title: 'Task' });
let parseSearchImpl: ParseSearchParser = async (text) => ({ text });
let classifierImpl: PillarClassifier = async () => [{ pillarId: 1, confidence: 80 }];
let advisorImpl: ActivityAdvisor = async () => [{ activity: 'Spaziergang', reason: 'Bewegung', pillarIds: [1] }];

const originalFetch = globalThis.fetch;
/** Mockt nur den Mistral-Endpoint (für /lektorat, das keine AppDeps-Injektion hat). */
const stubLektoratFetch = (ok: boolean): void => {
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		if (typeof url === 'string' && url.includes('api.mistral.ai')) {
			if (!ok) return new Response('Upstream-Fehler', { status: 500 });
			return new Response(
				JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: 'Lektoriert.' }) } }] }),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
		return originalFetch(url, init);
	}) as typeof fetch;
};

const setPlan = async (email: string, plan: 'free' | 'pro' | 'max' | 'ultimate'): Promise<void> => {
	await User.update({ plan }, { where: { email } });
};

const seedPillar = async (email: string): Promise<void> => {
	const user = await User.findOne({ where: { email } });
	await Pillar.create({ name: 'Gesundheit', description: 'Kurzbeschreibung', userId: user?.id });
};

interface RouteCase {
	label: string;
	needsPillar: boolean;
	setupSuccess: () => void;
	setupFailure: () => void;
	request: (baseUrl: string, cookie: string) => Promise<Response>;
}

const ROUTES: RouteCase[] = [
	{
		label: 'POST /tasks/parse-text',
		needsPillar: false,
		setupSuccess: () => {
			parseTextImpl = async () => ({ title: 'Task' });
		},
		setupFailure: () => {
			parseTextImpl = async () => {
				throw new MissingApiKeyError('Kein aktiver Provider konfiguriert.');
			};
		},
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/tasks/parse-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ text: 'Steuererklärung bis morgen' }),
			}),
	},
	{
		label: 'POST /tasks/parse-search',
		needsPillar: false,
		setupSuccess: () => {
			parseSearchImpl = async (text) => ({ text });
		},
		setupFailure: () => {
			parseSearchImpl = async () => {
				throw new MissingApiKeyError('Kein aktiver Provider konfiguriert.');
			};
		},
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/tasks/parse-search`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ text: 'Suche nach Steuer' }),
			}),
	},
	{
		label: 'POST /tasks/suggest-pillars',
		needsPillar: true,
		setupSuccess: () => {
			classifierImpl = async () => [{ pillarId: 1, confidence: 80 }];
		},
		setupFailure: () => {
			classifierImpl = async () => {
				throw new MissingApiKeyError('Kein aktiver Provider konfiguriert.');
			};
		},
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/tasks/suggest-pillars`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ title: 'Joggen gehen' }),
			}),
	},
	{
		label: 'POST /pillars/advisor',
		needsPillar: true,
		setupSuccess: () => {
			advisorImpl = async () => [{ activity: 'Spaziergang', reason: 'Bewegung', pillarIds: [1] }];
		},
		setupFailure: () => {
			advisorImpl = async () => {
				throw new MissingApiKeyError('Kein aktiver Provider konfiguriert.');
			};
		},
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/pillars/advisor`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({}),
			}),
	},
	{
		label: 'POST /lektorat',
		needsPillar: false,
		setupSuccess: () => stubLektoratFetch(true),
		setupFailure: () => stubLektoratFetch(false),
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/lektorat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ text: 'Text mit Tippfehlern.' }),
			}),
	},
];

const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

/**
 * Liest `ai_usage.count` über rohes SQL statt über einen Modell-Import: `server/src/models/aiUsage.ts`
 * existiert noch nicht, ein `import { AiUsage } from '../models/aiUsage.js'` würde den knip-Gate
 * (unresolved imports) schon beim Commit blocken. Die Tabelle fehlt ebenfalls — die Abfrage wirft
 * aktuell `SQLITE_ERROR: no such table: ai_usage`, der legitime Erstzustand für die neue Tabelle.
 */
const countOf = async (userId: number): Promise<number> => {
	const [rows] = await sequelize.query('SELECT count FROM ai_usage WHERE userId = ? AND yearMonth = ?', {
		replacements: [userId, currentYearMonth()],
	});
	return (rows as { count: number }[])[0]?.count ?? 0;
};

/** Legt testseitig eine `ai_usage`-Zeile mit vorbelegtem `count` an (rohes SQL, s. {@link countOf}). */
const seedUsage = async (userId: number, count: number): Promise<void> => {
	await sequelize.query(
		"INSERT INTO ai_usage (userId, yearMonth, count, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
		{ replacements: [userId, currentYearMonth(), count] },
	);
};

describe('KI-Kontingent-Metering (#1459)', () => {
	before(async () => {
		server = await startTestServer({
			taskTextParser: (text, provider, categories) => parseTextImpl(text, provider, categories),
			searchTextParser: (text, provider, categories) => parseSearchImpl(text, provider, categories),
			pillarClassifier: (input, provider) => classifierImpl(input, provider),
			activityAdvisor: (input, provider) => advisorImpl(input, provider),
		});
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		globalThis.fetch = originalFetch;
		if (server) await server.close();
		await closeDb();
	});

	describe('AK1 — erfolgreicher Aufruf erhöht den Monatszähler um 1', () => {
		for (const routeCase of ROUTES) {
			it(`${routeCase.label}: erhöht ai_usage.count um 1`, async () => {
				process.env.MONETIZATION_ENFORCED = 'true';
				const email = `ak1-${routeCase.label.replace(/\W+/g, '')}@example.com`;
				const cookie = await server.register(email);
				await setPlan(email, 'pro');
				if (routeCase.needsPillar) await seedPillar(email);
				routeCase.setupSuccess();
				const user = await User.findOne({ where: { email } });

				const before = await countOf(user!.id);
				const res = await routeCase.request(server.baseUrl, cookie);
				assert.ok(res.status < 300, `${routeCase.label} sollte erfolgreich sein, war ${res.status}`);
				const after = await countOf(user!.id);
				assert.equal(after, before + 1, `${routeCase.label} muss den Zähler um genau 1 erhöhen`);
			});
		}
	});

	describe('AK6 — erschöpftes Kontingent antwortet 429 quota_exhausted', () => {
		it('POST /tasks/parse-text: Kontingent 0 (Vorbelegung = Limit) → 429', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak6-exhausted@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			const user = await User.findOne({ where: { email } });
			await seedUsage(user!.id, AI_ASSIST_MONTHLY_QUOTA.pro);

			const res = await ROUTES[0].request(server.baseUrl, cookie);
			assert.equal(res.status, 429);
			const body = (await res.json()) as { code?: string; feature?: string; currentPlan?: string };
			assert.equal(body.code, 'quota_exhausted');
			assert.equal(body.feature, 'ai_assist');
			assert.equal(body.currentPlan, 'pro');
			assert.equal(await countOf(user!.id), AI_ASSIST_MONTHLY_QUOTA.pro, 'Zähler darf am Deckel nicht weiter steigen');
		});
	});

	describe('AK4 — gescheiterter Provider-Call bucht das Kontingent zurück', () => {
		for (const routeCase of [ROUTES[0], ROUTES[4]]) {
			it(`${routeCase.label}: Provider-Fehler (>=500) lässt den Zähler unverändert`, async () => {
				process.env.MONETIZATION_ENFORCED = 'true';
				const email = `ak4-${routeCase.label.replace(/\W+/g, '')}@example.com`;
				const cookie = await server.register(email);
				await setPlan(email, 'pro');
				const user = await User.findOne({ where: { email } });
				routeCase.setupFailure();

				const before = await countOf(user!.id);
				const res = await routeCase.request(server.baseUrl, cookie);
				assert.ok(res.status >= 500, `${routeCase.label} sollte einen Serverfehler liefern, war ${res.status}`);
				assert.equal(await countOf(user!.id), before, `${routeCase.label} darf bei Provider-Fehler nicht zählen`);
			});
		}

		it('POST /tasks/parse-text: 400 aus der Eingabevalidierung zählt nicht', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak4-validation@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			const user = await User.findOne({ where: { email } });

			const before = await countOf(user!.id);
			const res = await fetch(`${server.baseUrl}/tasks/parse-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ text: '' }),
			});
			assert.equal(res.status, 400);
			assert.equal(await countOf(user!.id), before, 'ungültige Eingaben dürfen kein Kontingent verbrauchen');
		});
	});

	describe('AK7 — Erfolgsantwort trägt quotaRemaining', () => {
		it('POST /tasks/parse-text: quotaRemaining = Kontingent minus Verbrauch nach diesem Aufruf', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak7-quota-remaining@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			parseTextImpl = async () => ({ title: 'Task' });

			const res = await ROUTES[0].request(server.baseUrl, cookie);
			assert.equal(res.status, 200);
			const body = (await res.json()) as { quotaRemaining?: number };
			assert.equal(body.quotaRemaining, AI_ASSIST_MONTHLY_QUOTA.pro - 1);
		});
	});

	describe('AK8 — Rollout-Schalter aus: kein 429, Zähler läuft trotzdem weiter', () => {
		it('POST /tasks/parse-text: Kontingent bereits überschritten, MONETIZATION_ENFORCED nicht gesetzt → 2xx', async () => {
			// Bewusst kein MONETIZATION_ENFORCED gesetzt (Default laut plans.ts).
			const email = 'ak8-unenforced@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			const user = await User.findOne({ where: { email } });
			await seedUsage(user!.id, AI_ASSIST_MONTHLY_QUOTA.pro + 5);
			parseTextImpl = async () => ({ title: 'Task' });

			const res = await ROUTES[0].request(server.baseUrl, cookie);
			assert.ok(res.status < 300, `ohne Rollout darf es kein 429 geben, war ${res.status}`);
			assert.equal(
				await countOf(user!.id),
				AI_ASSIST_MONTHLY_QUOTA.pro + 6,
				'Zähler zählt auch über dem Kontingent weiter',
			);
		});
	});
});
