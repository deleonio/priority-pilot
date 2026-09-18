import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as headerPosition from './headerPosition';

/**
 * Spec-Tests für #1428 „Kopfzeilen-Position (Oben/Unten)" — TF1 (AK1/AK3).
 *
 * Vertrag (Muster `theme.ts`, localStorage-Key `pp-header-position`):
 * - Default ist `top`, wenn nichts gespeichert ist.
 * - Gespeicherte Wahl (`top`|`bottom`) wird zurückgeliefert (Roundtrip).
 * - Ungültige gespeicherte Werte fallen auf `top` zurück.
 * - Speichern wirft nicht, wenn localStorage nicht verfügbar ist.
 *
 * Rot-Zustand: Das Modul `headerPosition.ts` existiert noch nicht (neue
 * Funktionalität) — die Tests werden erst mit der Impl-Phase grün.
 */

describe('headerPosition.ts', () => {
	let mockLocalStorage: Record<string, string>;

	beforeEach(() => {
		mockLocalStorage = {};
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
		vi.restoreAllMocks();
	});

	describe('getStoredHeaderPosition', () => {
		it('liefert "top" als Standard, wenn kein Wert gespeichert ist (AK1)', () => {
			expect(headerPosition.getStoredHeaderPosition()).toBe('top');
		});

		it('liefert gespeicherten Wert "bottom" zurück (AK3, Roundtrip in)', () => {
			mockLocalStorage['pp-header-position'] = 'bottom';
			expect(headerPosition.getStoredHeaderPosition()).toBe('bottom');
		});

		it('liefert "top" bei ungültigem gespeicherten Wert', () => {
			mockLocalStorage['pp-header-position'] = 'side';
			expect(headerPosition.getStoredHeaderPosition()).toBe('top');
		});
	});

	describe('storeHeaderPosition', () => {
		it('speichert die Präferenz unter dem Key "pp-header-position" (AK3, Roundtrip out)', () => {
			headerPosition.storeHeaderPosition('bottom');
			expect(mockLocalStorage['pp-header-position']).toBe('bottom');
		});

		it('wirft keinen Fehler, wenn localStorage nicht verfügbar ist', () => {
			vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
				throw new TypeError('localStorage not available');
			});
			expect(() => headerPosition.storeHeaderPosition('top')).not.toThrow();
		});
	});
});
