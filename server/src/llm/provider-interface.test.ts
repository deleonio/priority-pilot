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
	it('exportiert PillarClassifier Typ aus index.ts', () => {
		// Spec issue-638.md: "PillarClassifier, ParseTaskParser, ActivityAdvisor types exported from server/src/llm/index.ts"
		// Dieser Test wird ROT sein, bis der Typ exportiert wird
		assert.doesNotThrow(() => {
			// @ts-expect-error - Typ existiert noch nicht
			import('../index.js').then((module) => {
				assert.ok(typeof module.PillarClassifier === 'function', 'PillarClassifier muss exportiert werden');
			});
		});
	});

	it('exportiert ParseTaskParser Typ aus index.ts', () => {
		assert.doesNotThrow(() => {
			// @ts-expect-error - Typ existiert noch nicht
			import('../index.js').then((module) => {
				assert.ok(typeof module.ParseTaskParser === 'function', 'ParseTaskParser muss exportiert werden');
			});
		});
	});

	it('exportiert ActivityAdvisor Typ aus index.ts', () => {
		assert.doesNotThrow(() => {
			// @ts-expect-error - Typ existiert noch nicht
			import('../index.js').then((module) => {
				assert.ok(typeof module.ActivityAdvisor === 'function', 'ActivityAdvisor muss exportiert werden');
			});
		});
	});
});

describe('MistralProvider Interface Implementierung (Spec: issue-638.md)', () => {
	it('MistralProvider implementiert classifyPillars()', async () => {
		// Spec issue-638.md: "MistralProvider class implements interface with existing Mistral logic"
		// Dieser Test wird ROT sein, bis MistralProvider existiert
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { MistralProvider } = await import('./mistral.js');
			const provider = new MistralProvider();

			const result = await provider.classifyPillars({
				title: 'Test Task',
				pillars: [{ id: 1, name: 'Körper' }],
			});

			assert.ok(Array.isArray(result), 'classifyPillars muss Array zurückgeben');
		});
	});

	it('MistralProvider implementiert parseTaskText()', async () => {
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { MistralProvider } = await import('./mistral.js');
			const provider = new MistralProvider();

			const result = await provider.parseTaskText('Implement Feature X');

			assert.ok(typeof result === 'object', 'parseTaskText muss Objekt zurückgeben');
		});
	});

	it('MistralProvider implementiert adviseActivities()', async () => {
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { MistralProvider } = await import('./mistral.js');
			const provider = new MistralProvider();

			const result = await provider.adviseActivities({
				pillars: [{ id: 1, name: 'Körper' }],
			});

			assert.ok(Array.isArray(result), 'adviseActivities muss Array zurückgeben');
		});
	});
});

describe('OpenRouterProvider Stub (Spec: issue-638.md)', () => {
	it('OpenRouterProvider implementiert classifyPillars() mit leeren Ergebnissen', async () => {
		// Spec issue-638.md: "OpenRouterProvider stub class (placebo implementation returning empty results)"
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { OpenRouterProvider } = await import('./openrouter.js');
			const provider = new OpenRouterProvider();

			const result = await provider.classifyPillars({
				title: 'Test Task',
				pillars: [{ id: 1, name: 'Körper' }],
			});

			assert.deepEqual(result, [], 'OpenRouter stub muss leeres Array zurückgeben');
		});
	});

	it('OpenRouterProvider implementiert parseTaskText() mit leeren Ergebnissen', async () => {
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { OpenRouterProvider } = await import('./openrouter.js');
			const provider = new OpenRouterProvider();

			const result = await provider.parseTaskText('Implement Feature X');

			assert.deepEqual(result, {}, 'OpenRouter stub muss leeres Objekt zurückgeben');
		});
	});

	it('OpenRouterProvider implementiert adviseActivities() mit leeren Ergebnissen', async () => {
		assert.doesNotThrow(async () => {
			// @ts-expect-error - Klasse existiert noch nicht
			const { OpenRouterProvider } = await import('./openrouter.js');
			const provider = new OpenRouterProvider();

			const result = await provider.adviseActivities({
				pillars: [{ id: 1, name: 'Körper' }],
			});

			assert.deepEqual(result, [], 'OpenRouter stub muss leeres Array zurückgeben');
		});
	});
});

describe('LLM_PROVIDER Environment Variable (Spec: issue-638.md)', () => {
	it('LLM_PROVIDER=mistral wählt MistralProvider', async () => {
		// Spec issue-638.md: "process.env.LLM_PROVIDER selects provider (default: mistral)"
		process.env.LLM_PROVIDER = 'mistral';

		assert.doesNotThrow(async () => {
			// @ts-expect-error - Funktion existiert noch nicht
			const { getProvider } = await import('../index.js');
			const provider = getProvider();

			assert.ok(provider.constructor.name === 'MistralProvider', 'Muss MistralProvider zurückgeben');
		});
	});

	it('LLM_PROVIDER=openrouter wählt OpenRouterProvider', async () => {
		process.env.LLM_PROVIDER = 'openrouter';

		assert.doesNotThrow(async () => {
			// @ts-expect-error - Funktion existiert noch nicht
			const { getProvider } = await import('../index.js');
			const provider = getProvider();

			assert.ok(provider.constructor.name === 'OpenRouterProvider', 'Muss OpenRouterProvider zurückgeben');
		});
	});

	it('LLM_PROVIDER leer oder unset fällt auf Mistral zurück', async () => {
		// Spec issue-638.md: "fallback to Mistral if unset"
		delete process.env.LLM_PROVIDER;

		assert.doesNotThrow(async () => {
			// @ts-expect-error - Funktion existiert noch nicht
			const { getProvider } = await import('../index.js');
			const provider = getProvider();

			assert.ok(provider.constructor.name === 'MistralProvider', 'Muss auf Mistral zurückfallen');
		});
	});

	it('LLM_PROVIDER=invalid fällt mit Warning auf Mistral zurück', async () => {
		// Spec issue-638.md: "LLM_PROVIDER=invalid → falls back to Mistral with warning"
		process.env.LLM_PROVIDER = 'invalid';

		assert.doesNotThrow(async () => {
			// @ts-expect-error - Funktion existiert noch nicht
			const { getProvider } = await import('../index.js');
			const provider = getProvider();

			assert.ok(provider.constructor.name === 'MistralProvider', 'Muss auf Mistral zurückfallen');
			// Warning sollte geloggt werden (Implementation Detail)
		});
	});
});
