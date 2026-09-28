import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BALANCE_HINT_DISMISS_KEY,
	BALANCE_PRIORITY_STORAGE_KEY,
	dismissBalanceHint,
	isBalanceHintDismissed,
	readBalancePreferences,
	storeBalancePreferences,
} from './balancePreferences';

/**
 * Rote Spec-Tests für #1792 — Balance-Priorisierung als Standard (AK1) und Einmal-Hinweis-Flag
 * (AK4).
 *
 * Spezifikation: docs/spec/issue-1792.md
 *
 * Vertrag: genau eine boolesche Präferenz `balancePriority` in `localStorage`
 * (Key `pp-balance-priority`, Default **an** = neue Standardsortierung) plus das Dismiss-Flag des
 * Einmal-Hinweises (Key `pp-balance-hint-dismissed`, Default **aus**). Best-Effort wie
 * `aiPreferences.ts`: ein fehlender, ungültiger oder gesperrter Storage liefert den Default statt
 * zu crashen.
 *
 * Provenienz: als rote Spec-Tests entstanden (Spec-Commit `e22e212e`) — der damalige rote
 * Import-Fehler war der legitime erste Rot-Zustand, kein kaputter Test.
 */
describe('balancePreferences — Präferenz (#1792 AK1)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('liefert ohne gespeicherten Wert den Default an', () => {
		expect(readBalancePreferences()).toEqual({ balancePriority: true });
	});

	it('nutzt die dokumentierten Storage-Keys', () => {
		expect(BALANCE_PRIORITY_STORAGE_KEY).toBe('pp-balance-priority');
		expect(BALANCE_HINT_DISMISS_KEY).toBe('pp-balance-hint-dismissed');
	});

	it('speichert balancePriority und liest beide Werte unverändert zurück', () => {
		storeBalancePreferences({ balancePriority: false });
		expect(readBalancePreferences()).toEqual({ balancePriority: false });

		storeBalancePreferences({ balancePriority: true });
		expect(readBalancePreferences()).toEqual({ balancePriority: true });
	});

	it('schreibt den Wert als "true"/"false" in den dokumentierten Key', () => {
		storeBalancePreferences({ balancePriority: false });
		expect(localStorage.getItem(BALANCE_PRIORITY_STORAGE_KEY)).toBe('false');
	});

	it('fällt bei ungültigem gespeichertem Wert auf den Default an zurück', () => {
		localStorage.setItem(BALANCE_PRIORITY_STORAGE_KEY, 'vielleicht');
		expect(readBalancePreferences()).toEqual({ balancePriority: true });
	});

	it('übersteht einen gesperrten localStorage in beide Richtungen, ohne zu werfen', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		expect(readBalancePreferences()).toEqual({ balancePriority: true });
		expect(() => storeBalancePreferences({ balancePriority: false })).not.toThrow();
	});
});

describe('balancePreferences — Einmal-Hinweis-Flag (#1792 AK4)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('liefert ohne Dismiss-Flag false — der Hinweis darf erscheinen', () => {
		expect(isBalanceHintDismissed()).toBe(false);
	});

	it('liefert nach dismissBalanceHint dauerhaft true (Roundtrip über den dokumentierten Key)', () => {
		dismissBalanceHint();
		expect(isBalanceHintDismissed()).toBe(true);
		expect(localStorage.getItem(BALANCE_HINT_DISMISS_KEY)).toBe('true');

		// Persistenz, nicht Session-State: erneut Lesen liefert weiter true.
		expect(isBalanceHintDismissed()).toBe(true);
	});

	it('interpretiert einen ungültigen Dismiss-Wert als nicht entlassen', () => {
		localStorage.setItem(BALANCE_HINT_DISMISS_KEY, 'weg');
		expect(isBalanceHintDismissed()).toBe(false);
	});

	it('übersteht einen gesperrten localStorage, ohne zu werfen', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		expect(isBalanceHintDismissed()).toBe(false);
		expect(() => dismissBalanceHint()).not.toThrow();
	});
});
