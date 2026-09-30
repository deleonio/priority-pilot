import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { EntitlementMap } from './planOffers';
import { PlanProvider } from './usePlan';
import {
	useAiFeaturesEnabled,
	useAiFeaturesGate,
	AI_ENABLED_STORAGE_KEY,
	computeAiFeaturesEnabled,
	readAiPreferences,
	storeAiPreferences,
} from './aiPreferences';

vi.mock('../api', () => ({ api: { listLlmProviders: vi.fn().mockResolvedValue([]) } }));

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

// ── #1525 (TF3, Spec docs/spec/issue-1525.md AK1/AK3/AK5) ──────────────────────────────────────

/**
 * Effektives KI-Gate: Präferenz UND Berechtigung `ai_assist` (#1903 AK7). Test-Pflege #1941 AK2:
 * der Custom-Provider-Eingang und `hasOwnCustomProvider` (#1549 AK8b) sind entfallen.
 *
 * Vertrag (Wahrheitstabelle):
 * - `preferenceEnabled: false` → immer `false` (AK3).
 * - `preferenceEnabled: true`, `entitlementAllowed: true` → `true`.
 * - `preferenceEnabled: true`, `entitlementAllowed: false` → `false` (AK1).
 * - `entitlementAllowed: undefined` (noch nicht geladen) → `false`, kein Aufblitzen (AK5).
 */
describe('aiPreferences — computeAiFeaturesEnabled (#1525 AK1/AK3/AK5)', () => {
	it.each<[boolean, boolean | undefined, boolean]>([
		// preferenceEnabled, entitlementAllowed, expected
		[false, true, false],
		[false, false, false],
		[false, undefined, false],
		[true, true, true],
		[true, false, false],
		[true, undefined, false],
	])('preferenceEnabled=%s x entitlementAllowed=%s → %s', (preferenceEnabled, entitlementAllowed, expected) => {
		expect(computeAiFeaturesEnabled({ preferenceEnabled, entitlementAllowed })).toBe(expected);
	});
});

// ── #1941 AK4: das Gate lädt keine Provider-Liste mehr ───────────────────────────────────────────
describe('aiPreferences — Gate ohne Provider-Request (#1941 AK4)', () => {
	afterEach(cleanup);

	const wrapper = ({ children }: { children: ReactNode }) => {
		const entitlements: EntitlementMap = {
			ai_assist: { allowed: true, requiredPlan: 'pro' } as EntitlementMap['ai_assist'],
		};
		return <PlanProvider value={{ plan: 'pro', entitlements }}>{children}</PlanProvider>;
	};

	// Ein Render beider Hooks: der Modul-Cache des alten Loaders würde sonst den zweiten Test maskieren.
	it('useAiFeaturesGate und useAiFeaturesEnabled rufen api.listLlmProviders nicht auf', () => {
		vi.mocked(api.listLlmProviders).mockClear();
		const { result } = renderHook(() => [useAiFeaturesGate(), useAiFeaturesEnabled()] as const, { wrapper });

		expect(result.current[0]).toBe(true);
		expect(api.listLlmProviders).toHaveBeenCalledTimes(0);
	});
});
