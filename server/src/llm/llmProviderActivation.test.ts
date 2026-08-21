import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskTextWithMistral, MissingApiKeyError } from './llm.js';

/**
 * Rote Spec-Tests für Issue #951 — Single-Provider-System: LLM-Aufrufe nutzen nur den aktiven Provider.
 * Spec: docs/spec/issue-951.md (Journey 6: LLM-Aufruf mit aktivem Provider).
 *
 * Diese Tests sind rot, bis `loadActiveProvider()` und die Logik für Single-Provider existieren.
 */

describe('LLM-Aufrufe mit aktivem Provider (#951)', () => {
	it('aktiver Provider Mistral: parseTaskTextWithMistral ruft nur Mistral-Endpoint auf', async () => {
		// Mock global fetch
		let fetchCalls = 0;
		mock.method(globalThis, 'fetch', async () => {
			fetchCalls++;
			return {
				ok: true,
				status: 200,
				json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Test' }) } }] }),
			};
		});

		// Dieser Test wird rot sein, weil parseTaskTextWithMistral noch die Kaskade verwendet
		// und zwei Aufrufe macht (Mistral + OpenRouter), nicht nur einen.
		const result = await parseTaskTextWithMistral('test');
		assert.equal(result.title, 'Test', 'Result muss korrekt geparsed werden');
		assert.equal(fetchCalls, 1, 'Single-Provider-System darf nur einen Provider aufrufen');
	});

	it('kein aktiver Provider konfiguriert → MissingApiKeyError', async () => {
		// Simuliert, dass kein Provider aktiv ist
		// Aktuell wird MissingApiKeyError geworfen, wenn kein Key vorhanden ist.
		// Mit neuem System: wenn kein aktiver Provider → MissingApiKeyError (oder besser MissingActiveProviderError?)
		await assert.rejects(() => parseTaskTextWithMistral('test'), MissingApiKeyError);
	});

	it('Provider-Pinning Query-Parameter bleibt erhalten für Debugging', async () => {
		// Der Query-Parameter `provider` (aus Issue #749) soll weiterhin funktionieren,
		// um einen Provider für diesen Aufruf zu überschreiben.
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
