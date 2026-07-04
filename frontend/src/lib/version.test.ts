import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';

/**
 * Rote Spec-Tests (#290): APP_VERSION aus dem version-Modul.
 * Rot bis version.ts existiert und APP_VERSION exportiert.
 * In Vitest wird __APP_VERSION__ über vitest.config.ts define auf '0.0.0-test' gesetzt.
 */
describe('APP_VERSION — Build-Zeit-Injektion (#290)', () => {
	it('AK3: APP_VERSION ist ein nicht-leerer String', () => {
		expect(typeof APP_VERSION).toBe('string');
		expect(APP_VERSION.length).toBeGreaterThan(0);
	});

	it('AK3b: APP_VERSION entspricht dem Semver-Muster', () => {
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	it('AK3c: In der Testumgebung hat APP_VERSION den konfigurierten Testwert', () => {
		// vitest.config.ts setzt define: { __APP_VERSION__: '"0.0.0-test"' }
		// version.ts liest diesen Wert; der Test prüft damit, dass die Injektion funktioniert
		expect(APP_VERSION).toBe('0.0.0-test');
	});
});
