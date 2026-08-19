import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import * as theme from './theme';

/**
 * Tests für die Theme-Logik aus theme.ts.
 *
 * Testen die localStorage-Persistenz, Theme-Auflösung und DOM-Manipulation
 * mit jsdom (simuliert Browser-Umgebung im Node-Kontext).
 */

describe('theme.ts', () => {
	let dom: JSDOM;
	let mockLocalStorage: Record<string, string>;

	beforeEach(() => {
		// Mock localStorage erstellen
		mockLocalStorage = {};

		// jsdom-Umgebung für DOM-Tests
		dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
			url: 'http://localhost',
		});

		// Mock für matchMedia (immer light für Tests)
		vi.spyOn(window, 'matchMedia').mockImplementation(
			(query: string) =>
				({
					matches: false, // Immer light
					media: query,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
					addListener: vi.fn(),
					removeListener: vi.fn(),
					onchange: null,
				}) as unknown as MediaQueryList,
		);

		// Mock localStorage
		const mockStorage = {
			getItem: (key: string) => mockLocalStorage[key] ?? null,
			setItem: (key: string, value: string) => {
				mockLocalStorage[key] = value;
			},
			removeItem: (key: string) => {
				delete mockLocalStorage[key];
			},
			clear: () => {
				mockLocalStorage = {};
			},
		};
		vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorage as unknown as Storage);
	});

	afterEach(() => {
		dom.window.close();
		vi.restoreAllMocks();
	});

	describe('getStoredTheme', () => {
		it('liefert "system" als Standard wenn kein Wert gespeichert ist', () => {
			expect(theme.getStoredTheme()).toBe('system');
		});

		it('liefert gespeicherten Wert wenn vorhanden', () => {
			mockLocalStorage['pp-theme'] = 'dark';
			expect(theme.getStoredTheme()).toBe('dark');
		});

		it('liefert "system" bei ungültigem gespeicherten Wert', () => {
			mockLocalStorage['pp-theme'] = 'invalid';
			expect(theme.getStoredTheme()).toBe('system');
		});
	});

	describe('storeTheme', () => {
		it('speichert Theme-Präferenz in localStorage', () => {
			theme.storeTheme('light');
			expect(mockLocalStorage['pp-theme']).toBe('light');
		});

		it('wirft keinen Fehler wenn localStorage nicht verfügbar', () => {
			// Mock localStorage mit TypeError werfen
			vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
				throw new TypeError('localStorage not available');
			});
			// Sollte keinen Fehler werfen
			expect(() => theme.storeTheme('dark')).not.toThrow();
		});
	});

	describe('resolveTheme', () => {
		it('liefert System-Theme bei Präferenz "system"', () => {
			expect(theme.resolveTheme('system', 'dark')).toBe('dark');
			expect(theme.resolveTheme('system', 'light')).toBe('light');
		});

		it('liefert gewähltes Theme bei Präferenz "light" oder "dark"', () => {
			expect(theme.resolveTheme('light', 'dark')).toBe('light');
			expect(theme.resolveTheme('dark', 'light')).toBe('dark');
		});
	});

	describe('getSystemTheme', () => {
		it('liefert "light" wenn keine Dunkel-Präferenz', () => {
			expect(theme.getSystemTheme()).toBe('light');
		});
	});

	describe('applyInitialTheme', () => {
		it('setzt data-theme immer auf "light"', () => {
			theme.applyInitialTheme();

			expect(document.documentElement.dataset.theme).toBe('light');
			expect(document.documentElement.style.colorScheme).toBe('light');
		});

		it('wirft keinen Fehler wenn DOM nicht verfügbar', () => {
			// Mock document.documentElement als undefined
			Object.defineProperty(document, 'documentElement', {
				get: () => undefined,
				configurable: true,
			});
			// Sollte keinen Fehler werfen
			expect(() => theme.applyInitialTheme()).not.toThrow();
		});
	});

	describe('THEME_LABELS und THEME_ORDER', () => {
		it('exportiert THEME_LABELS mit allen drei Optionen', () => {
			expect(theme.THEME_LABELS).toEqual({
				system: 'System',
				light: 'Hell',
				dark: 'Dunkel',
			});
		});

		it('exportiert THEME_ORDER mit allen drei Optionen', () => {
			expect(theme.THEME_ORDER).toEqual(['system', 'light', 'dark']);
		});
	});
});
