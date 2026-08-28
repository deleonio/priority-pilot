import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AI_ENABLED_STORAGE_KEY,
	QUICK_CAPTURE_ENABLED_STORAGE_KEY,
	isQuickCaptureEffective,
	readAiPreferences,
	storeAiPreferences,
} from './aiPreferences';

/**
 * Rote Spec-Tests für #1080 — „Settings KI deaktivierbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Spezifikation: docs/spec/issue-1080.md
 *
 * Vertrag der Persistenz-Schicht (Muster `voiceAutostart.ts`): zwei **unabhängige** boolesche
 * Präferenzen in `localStorage`, beide Default **an** (= Status quo, damit bestehende e2e grün
 * bleiben), Best-Effort — ein fehlender, ungültiger oder gesperrter Storage liefert die Defaults
 * statt zu crashen. Die exakten Storage-Keys sind Teil des Vertrags, weil die e2e-Specs
 * (`ai-disable.spec.ts`) die Präferenz vor dem Seitenaufbau per `addInitScript` setzen.
 *
 * AK1/AK3: Existenz + Unabhängigkeit der beiden Einstellungen.
 * AK5: Persistenz (Roundtrip).
 */
describe('aiPreferences — readAiPreferences / storeAiPreferences', () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	// AK1/AK3: Defaults sind Status quo — ohne Eintrag sind beide Features aktiv.
	it('liefert für beide Präferenzen true als Default, wenn kein localStorage-Eintrag vorhanden ist', () => {
		expect(readAiPreferences()).toEqual({ aiEnabled: true, quickCaptureEnabled: true });
	});

	// Vertrag: exakte Storage-Keys (Mirror zu den e2e-Init-Scripts in ai-disable.spec.ts).
	it('nutzt die dokumentierten Storage-Keys', () => {
		expect(AI_ENABLED_STORAGE_KEY).toBe('pp-ai-enabled');
		expect(QUICK_CAPTURE_ENABLED_STORAGE_KEY).toBe('pp-quick-capture-enabled');
	});

	// AK5: Roundtrip — beide Werte unabhängig voneinander schreibbar und lesbar.
	it('speichert beide Präferenzen und liest sie unverändert zurück', () => {
		storeAiPreferences({ aiEnabled: false, quickCaptureEnabled: true });
		expect(readAiPreferences()).toEqual({ aiEnabled: false, quickCaptureEnabled: true });

		storeAiPreferences({ aiEnabled: true, quickCaptureEnabled: false });
		expect(readAiPreferences()).toEqual({ aiEnabled: true, quickCaptureEnabled: false });
	});

	// AK5: Persistenzformat ist 'true'/'false' (e2e setzt genau diese Werte per Init-Script).
	it('schreibt die Werte als "true"/"false" in die dokumentierten Keys', () => {
		storeAiPreferences({ aiEnabled: false, quickCaptureEnabled: false });
		expect(localStorage.getItem(AI_ENABLED_STORAGE_KEY)).toBe('false');
		expect(localStorage.getItem(QUICK_CAPTURE_ENABLED_STORAGE_KEY)).toBe('false');
	});

	// AK5-Robustheit: ungültiger Wert → Default (true), kein Crash.
	it('fällt bei ungültigem gespeichertem Wert auf den Default true zurück', () => {
		localStorage.setItem(AI_ENABLED_STORAGE_KEY, 'invalid-value');
		localStorage.setItem(QUICK_CAPTURE_ENABLED_STORAGE_KEY, '1');
		expect(readAiPreferences()).toEqual({ aiEnabled: true, quickCaptureEnabled: true });
	});

	// AK5-Robustheit: gesperrter Storage → kein Crash, Defaults gelten.
	it('wirft nicht und liefert die Defaults, wenn localStorage beim Lesen nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readAiPreferences()).toEqual({ aiEnabled: true, quickCaptureEnabled: true });
	});

	it('wirft nicht, wenn localStorage beim Schreiben nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(() => storeAiPreferences({ aiEnabled: false, quickCaptureEnabled: false })).not.toThrow();
	});
});

/**
 * AK 2 aus #1085: die Schnellerfassung ist ein KI-Feature — bei deaktivierter KI wird die
 * gespeicherte Präferenz ignoriert. Die Wirklogik liegt in `aiPreferences.ts` (nicht in der
 * Konsumstelle), damit „gespeichert" und „wirksam" nicht auseinanderlaufen können.
 */
describe('aiPreferences — isQuickCaptureEffective (#1085)', () => {
	it.each([
		['beide an', { aiEnabled: true, quickCaptureEnabled: true }, true],
		['KI an, Schnellerfassung aus', { aiEnabled: true, quickCaptureEnabled: false }, false],
		['KI aus, Schnellerfassung an', { aiEnabled: false, quickCaptureEnabled: true }, false],
		['beide aus', { aiEnabled: false, quickCaptureEnabled: false }, false],
	])('%s → %s', (_name, preferences, expected) => {
		expect(isQuickCaptureEffective(preferences)).toBe(expected);
	});
});
