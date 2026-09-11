import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ENABLED_STORAGE_KEY, readAiPreferences, storeAiPreferences } from './aiPreferences';

/**
 * Rote Spec-Tests für #1335 — „Schnellerfassung und Berater verschmelzen" (AK4).
 *
 * Spezifikation: docs/spec/issue-1335.md
 *
 * Vertrag (ersetzt #1080/#1085): genau EINE boolesche Präferenz `aiEnabled` in `localStorage`
 * (Default **an** = Status quo), Best-Effort — ein fehlender, ungültiger oder gesperrter Storage
 * liefert den Default statt zu crashen. Der bisherige Feinschalter „Schnellerfassung aktiv" und der
 * Key `pp-quick-capture-enabled` entfallen ersatzlos (AK4) — `readAiPreferences`/`storeAiPreferences`
 * lesen/schreiben ihn nicht mehr.
 *
 * **Ersetzt:** Diese Datei ersetzt die #1080/#1085-Tests rund um `quickCaptureEnabled` /
 * `isQuickCaptureEffective` (Test-Pflege-Bedarf, siehe PR-Beschreibung) — sie widersprechen AK4.
 */
describe('aiPreferences — readAiPreferences / storeAiPreferences (#1335 AK4)', () => {
	const LEGACY_QUICK_CAPTURE_KEY = 'pp-quick-capture-enabled';

	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('liefert nur noch aiEnabled (Default true), wenn kein localStorage-Eintrag vorhanden ist', () => {
		expect(readAiPreferences()).toEqual({ aiEnabled: true });
	});

	it('nutzt den dokumentierten Storage-Key', () => {
		expect(AI_ENABLED_STORAGE_KEY).toBe('pp-ai-enabled');
	});

	it('speichert aiEnabled und liest es unverändert zurück', () => {
		storeAiPreferences({ aiEnabled: false } as unknown as Parameters<typeof storeAiPreferences>[0]);
		expect(readAiPreferences()).toEqual({ aiEnabled: false });

		storeAiPreferences({ aiEnabled: true } as unknown as Parameters<typeof storeAiPreferences>[0]);
		expect(readAiPreferences()).toEqual({ aiEnabled: true });
	});

	it('schreibt den Wert als "true"/"false" in den dokumentierten Key', () => {
		storeAiPreferences({ aiEnabled: false } as unknown as Parameters<typeof storeAiPreferences>[0]);
		expect(localStorage.getItem(AI_ENABLED_STORAGE_KEY)).toBe('false');
	});

	it('AK4: schreibt oder liest den Legacy-Key "pp-quick-capture-enabled" nicht mehr', () => {
		localStorage.setItem(LEGACY_QUICK_CAPTURE_KEY, 'true');

		storeAiPreferences({ aiEnabled: false } as unknown as Parameters<typeof storeAiPreferences>[0]);

		// storeAiPreferences fasst den Legacy-Key nicht an — sein vorheriger Wert bleibt unverändert.
		expect(localStorage.getItem(LEGACY_QUICK_CAPTURE_KEY)).toBe('true');
		// readAiPreferences liest ihn nicht — das Ergebnis enthält keine quickCaptureEnabled-Eigenschaft.
		expect(readAiPreferences()).not.toHaveProperty('quickCaptureEnabled');
	});

	it('fällt bei ungültigem gespeichertem Wert auf den Default true zurück', () => {
		localStorage.setItem(AI_ENABLED_STORAGE_KEY, 'invalid-value');
		expect(readAiPreferences()).toEqual({ aiEnabled: true });
	});

	it('wirft nicht und liefert den Default, wenn localStorage beim Lesen nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readAiPreferences()).toEqual({ aiEnabled: true });
	});

	it('wirft nicht, wenn localStorage beim Schreiben nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(() =>
			storeAiPreferences({ aiEnabled: false } as unknown as Parameters<typeof storeAiPreferences>[0]),
		).not.toThrow();
	});
});
