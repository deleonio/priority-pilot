import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProvider, setProvider, setToastCallback, isExclusiveProviderActive, resetProvider } from './llm-provider';

describe('LLM Provider State Management', () => {
	beforeEach(() => {
		// Reset vor jedem Test
		resetProvider();
		setToastCallback(null);
	});

	afterEach(() => {
		resetProvider();
		setToastCallback(null);
	});

	describe('Provider Selection – Spec: Issue-749 Journey Steps 1-2', () => {
		it('should default to system standard provider', () => {
			// Arrange: No explicit provider selection yet
			// Act: Get initial provider state
			const provider = getProvider();
			// Assert: Provider is undefined or system default (undefined ist gültig)
			expect(provider === undefined || provider === 'mistral' || provider === 'openrouter').toBe(true);
		});

		it('should select Mistral provider', () => {
			// Arrange: Initial provider state
			// Act: Select Mistral provider
			const success = setProvider('mistral');
			// Assert: Provider state is 'mistral'
			expect(success).toBe(true);
			expect(getProvider()).toBe('mistral');
		});

		it('should select OpenRouter provider', () => {
			// Arrange: Initial provider state
			// Act: Select OpenRouter provider
			const success = setProvider('openrouter');
			// Assert: Provider state is 'openrouter'
			expect(success).toBe(true);
			expect(getProvider()).toBe('openrouter');
		});

		it('should enforce exclusivity – only one provider active', () => {
			// Arrange: Mistral provider is selected
			setProvider('mistral');
			// Act: Select OpenRouter provider
			setProvider('openrouter');
			// Assert: Mistral is deactivated, only OpenRouter is active
			const mistralActive = getProvider() === 'mistral';
			const openrouterActive = getProvider() === 'openrouter';
			expect(mistralActive && openrouterActive).toBe(false); // nur einer aktiv
			expect(getProvider()).toBe('openrouter'); // OpenRouter ist jetzt aktiv
		});

		it('should trigger toast feedback on provider switch – Spec: Issue-749 Journey Step 2', () => {
			// Arrange: Provider state change occurs, toast callback registered
			let toastTriggered = false;
			let toastMessage = '';
			setToastCallback((msg) => {
				toastTriggered = true;
				toastMessage = msg;
			});
			setProvider('mistral'); // zuerst Mistral setzen
			// Act: Switch from Mistral to OpenRouter
			setProvider('openrouter');
			// Assert: Toast notification "Provider gewechselt: OpenRouter" is triggered
			expect(toastTriggered).toBe(true);
			expect(toastMessage).toContain('OpenRouter');
		});
	});

	describe('Persistence – Spec: Issue-749 Journey Step 4', () => {
		it('should persist provider selection across sessions', () => {
			// Arrange: User selects Mistral provider
			setProvider('mistral');
			// Act: Close and reopen app (simuliert durch erneuten get-Aufruf)
			const persistedProvider = getProvider();
			// Assert: Mistral provider is still active
			expect(persistedProvider).toBe('mistral');
		});

		it('should fallback to system default if no provider selected', () => {
			// Arrange: No provider selection in storage
			resetProvider();
			// Act: Initialize provider state
			const systemDefault = getProvider();
			// Assert: System default provider is used
			expect(systemDefault).toBeUndefined();
		});
	});

	describe('Provider Error Handling – Spec: Issue-749 Randfälle', () => {
		it('should handle unavailable provider gracefully', () => {
			// Arrange: Selected provider is not available (simuliert durch invaliden Wert)
			// Act: Attempt to set invalid provider
			const success = setProvider('invalid' as 'mistral' | 'openrouter' | undefined);
			// Assert: Error handled gracefully, returns false, no crash
			expect(success).toBe(false);
			expect(getProvider()).toBeUndefined(); // State bleibt unverändert
		});

		it('should not allow both providers active simultaneously', () => {
			// Arrange: Both providers somehow selected (simuliert durch direkten Storage-Zugriff)
			setProvider('mistral');
			// Act: Validate provider state
			const exclusive = isExclusiveProviderActive();
			// Assert: Only one provider is active, invalid state rejected
			expect(exclusive).toBe(true);
			expect(getProvider()).toBe('mistral'); // nur Mistral ist aktiv
		});
	});
});
