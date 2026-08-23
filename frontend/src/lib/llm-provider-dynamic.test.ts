import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProvider, setProvider, setToastCallback, resetProvider } from './llm-provider';

/**
 * Rote Spec-Tests für Issue #951 — Single-Provider-System mit dynamischen Providern.
 * Spec: docs/spec/issue-951.md (Journey: LLM-Provider verwalten).
 *
 * Diese Tests sind rot, bis `llm-provider.ts` auf dynamische Provider umgestellt ist.
 * Derzeit erwarten die Funktionen noch feste Strings 'mistral' | 'openrouter' | undefined.
 */

/** Ziel-API (#951): Provider als Objekt mit id, name, endpoint, model statt fester Strings. */
interface LlmProviderObject {
	id: number;
	name: string;
	endpoint: string;
	model: string;
}

/**
 * Intersection-Typ statt `@ts-expect-error`: Die Objekt-Signatur ist "optional dazu deklariert".
 * Jetzt lehnt das aktuelle `setProvider` das Objekt zur Laufzeit ab (→ false, Test rot);
 * nach der Umstellung passt der Typ, ohne dass die Impl-Phase diese Tests anfassen muss.
 */
type SetProviderDynamic = typeof setProvider & ((provider: LlmProviderObject) => boolean);
type GetProviderDynamic = typeof getProvider & (() => LlmProviderObject | undefined);

const setProviderDynamic = setProvider as SetProviderDynamic;
const getProviderDynamic = getProvider as GetProviderDynamic;

const mistralProvider: LlmProviderObject = {
	id: 1,
	name: 'Mistral',
	endpoint: 'https://api.mistral.ai/v1/chat/completions',
	model: 'mistral-medium-latest',
};

describe('LLM-Provider dynamisch (#951)', () => {
	beforeEach(() => {
		resetProvider();
		setToastCallback(null);
	});

	afterEach(() => {
		resetProvider();
		setToastCallback(null);
	});

	it('sollte dynamische Provider-Objekte akzeptieren', () => {
		const success = setProviderDynamic(mistralProvider);
		expect(success).toBe(true);
	});

	it('sollte den gesetzten Provider als Objekt aus getProvider() zurückgeben', () => {
		setProviderDynamic(mistralProvider);
		expect(getProviderDynamic()).toEqual(mistralProvider);
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
		setProviderDynamic(provider);
		expect(toastMessage).toContain('OpenRouter');
	});
});
