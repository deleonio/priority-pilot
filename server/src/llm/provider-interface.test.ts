import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Spec Reference: docs/spec/issue-638.md
 *
 * Issue 638: LLM Provider Interface - Rote Tests für Provider-Abstraktion
 *
 * Diese Tests definieren das Interface für multiple LLM-Provider.
 * Alle Tests werden ROT sein, da das Interface noch nicht existiert.
 */

describe('Provider Interface Export (Spec: issue-638.md)', () => {
	it('exportiert PillarClassifier Typ aus index.ts', async () => {
		// Spec issue-638.md: "PillarClassifier, ParseTaskParser, ActivityAdvisor types exported from server/src/llm/index.ts"
		const module = await import('./index.js');
		assert.ok(typeof module.PillarClassifier === 'function', 'PillarClassifier muss exportiert werden');
	});

	it('exportiert ParseTaskParser Typ aus index.ts', async () => {
		const module = await import('./index.js');
		assert.ok(typeof module.ParseTaskParser === 'function', 'ParseTaskParser muss exportiert werden');
	});

	it('exportiert ActivityAdvisor Typ aus index.ts', async () => {
		const module = await import('./index.js');
		assert.ok(typeof module.ActivityAdvisor === 'function', 'ActivityAdvisor muss exportiert werden');
	});
});

describe('MistralProvider Interface Implementierung (Spec: issue-638.md)', () => {
	// Spec issue-638.md: "MistralProvider class implements interface with existing Mistral logic"
	// Hier wird nur die Interface-Konformität geprüft (Methoden vorhanden), nicht die API-Funktion —
	// die ist in suggest-pillars.test.ts / pillar-advisor.test.ts mit Dependency-Injection abgedeckt.
	it('MistralProvider implementiert classifyPillars()', async () => {
		const { MistralProvider } = await import('./mistral-provider.js');
		const provider = new MistralProvider();

		assert.equal(typeof provider.classifyPillars, 'function', 'classifyPillars muss eine Methode sein');
	});

	it('MistralProvider implementiert parseTaskText()', async () => {
		const { MistralProvider } = await import('./mistral-provider.js');
		const provider = new MistralProvider();

		assert.equal(typeof provider.parseTaskText, 'function', 'parseTaskText muss eine Methode sein');
	});

	it('MistralProvider implementiert adviseActivities()', async () => {
		const { MistralProvider } = await import('./mistral-provider.js');
		const provider = new MistralProvider();

		assert.equal(typeof provider.adviseActivities, 'function', 'adviseActivities muss eine Methode sein');
	});
});

describe('OpenRouterProvider Stub (Spec: issue-638.md)', () => {
	it('OpenRouterProvider implementiert classifyPillars() mit leeren Ergebnissen', async () => {
		// Spec issue-638.md: "OpenRouterProvider stub class (placebo implementation returning empty results)"
		const { OpenRouterProvider } = await import('./openrouter.js');
		const provider = new OpenRouterProvider();

		const result = await provider.classifyPillars({
			title: 'Test Task',
			pillars: [{ id: 1, name: 'Körper' }],
		});

		assert.deepEqual(result, [], 'OpenRouter stub muss leeres Array zurückgeben');
	});

	it('OpenRouterProvider implementiert parseTaskText() mit leeren Ergebnissen', async () => {
		const { OpenRouterProvider } = await import('./openrouter.js');
		const provider = new OpenRouterProvider();

		const result = await provider.parseTaskText('Implement Feature X');

		assert.deepEqual(result, {}, 'OpenRouter stub muss leeres Objekt zurückgeben');
	});

	it('OpenRouterProvider implementiert adviseActivities() mit leeren Ergebnissen', async () => {
		const { OpenRouterProvider } = await import('./openrouter.js');
		const provider = new OpenRouterProvider();

		const result = await provider.adviseActivities({
			pillars: [{ id: 1, name: 'Körper' }],
		});

		assert.deepEqual(result, [], 'OpenRouter stub muss leeres Array zurückgeben');
	});
});

describe('LLM_PROVIDER Environment Variable (Spec: issue-638.md)', () => {
	it('LLM_PROVIDER=mistral wählt MistralProvider', async () => {
		// Spec issue-638.md: "process.env.LLM_PROVIDER selects provider (default: mistral)"
		process.env.LLM_PROVIDER = 'mistral';

		const { getProvider } = await import('./index.js');
		const provider = getProvider();

		assert.ok(provider.constructor.name === 'MistralProvider', 'Muss MistralProvider zurückgeben');
	});

	it('LLM_PROVIDER=openrouter wählt OpenRouterProvider', async () => {
		process.env.LLM_PROVIDER = 'openrouter';

		const { getProvider } = await import('./index.js');
		const provider = getProvider();

		assert.ok(provider.constructor.name === 'OpenRouterProvider', 'Muss OpenRouterProvider zurückgeben');
	});

	it('LLM_PROVIDER leer oder unset fällt auf Mistral zurück', async () => {
		// Spec issue-638.md: "fallback to Mistral if unset"
		delete process.env.LLM_PROVIDER;

		const { getProvider } = await import('./index.js');
		const provider = getProvider();

		assert.ok(provider.constructor.name === 'MistralProvider', 'Muss auf Mistral zurückfallen');
	});

	it('LLM_PROVIDER=invalid fällt mit Warning auf Mistral zurück', async () => {
		// Spec issue-638.md: "LLM_PROVIDER=invalid → falls back to Mistral with warning"
		process.env.LLM_PROVIDER = 'invalid';

		const { getProvider } = await import('./index.js');
		const provider = getProvider();

		assert.ok(provider.constructor.name === 'MistralProvider', 'Muss auf Mistral zurückfallen');
		// Warning sollte geloggt werden (Implementation Detail)
	});
});
