import { describe, it, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { parseTaskTextWithMistral, MissingApiKeyError } from './llm.js';
import { activateProvider, createProvider, listProviders } from './llmProviders.js';

/**
 * Vertrag der Provider-Auflösung im LLM-Aufruf: genau EIN Call an den effektiv aktiven
 * Provider — explizite Radio-Wahl (Custom oder Built-in) oder Built-in-Fallback
 * (Mistral vor OpenRouter, nach ENV-Key-Präsenz). Built-ins lösen Endpoint/Key/Modell
 * zur Laufzeit aus den ENV-Variablen auf, Custom-Provider aus der DB-Zeile.
 */

const ENV_KEYS = [
	'MISTRAL_API_KEY',
	'OPENROUTER_API_KEY',
	'MISTRAL_MODEL',
	'OPENROUTER_MODEL',
	'OPENROUTER_API_URL',
] as const;

describe('LLM-Aufrufe mit aktivem Provider', () => {
	const envBackup: Record<string, string | undefined> = {};

	before(() => {
		for (const key of ENV_KEYS) {
			envBackup[key] = process.env[key];
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

	beforeEach(async () => {
		for (const key of ENV_KEYS) {
			delete process.env[key];
		}
		await sequelize.sync({ force: true });
	});

	/** Mockt global fetch; zeichnet URL + Authorization-Header + Body auf. */
	const mockFetch = (): { calls: { url: string; auth: string; model: string }[] } => {
		const calls: { url: string; auth: string; model: string }[] = [];
		mock.method(globalThis, 'fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({
				url: String(input),
				auth: String((init?.headers as Record<string, string>)?.Authorization ?? ''),
				model: String(JSON.parse(String(init?.body ?? '{}')).model ?? ''),
			});
			return {
				ok: true,
				status: 200,
				json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Test' }) } }] }),
			};
		}) as typeof fetch);
		return { calls };
	};

	it('aktiver Custom-Provider: genau ein Call an dessen Endpoint mit DB-Key', async () => {
		const { id } = await createProvider({
			name: 'z.ai',
			endpoint: 'https://api.z.ai/v1',
			apiKey: 'db-key',
			model: 'glm-4.7',
		});
		await activateProvider(id);
		const { calls } = mockFetch();

		const result = await parseTaskTextWithMistral('test');
		assert.equal(result.title, 'Test');
		assert.equal(calls.length, 1, 'Single-Provider: genau ein Call');
		assert.equal(calls[0]?.url, 'https://api.z.ai/v1/chat/completions', 'Basis-URL + /chat/completions');
		assert.equal(calls[0]?.auth, 'Bearer db-key');
		assert.equal(calls[0]?.model, 'glm-4.7', 'Gewähltes Modell wird gesendet');
	});

	it('Legacy-Zeile mit vollständiger Chat-URL wird für den Call unverändert verwendet', async () => {
		await sequelize.query(
			'INSERT INTO llm_providers (name, endpoint, api_key, model, is_active, kind, "createdAt", "updatedAt") ' +
				"VALUES ('Alt', 'https://old.example.com/v1/chat/completions', 'legacy-key', 'm1', 1, 'custom', datetime('now'), datetime('now'))",
		);
		const { calls } = mockFetch();

		await parseTaskTextWithMistral('test');
		assert.equal(calls[0]?.url, 'https://old.example.com/v1/chat/completions', 'Vollständige URL bleibt erhalten');
	});

	it('Fallback ohne Custom-Wahl: Mistral aus ENV (Key, Default-Modell, Endpoint)', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const { calls } = mockFetch();

		await parseTaskTextWithMistral('test');
		assert.equal(calls.length, 1);
		assert.equal(calls[0]?.url, 'https://api.mistral.ai/v1/chat/completions');
		assert.equal(calls[0]?.auth, 'Bearer env-mistral-key');
		assert.equal(calls[0]?.model, 'mistral-medium-latest', 'Code-Default-Modell ohne Wahl');
	});

	it('Fallback nur mit OpenRouter-Key: OpenRouter-Endpoint und ENV-Modell', async () => {
		process.env.OPENROUTER_API_KEY = 'env-or-key';
		process.env.OPENROUTER_MODEL = 'vendor/model-x';
		const { calls } = mockFetch();

		await parseTaskTextWithMistral('test');
		assert.equal(calls[0]?.url, 'https://openrouter.ai/api/v1/chat/completions');
		assert.equal(calls[0]?.auth, 'Bearer env-or-key');
		assert.equal(calls[0]?.model, 'vendor/model-x', 'ENV-Modell schlägt Code-Default');
	});

	it('explizit aktivierter Built-in gewinnt über den Fallback; gewähltes Modell persistiert', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key'; // wäre der Fallback
		const openrouter = (await listProviders()).find((p) => p.name === 'OpenRouter');
		assert.ok(openrouter);
		await activateProvider(openrouter.id);
		process.env.OPENROUTER_API_KEY = 'env-or-key';
		const { calls } = mockFetch();

		await parseTaskTextWithMistral('test');
		assert.match(calls[0]?.url ?? '', /openrouter\.ai/, 'Explizite Wahl schlägt Mistral-Fallback');
	});

	it('Custom-Provider ohne Modell (Legacy-Zeile) → MissingApiKeyError, kein Call', async () => {
		// Per API nicht mehr erzeugbar (Modell ist Pflicht) — Legacy-Zeile direkt in die DB.
		await sequelize.query(
			'INSERT INTO llm_providers (name, endpoint, api_key, model, is_active, kind, "createdAt", "updatedAt") ' +
				"VALUES ('Keyless', 'https://x.example.com/v1', 'k', '', 1, 'custom', datetime('now'), datetime('now'))",
		);
		const fetchMock = mock.method(globalThis, 'fetch', (async () => {
			throw new Error('darf nicht aufgerufen werden');
		}) as typeof fetch);

		await assert.rejects(() => parseTaskTextWithMistral('test'), MissingApiKeyError);
		assert.equal(fetchMock.mock.callCount(), 0);
	});

	it('kein Provider konfiguriert (kein ENV-Key, keine Wahl) → MissingApiKeyError', async () => {
		await assert.rejects(() => parseTaskTextWithMistral('test'), MissingApiKeyError);
	});

	it('Provider-Pinning per Name bleibt erhalten (Custom und Built-in)', async () => {
		await createProvider({
			name: 'z.ai',
			endpoint: 'https://api.z.ai/v1',
			apiKey: 'db-key',
			model: 'glm-4.7',
		});
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		const { calls } = mockFetch();

		const result = await parseTaskTextWithMistral('test', 'z.ai');
		assert.equal(result.title, 'Test');
		assert.match(calls[0]?.url ?? '', /api\.z\.ai/, 'Gepinnter Custom-Provider wird genutzt');
	});
});
