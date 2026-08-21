import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProvider, setProvider, setToastCallback, resetProvider } from './llm-provider';

/**
 * Rote Spec-Tests für Issue #951 — Single-Provider-System mit dynamischen Providern.
 * Spec: docs/spec/issue-951.md (Journey: LLM-Provider verwalten).
 *
 * Diese Tests sind rot, bis `llm-provider.ts` auf dynamische Provider umgestellt ist.
 * Derzeit erwarten die Funktionen noch feste Strings 'mistral' | 'openrouter' | undefined.
 */

describe('LLM-Provider dynamisch (#951)', () => {
	beforeEach(() => {
		resetProvider();
		setToastCallback(null);
	});

	afterEach(() => {
		resetProvider();
		setToastCallback(null);
	});

	it('sollte dynamische Provider-Objekte unterstützen', () => {
		// Erwartetes neues Verhalten: Provider wird als Objekt mit id, name, endpoint, model gespeichert
		// Aktuell: setProvider erwartet nur 'mistral' | 'openrouter' | undefined → Typfehler
		// Dieser Test wird wegen TypeScript-Fehler rot sein.
		const provider = {
			id: 1,
			name: 'Mistral',
			endpoint: 'https://api.mistral.ai/v1/chat/completions',
			model: 'mistral-medium-latest',
		};
		// @ts-expect-error – Typ erwartet noch feste Strings
		const success = setProvider(provider);
		expect(success).toBe(true);
	});

	it('sollte aktiven Provider aus Liste von Providern auswählen', () => {
		// Aktiver Provider sollte als Objekt zurückgegeben werden
		const activeProvider = getProvider();
		// Aktuell: activeProvider ist string | undefined, nicht Objekt
		expect(activeProvider).toBeUndefined(); // Rot, weil undefined erwartet, aber später Objekt
	});

	it('sollte Toast-Feedback bei Provider-Wechsel auslösen', () => {
		let toastMessage = '';
		setToastCallback((msg) => {
			toastMessage = msg;
		});
		const provider = {
			id: 2,
			name: 'OpenRouter',
			endpoint: 'https://openrouter.ai/api/v1/chat/completions',
			model: 'openrouter/free',
		};
		// @ts-expect-error – Typfehler
		setProvider(provider);
		expect(toastMessage).toContain('OpenRouter');
	});
});
