import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredPreference, resolveTheme, STORAGE_KEY, storePreference } from './theme';

describe('resolveTheme', () => {
	it('folgt im System-Modus der OS-Einstellung', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});

	it('erzwingt bei expliziter Wahl unabhängig vom OS', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('readStoredPreference / storePreference', () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('liefert ohne gespeicherten Wert den Standard "system"', () => {
		expect(readStoredPreference()).toBe('system');
	});

	it('liest einen gültigen gespeicherten Wert', () => {
		storePreference('dark');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
		expect(readStoredPreference()).toBe('dark');
	});

	it('fällt bei ungültigem gespeichertem Wert auf "system" zurück', () => {
		localStorage.setItem(STORAGE_KEY, 'neon');
		expect(readStoredPreference()).toBe('system');
	});

	it('wirft nicht, wenn localStorage nicht verfügbar ist', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readStoredPreference()).toBe('system');
	});
});
