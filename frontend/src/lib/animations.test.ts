import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAnimationsEnabled, storeAnimationsEnabled } from './animations';

/**
 * Roter TDD-Vertrag für #1183 — Master-Schalter „Animationen" (Speicher-Ebene).
 *
 * Spezifikation: docs/spec/issue-1183.md (AK3 Default aus, AK1 Persistenz).
 * Das Modul frontend/src/lib/animations.ts existiert im Produktivcode noch nicht → RED
 * (Import scheitert zur Compile-Zeit). Muster: voiceAutostart.ts (#272).
 */

const KEY = 'pp-animations-enabled';

beforeEach(() => {
	localStorage.removeItem(KEY);
});

afterEach(() => {
	localStorage.removeItem(KEY);
});

describe('animations — localStorage-Vertrag (#1183 AK1/AK3)', () => {
	it('AK3: ohne gespeicherten Key gilt der Schalter als AUS (Default false)', () => {
		expect(localStorage.getItem(KEY)).toBeNull();
		expect(readAnimationsEnabled()).toBe(false);
	});

	it('AK1: gespeichertes true wird gelesen, false/ungültige Werte gelten als aus', () => {
		localStorage.setItem(KEY, 'true');
		expect(readAnimationsEnabled()).toBe(true);
		localStorage.setItem(KEY, 'false');
		expect(readAnimationsEnabled()).toBe(false);
		localStorage.setItem(KEY, 'ungueltig');
		expect(readAnimationsEnabled()).toBe(false);
	});

	it('AK1: storeAnimationsEnabled persistiert die Wahl als String', () => {
		storeAnimationsEnabled(true);
		expect(localStorage.getItem(KEY)).toBe('true');
		storeAnimationsEnabled(false);
		expect(localStorage.getItem(KEY)).toBe('false');
	});
});
