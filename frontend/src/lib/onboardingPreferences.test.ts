import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOnboardingDismissed, onboardingDismissKey, storeOnboardingDismissed } from './onboardingPreferences';

/**
 * Rote Spec-Tests für #2222 — „Später“ im Onboarding-Flow dauerhaft merken (AK4, AK5).
 *
 * Spezifikation: docs/spec/issue-2222.md. Der fehlende Modul-Import ist der legitime erste
 * Rot-Zustand (neue Funktionalität).
 */
describe('onboardingPreferences (#2222)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('speichert und liest das Flag; Standard ist „nicht verworfen“', () => {
		expect(isOnboardingDismissed(1)).toBe(false);
		storeOnboardingDismissed(1, true);
		expect(isOnboardingDismissed(1)).toBe(true);
		expect(localStorage.getItem(onboardingDismissKey(1))).toBe('true');
	});

	it('„Fortsetzen“ (false) löscht den Merker wieder', () => {
		storeOnboardingDismissed(1, true);
		storeOnboardingDismissed(1, false);
		expect(isOnboardingDismissed(1)).toBe(false);
		expect(localStorage.getItem(onboardingDismissKey(1))).toBeNull();
	});

	it('AK4: der Merker gilt je Nutzer — Nutzer 2 bleibt unberührt', () => {
		storeOnboardingDismissed(1, true);
		expect(isOnboardingDismissed(2)).toBe(false);
		expect(onboardingDismissKey(1)).not.toBe(onboardingDismissKey(2));
	});

	it('AK5: werfender localStorage — Lesen liefert false, Schreiben wirft nicht', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('gesperrt');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('voll');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new Error('gesperrt');
		});
		expect(isOnboardingDismissed(1)).toBe(false);
		expect(() => storeOnboardingDismissed(1, true)).not.toThrow();
		expect(() => storeOnboardingDismissed(1, false)).not.toThrow();
	});
});
