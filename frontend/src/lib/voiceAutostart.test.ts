import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readVoiceAutostartPreference, STORAGE_KEY, storeVoiceAutostartPreference } from './voiceAutostart';

/**
 * Rote Spec-Tests für #272 — „Allgemein-Einstellung: Auto-Sprachaufnahme im ersten Eingabefeld"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * AK1: Persistenz — gespeicherter Wert wird nach Reload korrekt wiederhergestellt.
 * AK2: Default aus — kein localStorage-Eintrag → false.
 * AK6: Robustheit — localStorage nicht verfügbar → kein Crash, false als Fallback.
 */

describe('voiceAutostart — readVoiceAutostartPreference / storeVoiceAutostartPreference', () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	// AK2: Default ist false (aus) — kein Eintrag in localStorage
	it('AK2: liefert false als Default, wenn kein localStorage-Eintrag vorhanden ist', () => {
		expect(readVoiceAutostartPreference()).toBe(false);
	});

	// AK1: gespeicherter Wert wird korrekt zurückgelesen
	it('AK1a: liest einen gespeicherten true-Wert korrekt zurück', () => {
		storeVoiceAutostartPreference(true);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
		expect(readVoiceAutostartPreference()).toBe(true);
	});

	it('AK1b: liest einen gespeicherten false-Wert korrekt zurück', () => {
		storeVoiceAutostartPreference(false);
		expect(readVoiceAutostartPreference()).toBe(false);
	});

	// AK1c: ungültiger gespeicherter Wert → Fallback false
	it('AK1c: fällt bei ungültigem gespeichertem Wert auf false zurück', () => {
		localStorage.setItem(STORAGE_KEY, 'invalid-value');
		expect(readVoiceAutostartPreference()).toBe(false);
	});

	// AK6: localStorage nicht verfügbar → kein Crash, false als Fallback
	it('AK6a: wirft nicht und liefert false, wenn localStorage beim Lesen nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readVoiceAutostartPreference()).toBe(false);
	});

	it('AK6b: wirft nicht, wenn localStorage beim Schreiben nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(() => storeVoiceAutostartPreference(true)).not.toThrow();
	});
});
