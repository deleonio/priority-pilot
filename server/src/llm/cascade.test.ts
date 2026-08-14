import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskTextWithMistral, MissingApiKeyError, MistralRequestError } from './llm.js';

/**
 * Tests für die LLM-Kaskade: Mistral (Primär-Call) → OpenRouter (Verfeinerung/Zweitmeinung).
 * Fällt ein Provider aus, liefert der andere allein das Ergebnis. Fallen beide aus → 502.
 * Kein Key überhaupt → 503.
 *
 * Getestet wird über `parseTaskTextWithMistral` (einfachste Signatur) mit gemocktem `fetch`.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	mock.restoreAll();
});

type FetchResponse = { ok: true; content: unknown } | { ok: false; status?: number };

/**
 * Mockt `globalThis.fetch` mit einer festen Sequenz von Antworten — pro Call eine.
 * Zeichnet URL und Request-Body mit, damit Tests die Kaskaden-Reihenfolge verifizieren können.
 */
function mockFetchSequence(responses: FetchResponse[]) {
	let callIndex = 0;
	const calls: { url: string; body: unknown }[] = [];

	mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
		const body = init.body ? JSON.parse(init.body as string) : {};
		calls.push({ url, body });

		const resp = responses[callIndex++] ?? responses.at(-1);
		if (!resp.ok) {
			return { ok: false, status: resp.status ?? 500, json: async () => ({}) } as Response;
		}
		return {
			ok: true,
			status: 200,
			json: async () => ({ choices: [{ message: { content: JSON.stringify(resp.content) } }] }),
		} as Response;
	});

	return calls;
}

describe('LLM-Kaskade — Mistral → OpenRouter-Verfeinerung', () => {
	it('beide Keys: Mistral generiert, OpenRouter verfeinert', async () => {
		process.env.MISTRAL_API_KEY = 'm-key';
		process.env.OPENROUTER_API_KEY = 'or-key';

		const calls = mockFetchSequence([
			{ ok: true, content: { title: 'Mistral Ergebnis' } },
			{ ok: true, content: { title: 'Verfeinertes Ergebnis' } },
		]);

		const result = await parseTaskTextWithMistral(' teste');

		assert.equal(result.title, 'Verfeinertes Ergebnis');
		assert.equal(calls.length, 2, 'fetch muss 2× aufgerufen werden (Mistral + OpenRouter)');
		assert.equal(calls[0].url, 'https://api.mistral.ai/v1/chat/completions');
		assert.equal(calls[1].url, 'https://openrouter.ai/api/v1/chat/completions');

		// 2. Call muss Mistral's Antwort als assistant-Message enthalten.
		const orMessages = calls[1].body.messages as { role: string; content: string }[];
		const assistantMsg = orMessages.find((m) => m.role === 'assistant');
		assert.ok(assistantMsg, 'OpenRouter-Call muss assistant-Message mit Mistral Ergebnis enthalten');
		assert.ok(assistantMsg.content.includes('Mistral Ergebnis'));
	});

	it('Mistral failt → OpenRouter allein (Fallback)', async () => {
		process.env.MISTRAL_API_KEY = 'm-key';
		process.env.OPENROUTER_API_KEY = 'or-key';

		const calls = mockFetchSequence([
			{ ok: false, status: 500 },
			{ ok: true, content: { title: 'OpenRouter allein' } },
		]);

		const result = await parseTaskTextWithMistral('test');

		assert.equal(result.title, 'OpenRouter allein');
		assert.equal(calls.length, 2, 'fetch muss 2× aufgerufen werden');
		// 2. Call darf KEINE assistant-Message haben (kein Mistral-Ergebnis zum Verfeinern).
		const orMessages = calls[1].body.messages as { role: string }[];
		assert.ok(!orMessages.some((m) => m.role === 'assistant'), 'ohne Mistral-Ergebnis: keine assistant-Message');
	});

	it('OpenRouter failt → Mistral Ergebnis wird verwendet', async () => {
		process.env.MISTRAL_API_KEY = 'm-key';
		process.env.OPENROUTER_API_KEY = 'or-key';

		mockFetchSequence([
			{ ok: true, content: { title: 'Mistral Ergebnis' } },
			{ ok: false, status: 502 },
		]);

		const result = await parseTaskTextWithMistral('test');

		assert.equal(result.title, 'Mistral Ergebnis');
	});

	it('beide failen → MistralRequestError', async () => {
		process.env.MISTRAL_API_KEY = 'm-key';
		process.env.OPENROUTER_API_KEY = 'or-key';

		mockFetchSequence([
			{ ok: false, status: 500 },
			{ ok: false, status: 503 },
		]);

		await assert.rejects(() => parseTaskTextWithMistral('test'), MistralRequestError);
	});
});

describe('LLM-Kaskade — Single-Provider (nur ein Key)', () => {
	it('nur Mistral-Key → 1× fetch, Mistral-Endpoint', async () => {
		process.env.MISTRAL_API_KEY = 'm-key';
		delete process.env.OPENROUTER_API_KEY;

		const calls = mockFetchSequence([{ ok: true, content: { title: 'Mistral only' } }]);

		const result = await parseTaskTextWithMistral('test');

		assert.equal(result.title, 'Mistral only');
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, 'https://api.mistral.ai/v1/chat/completions');
	});

	it('nur OpenRouter-Key → 1× fetch, OpenRouter-Endpoint', async () => {
		delete process.env.MISTRAL_API_KEY;
		process.env.OPENROUTER_API_KEY = 'or-key';

		const calls = mockFetchSequence([{ ok: true, content: { title: 'OpenRouter only' } }]);

		const result = await parseTaskTextWithMistral('test');

		assert.equal(result.title, 'OpenRouter only');
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
	});

	it('kein Key → MissingApiKeyError', async () => {
		delete process.env.MISTRAL_API_KEY;
		delete process.env.OPENROUTER_API_KEY;

		await assert.rejects(() => parseTaskTextWithMistral('test'), MissingApiKeyError);
	});
});

describe('LLM-Kaskade — OpenRouter API-URL konfigurierbar (AK „konfigurierbare URL/Modell", #639)', () => {
	it('OPENROUTER_API_URL gesetzt → Request geht an konfigurierten Endpoint, nicht an den Standard-Endpoint', async () => {
		delete process.env.MISTRAL_API_KEY;
		process.env.OPENROUTER_API_KEY = 'or-key';
		process.env.OPENROUTER_API_URL = 'https://custom-gateway.example.com/v1';

		const calls = mockFetchSequence([{ ok: true, content: { title: 'Custom Gateway' } }]);

		const result = await parseTaskTextWithMistral('test');

		assert.equal(result.title, 'Custom Gateway');
		assert.equal(calls.length, 1);
		assert.equal(
			calls[0].url,
			'https://custom-gateway.example.com/v1/chat/completions',
			'OPENROUTER_API_URL muss den Endpoint bestimmen (docs/spec/issue-639.md)',
		);
	});
});
