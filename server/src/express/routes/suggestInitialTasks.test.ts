/**
 * Rote Spec-Tests für Issue #2068 (Spec docs/spec/issue-2068.md) — `POST /tasks/suggest-initial`.
 * Rot, bis die Route in `server/src/express/routes/suggestInitialTasks.ts` existiert und über den
 * AppDeps-Slot `suggestInitialTasksParser` (Default: echter LLM-Call) in `express/index.ts`
 * registriert ist — bis dahin antwortet der Testserver 404, der legitime Erstzustand.
 *
 * Deckt AK1–AK4 ab (AK5 = openapi-Vertrag, läuft über `pnpm --filter server build`):
 * Muster `parseTasks.test.ts` (injizierbarer Parser, Austausch per Closure) und
 * `ai-quota.test.ts` (Plan-Guard/Quota-Auswertung).
 */
import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	applyTestAuthEnv,
	resetDb,
	closeDb,
	startTestServer,
	setTestLlmProvider,
	type TestServer,
} from '../../test/helpers.js';
import { Pillar, User, AiUsage } from '../../models/index.js';
import { AI_ASSIST_MONTHLY_QUOTA } from '../../logics/plans.js';

applyTestAuthEnv('test-2068-suggest-initial');

/** Vorschlag des Suggesters — spiegelt den künftigen LLM-Rückgabetyp (llm.ts, Impl-Phase). */
interface SuggestedTask {
	title: string;
	pillarId: number;
	/** Index eines anderen Vorschlags derselben Antwort, den dieser voraussetzt. */
	dependsOn?: number;
}

/** Säule, so wie die Route sie dem Suggester vorlegt (Muster `CategoryOption`). */
interface PillarOption {
	id: number;
	name: string;
}

/** Signatur des Suggesters — spiegelt den künftigen `AppDeps`-Eintrag `suggestInitialTasksParser`. */
type SuggestInitialTasksParser = (
	text: string,
	provider: string | undefined,
	pillars: PillarOption[],
	userId: number,
) => Promise<SuggestedTask[]>;

let suggesterImpl: SuggestInitialTasksParser;

const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

const countOf = async (userId: number): Promise<number> => {
	const usage = await AiUsage.findOne({ where: { userId, yearMonth: currentYearMonth() } });
	return usage?.count ?? 0;
};

const seedPillar = async (email: string, name: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	const pillar = await Pillar.create({ name, userId: user?.id });
	return pillar.id;
};

const setPlan = async (email: string, plan: 'free' | 'plus' | 'pro'): Promise<void> => {
	await User.update({ plan }, { where: { email } });
};

const post = (baseUrl: string, cookie: string, body: unknown, query = ''): Promise<Response> =>
	fetch(`${baseUrl}/tasks/suggest-initial${query}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify(body),
	});

describe('POST /tasks/suggest-initial (#2068)', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({
			suggestInitialTasksParser: (text, provider, pillars, userId) => suggesterImpl(text, provider, pillars, userId),
		} as unknown as Parameters<typeof startTestServer>[0]);
	});

	beforeEach(async () => {
		await resetDb();
		await setTestLlmProvider(true);
		delete process.env.MONETIZATION_ENFORCED;
		suggesterImpl = async (_text, _provider, pillars) =>
			pillars.map((pillar) => ({ title: `Aufgabe für ${pillar.name}`, pillarId: pillar.id }));
	});

	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	describe('AK1 — 200 mit 5–8 gültigen Vorschlägen', () => {
		it('200 und jede Säulen-/Abhängigkeits-Referenz ist gültig', async () => {
			const email = 'ak1@example.com';
			// login statt register: /auth/register sägt fünf Standard-Säulen (#421, auth.ts:82) — der
			// Test braucht einen Nutzer, dessen Säulen exakt die geseedeten sind (Test-Pflege, PR-Body).
			const cookie = await server.login(email);
			const healthId = await seedPillar(email, 'Gesundheit');
			const workId = await seedPillar(email, 'Beruf');
			// Sechs gültige Vorschläge (im 5–8-Band), einer mit gültigem dependsOn.
			suggesterImpl = async (_text, _provider, pillars) => {
				const [first, second] = pillars;
				return [
					{ title: 'Erste Wahl', pillarId: first.id },
					{ title: 'Hängt ab', pillarId: first.id, dependsOn: 0 },
					{ title: 'Zweite Säule', pillarId: second.id },
					{ title: 'Auch zweite Säule', pillarId: second.id },
					{ title: 'Rückverweis', pillarId: second.id, dependsOn: 2 },
					{ title: 'Letzter', pillarId: first.id },
				];
			};

			const res = await post(server.baseUrl, cookie, { text: 'Ich muss einziehen und mich um Papierkram kümmern' });
			assert.equal(res.status, 200);
			const body = (await res.json()) as { suggestions: SuggestedTask[] };
			assert.ok(
				body.suggestions.length >= 5 && body.suggestions.length <= 8,
				`5–8 Vorschläge erwartet, waren ${body.suggestions.length}`,
			);
			const validIds = new Set([healthId, workId]);
			body.suggestions.forEach((suggestion, index) => {
				assert.equal(typeof suggestion.title, 'string', 'title muss ein String sein');
				assert.ok(suggestion.title.trim().length > 0, 'title darf nicht leer sein');
				assert.ok(validIds.has(suggestion.pillarId), `pillarId ${suggestion.pillarId} gehört nicht zum Nutzer`);
				if (suggestion.dependsOn !== undefined) {
					assert.ok(
						Number.isInteger(suggestion.dependsOn) &&
							suggestion.dependsOn >= 0 &&
							suggestion.dependsOn < body.suggestions.length &&
							suggestion.dependsOn !== index,
						`dependsOn ${suggestion.dependsOn} an Index ${index} ist ungültig`,
					);
				}
			});
		});
	});

	describe('AK2 — ungültige Einträge werden verworfen', () => {
		it('nur die gültigen Vorschläge kommen durch (Titel, Säule, dependsOn geprüft)', async () => {
			const email = 'ak2@example.com';
			// login statt register — s. Begründung AK1 (Standard-Säulen-Seeding, #421).
			const cookie = await server.login(email);
			const healthId = await seedPillar(email, 'Gesundheit');
			const workId = await seedPillar(email, 'Beruf');
			suggesterImpl = async (_text, _provider, pillars) => {
				const [first, second] = pillars;
				return [
					{ title: 'Gültig 1', pillarId: first.id },
					{ title: 'Fremde Säule', pillarId: 99999 }, // unbekannte pillarId → raus
					{ title: '   ', pillarId: first.id }, // leerer Titel → raus
					{ title: 'Selbstverweis', pillarId: second.id, dependsOn: 4 }, // eigener Index → raus
					{ title: 'Aus dem Rahmen', pillarId: second.id, dependsOn: 99 }, // außerhalb → raus
					{ title: 'Gültig 2', pillarId: second.id, dependsOn: 0 }, // gültiger Verweis → bleibt
					{ title: 'Gültig 3', pillarId: first.id },
					{ title: 'Gültig 4', pillarId: second.id },
					{ title: 'Gültig 5', pillarId: first.id },
					{ title: 'Gültig 6', pillarId: second.id },
				];
			};

			const res = await post(server.baseUrl, cookie, { text: 'Erststart organisieren' });
			assert.equal(res.status, 200);
			const body = (await res.json()) as { suggestions: SuggestedTask[] };
			const titles = body.suggestions.map((s) => s.title).sort();
			assert.deepEqual(
				titles,
				['Gültig 1', 'Gültig 2', 'Gültig 3', 'Gültig 4', 'Gültig 5', 'Gültig 6'],
				'es dürfen nur die sechs gültigen Vorschläge übrig bleiben',
			);
			const validIds = new Set([healthId, workId]);
			body.suggestions.forEach((suggestion) => {
				assert.ok(validIds.has(suggestion.pillarId), 'keine fremde pillarId darf durchkommen');
				assert.ok(
					suggestion.dependsOn === undefined || (suggestion.dependsOn >= 0 && suggestion.dependsOn <= 5),
					'nur gültige dependsOn-Indizes dürfen durchkommen',
				);
			});
		});
	});

	describe('AK3 — Plan-Guard, Kontingent, Metering', () => {
		it('Free mit MONETIZATION_ENFORCED=true → 403 plan_required', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak3-free@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'free');
			await seedPillar(email, 'Gesundheit');

			const res = await post(server.baseUrl, cookie, { text: 'Wochenende planen' });
			assert.equal(res.status, 403, 'Free-Nutzer müssen mit 403 abgewiesen werden');
			const body = (await res.json()) as { code?: string };
			assert.equal(body.code, 'plan_required');
		});

		it('Kontingent erschöpft: erste Anfrage über Budget wird gebucht, nächste im Intervall → 429', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak3-quota@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			const user = await User.findOne({ where: { email } });
			await AiUsage.create({ userId: user!.id, yearMonth: currentYearMonth(), count: AI_ASSIST_MONTHLY_QUOTA.pro });
			await seedPillar(email, 'Gesundheit');

			const first = await post(server.baseUrl, cookie, { text: 'Erster Aufruf über Budget' });
			assert.ok(first.status < 300, `erste Anfrage über Budget darf noch durch (Fair Use), war ${first.status}`);
			assert.equal(await countOf(user!.id), AI_ASSIST_MONTHLY_QUOTA.pro + 1, 'auch über Budget wird gebucht');

			const second = await post(server.baseUrl, cookie, { text: 'Zweiter Aufruf im Drosselintervall' });
			assert.equal(second.status, 429, 'die nächste Anfrage im Drosselintervall muss 429 liefern');
			const body = (await second.json()) as { code?: string };
			assert.equal(body.code, 'ai_throttled');
		});

		it('erfolgreicher Aufruf zählt genau 1 auf ai_usage', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak3-meter@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'pro');
			await seedPillar(email, 'Gesundheit');
			const user = await User.findOne({ where: { email } });

			const res = await post(server.baseUrl, cookie, { text: 'Steuererklärung angehen' });
			assert.equal(res.status, 200);
			assert.equal(await countOf(user!.id), 1, 'ein erfolgreicher Aufruf muss genau 1 zählen');
		});
	});

	describe('AK4 — Eingabe- und Kontext-Fehler', () => {
		it('leerer Body {} → 400', async () => {
			const cookie = await server.register('ak4-empty@example.com');
			const res = await post(server.baseUrl, cookie, {});
			assert.equal(res.status, 400);
		});

		it('Whitespace-Text → 400', async () => {
			const cookie = await server.register('ak4-ws@example.com');
			const res = await post(server.baseUrl, cookie, { text: '   ' });
			assert.equal(res.status, 400);
		});

		it('2001 Zeichen → 400', async () => {
			const cookie = await server.register('ak4-long@example.com');
			const res = await post(server.baseUrl, cookie, { text: 'a'.repeat(2001) });
			assert.equal(res.status, 400);
		});

		it('unbekannter provider-Query → 400', async () => {
			const cookie = await server.register('ak4-provider@example.com');
			await seedPillar('ak4-provider@example.com', 'Gesundheit');
			const res = await post(server.baseUrl, cookie, { text: 'Aufräumen' }, '?provider=foo');
			assert.equal(res.status, 400);
		});

		it('Nutzer ohne Säulen → 503', async () => {
			// login statt register: register sägt Standard-Säulen (#421) — nur der Test-Login-Nutzer
			// hat wirklich keine (Muster suggest-pillars.test.ts AK4).
			const cookie = await server.login('ak4-nopillars@example.com');
			const res = await post(server.baseUrl, cookie, { text: 'Aufräumen' });
			assert.equal(res.status, 503);
		});
	});
});
