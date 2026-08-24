import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { parseTaskTextWithMistral, MissingApiKeyError } from './llm.js';

/**
 * Rote Spec-Tests für Issue #951 — Single-Provider-System: LLM-Aufrufe nutzen nur den aktiven Provider.
 * Spec: docs/spec/issue-951.md (Journey 6: LLM-Aufruf mit aktivem Provider).
 *
 * Diese Tests sind rot, bis `loadActiveProvider()` und die Logik für Single-Provider existieren:
 * Die Tabelle `llm_providers` gibt es noch nicht → der Seed im Setup schlägt fehl.
 */

describe('LLM-Aufrufe mit aktivem Provider (#951)', () => {
	const envBackup: Record<string, string | undefined> = {};

	before(() => {
		// Env-Keys deterministisch entfernen: Der Test soll ausschließlich über den
		// geseedeten aktiven Provider laufen, nicht über zufällig gesetzte CI-Env.
		for (const key of ['MISTRAL_API_KEY', 'OPENROUTER_API_KEY']) {
			envBackup[key] = process.env[key];
			delete process.env[key];
		}
	});

	after(() => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	/** Seedet einen aktiven Provider direkt in die neue Tabelle (raw SQL — Model folgt in der Impl-Phase). */
	const seedActiveProvider = async (): Promise<void> => {
		await sequelize.sync({ force: true });
		await sequelize.query(
			'INSERT INTO llm_providers (name, endpoint, api_key, model, is_active, "createdAt", "updatedAt") ' +
				"VALUES ('Mistral', 'https://api.mistral.ai/v1/chat/completions', 'seeded-key', 'mistral-medium-latest', 1, datetime('now'), datetime('now'))",
		);
	};

	it('aktiver Provider Mistral: parseTaskTextWithMistral ruft nur Mistral-Endpoint auf', async () => {
		await seedActiveProvider();

		// Mock global fetch
		let fetchCalls = 0;
		const endpoints: string[] = [];
		mock.method(globalThis, 'fetch', (async (input: RequestInfo | URL) => {
			fetchCalls++;
			endpoints.push(String(input));
			return {
				ok: true,
				status: 200,
				json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Test' }) } }] }),
			};
		}) as typeof fetch);

		const result = await parseTaskTextWithMistral('test');
		assert.equal(result.title, 'Test', 'Result muss korrekt geparsed werden');
		assert.equal(fetchCalls, 1, 'Single-Provider-System darf nur einen Provider aufrufen');
		assert.match(endpoints[0] ?? '', /mistral\.ai/, 'Der aktive Provider (Mistral) muss aufgerufen werden');
	});

	it('kein aktiver Provider konfiguriert → MissingApiKeyError', async () => {
		await sequelize.sync({ force: true });
		await assert.rejects(() => parseTaskTextWithMistral('test'), MissingApiKeyError);
	});

	it('Provider-Pinning Query-Parameter bleibt erhalten für Debugging', async () => {
		await sequelize.sync({ force: true });
		await sequelize.query(
			'INSERT INTO llm_providers (name, endpoint, api_key, model, is_active, "createdAt", "updatedAt") ' +
				"VALUES ('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', 'seeded-key', 'openrouter/free', 1, datetime('now'), datetime('now'))",
		);
		mock.method(globalThis, 'fetch', async () => ({
			ok: true,
			status: 200,
			json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Pinned' }) } }] }),
		}));

		const result = await parseTaskTextWithMistral('test', 'openrouter');
		// Aktuell funktioniert provider-Pinning schon, aber es ruft trotzdem Kaskade auf.
		// Das ist okay für diesen roten Test.
		assert.equal(result.title, 'Pinned');
	});
});
