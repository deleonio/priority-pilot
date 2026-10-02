import { afterEach, describe, expect, it } from 'vitest';
import { EXPERT_MODE_STORAGE_KEY, readExpertMode, storeExpertMode } from './expertMode';

/**
 * Rote Spec-Tests für #1984 — AK3: Expertenmodus-Präferenz im localStorage (`pp-expert-mode`).
 *
 * Spezifikation: `docs/spec/issue-1984.md`. Vertrag (noch nicht implementiert, Muster
 * `aiPreferences.ts`): `EXPERT_MODE_STORAGE_KEY`, `readExpertMode` (Default **aus**, ungültiger
 * Wert fällt auf den Default zurück, gesperrter Storage crasht nicht) und `storeExpertMode`
 * (Best-Effort). Rot, solange das Modul fehlt (missing module = legitimer erster Rot-Zustand
 * für neue Funktionalität).
 */

afterEach(() => {
	localStorage.removeItem(EXPERT_MODE_STORAGE_KEY);
});

describe('expertMode — Expertenmodus-Präferenz (#1984 AK3)', () => {
	it('AK3: ohne localStorage-Eintrag ist der Expertenmodus aus (Default)', () => {
		expect(readExpertMode().expertMode).toBe(false);
	});

	it('AK3: Roundtrip — speichern und lesen liefert true und false zurück', () => {
		storeExpertMode({ expertMode: true });
		expect(readExpertMode().expertMode).toBe(true);

		storeExpertMode({ expertMode: false });
		expect(readExpertMode().expertMode).toBe(false);
		expect(localStorage.getItem(EXPERT_MODE_STORAGE_KEY)).toBe('false');
	});

	it('AK3: ungültiger Wert fällt auf den Default aus zurück', () => {
		localStorage.setItem(EXPERT_MODE_STORAGE_KEY, 'yes');
		expect(readExpertMode().expertMode).toBe(false);
	});
});
