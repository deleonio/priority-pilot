import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { runProviderTest, type ProviderRuntime } from './llmProviders.js';

/**
 * Vertrag des Test-Prompt-Runners: er schickt EXAKT den Produktions-Request-Shape (Endpoint, Key,
 * Modell, JSON-Mode) und übersetzt das Upstream-Ergebnis in eine diagnostizierbare Antwort —
 * Erfolg mit Latenz/Antwort-Auszug, Fehler mit Status + vom Upstream gelieferter Ursache
 * (z. B. Mistral-402 „Check your subscription …“). Nie den Key.
 */

const runtime = (overrides: Partial<ProviderRuntime> = {}): ProviderRuntime => ({
	baseUrl: 'https://api.example.com/v1',
	chatEndpoint: 'https://api.example.com/v1/chat/completions',
	apiKey: 'test-key',
	model: 'some-model',
	label: 'Example',
	keySource: 'EXAMPLE_API_KEY',
	...overrides,
});

/** Mockt global fetch mit Status/Body und zeichnet den abgeschickten Body auf. */
const mockFetch = (
	status: number,
	body: unknown,
): { sent: { url: string; auth: string; body: Record<string, unknown> } } => {
	const sent = { url: '', auth: '', body: {} as Record<string, unknown> };
	mock.method(globalThis, 'fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
		sent.url = String(input);
		sent.auth = String((init?.headers as Record<string, string>)?.Authorization ?? '');
		sent.body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
		return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch);
	return { sent };
};

beforeEach(() => {
	mock.restoreAll();
});

describe('runProviderTest', () => {
	it('Erfolg: ok=true mit Modell, Latenz und gekürzter Antwort', async () => {
		const fetchMock = mockFetch(200, { choices: [{ message: { content: '{"ok": true}' } }] });

		const result = await runProviderTest(runtime());

		assert.equal(result.ok, true);
		assert.equal(result.model, 'some-model');
		assert.equal(typeof result.latencyMs, 'number');
		assert.equal(result.sample, '{"ok": true}');
		// Produktions-Shape: derselbe Endpoint, derselbe Key, JSON-Mode.
		assert.equal(fetchMock.sent.url, 'https://api.example.com/v1/chat/completions');
		assert.equal(fetchMock.sent.auth, 'Bearer test-key');
		assert.equal((fetchMock.sent.body.response_format as { type: string })?.type, 'json_object');
		assert.equal(fetchMock.sent.body.model, 'some-model');
	});

	it('HTTP 402 mit detail-Body: Ursache wird durchgereicht (Mistral-Abo-Fall)', async () => {
		mockFetch(402, { detail: 'Check your subscription on https://admin.mistral.ai/subscription' });

		const result = await runProviderTest(runtime({ label: 'Mistral' }));

		assert.equal(result.ok, false);
		assert.match(result.message ?? '', /HTTP 402.*Check your subscription/, 'Status UND Upstream-Ursache');
	});

	it('HTTP 401 mit error.message-Body (OpenAI-Form): Ursache wird durchgereicht', async () => {
		mockFetch(401, { error: { message: 'Invalid API key provided' } });

		const result = await runProviderTest(runtime());

		assert.equal(result.ok, false);
		assert.match(result.message ?? '', /Invalid API key provided/);
	});

	it('Netzwerkfehler: Ursache wird gemeldet, kein Throw', async () => {
		mock.method(globalThis, 'fetch', (async () => {
			throw new Error('fetch failed');
		}) as typeof fetch);

		const result = await runProviderTest(runtime({ label: 'z.ai' }));

		assert.equal(result.ok, false);
		assert.match(result.message ?? '', /z\.ai.*fetch failed/);
	});

	it('Antwort ohne choices-Inhalt: klarer Format-Fehler statt ok', async () => {
		mockFetch(200, { choices: [] });

		const result = await runProviderTest(runtime());

		assert.equal(result.ok, false);
		assert.match(result.message ?? '', /keine Modell-Ausgabe/);
	});
});
