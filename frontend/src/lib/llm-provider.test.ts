import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	getProvider,
	setProvider,
	setToastCallback,
	isExclusiveProviderActive,
	resetProvider,
	type ActiveLlmProvider,
} from './llm-provider';

/**
 * Tests für das dynamische Provider-State-Management (#951, Fortführung von #749):
 * Der Provider ist ein Objekt aus `GET /llm-providers` — die festen Strings
 * 'mistral' | 'openrouter' sind Legacy. DTO-Form wie in der OpenAPI-Spec.
 */

const mistral: ActiveLlmProvider = {
	id: 1,
	name: 'Mistral',
	endpoint: 'https://api.mistral.ai/v1/chat/completions',
	model: 'mistral-medium-latest',
};

const openrouter: ActiveLlmProvider = {
	id: 2,
	name: 'OpenRouter',
	endpoint: 'https://openrouter.ai/api/v1/chat/completions',
	model: 'openrouter/free',
};

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

	describe('Provider Selection – Spec: Issue-951 Journey (Radio-Button-Auswahl)', () => {
		it('defaultet auf System-Standard (undefined)', () => {
			expect(getProvider()).toBeUndefined();
		});

		it('setzt einen dynamischen Provider (Objekt) und liest ihn zurück', () => {
			expect(setProvider(mistral)).toBe(true);
			expect(getProvider()).toEqual(mistral);
		});

		it('erzwingt Exklusivität — ein neuer Provider ersetzt den alten', () => {
			setProvider(mistral);
			setProvider(openrouter);
			expect(getProvider()).toEqual(openrouter);
		});

		it('löst Toast-Feedback beim Wechsel aus (Name im Toast)', () => {
			let toastTriggered = false;
			let toastMessage = '';
			setToastCallback((msg) => {
				toastTriggered = true;
				toastMessage = msg;
			});
			setProvider(mistral); // zuerst Mistral setzen
			setProvider(openrouter); // dann Wechsel auf OpenRouter
			expect(toastTriggered).toBe(true);
			expect(toastMessage).toContain('OpenRouter');
		});

		it('kein Toast beim Setzen desselben Providers erneut', () => {
			let calls = 0;
			setToastCallback(() => {
				calls += 1;
			});
			setProvider(mistral); // erster Set → Toast
			setProvider({ ...mistral }); // gleicher Name → kein Toast
			expect(calls).toBe(1);
		});
	});

	describe('Persistence – Spec: Issue-749 Journey Step 4 (unverändert)', () => {
		it('hält die Auswahl über get-Aufrufe (localStorage)', () => {
			setProvider(mistral);
			expect(getProvider()).toEqual(mistral);
		});

		it('fällt ohne Auswahl auf System-Standard zurück', () => {
			resetProvider();
			expect(getProvider()).toBeUndefined();
		});
	});

	describe('Error Handling – Spec: Issue-749 Randfälle (adaptiert auf Objekte)', () => {
		it('lehnt ungültige Werte ab (false, kein Crash, State unverändert)', () => {
			expect(setProvider('mistral' as unknown as ActiveLlmProvider)).toBe(false);
			expect(getProvider()).toBeUndefined();
		});

		it('Exklusivitäts-Check bleibt true (Single-Auswahl per Konstruktion)', () => {
			setProvider(mistral);
			expect(isExclusiveProviderActive()).toBe(true);
		});

		it('bereinigt Legacy-String-Bestände aus #749 beim Lesen', () => {
			localStorage.setItem('llm-provider-selection', 'mistral');
			expect(getProvider()).toBeUndefined();
			expect(localStorage.getItem('llm-provider-selection')).toBeNull();
		});
	});
});
