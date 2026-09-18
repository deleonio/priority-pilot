import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AI_ENABLED_STORAGE_KEY,
	computeAiFeaturesEnabled,
	hasOwnCustomProvider,
	readAiPreferences,
	storeAiPreferences,
} from './aiPreferences';

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

// ── #1525 (TF3, Spec docs/spec/issue-1525.md AK1/AK3/AK4/AK5) ──────────────────────────────────

/**
 * Rote Spec-Tests für #1525 — effektives KI-Gate: Präferenz UND (Berechtigung `ai_assist` ODER
 * eigener Custom-Provider). `computeAiFeaturesEnabled` existiert noch nicht in `aiPreferences.ts`
 * (roter Import-Fehler bis zur Implementierung — echte neue Funktionalität, kein Bestandscode).
 *
 * Vertrag (Wahrheitstabelle):
 * - `preferenceEnabled: false` → immer `false`, unabhängig von Berechtigung/Custom-Provider (AK3).
 * - `preferenceEnabled: true`, `entitlementAllowed: true` → immer `true` (AK2).
 * - `preferenceEnabled: true`, `entitlementAllowed: false`, `hasCustomProvider: true` → `true` (AK4).
 * - `preferenceEnabled: true`, `entitlementAllowed: false`, `hasCustomProvider: false` → `false` (AK1).
 * - `preferenceEnabled: true`, `entitlementAllowed: undefined` (noch nicht geladen) → immer `false`,
 *   auch mit `hasCustomProvider: true` — sicherer Default, kein Aufblitzen (AK5).
 */
describe('aiPreferences — computeAiFeaturesEnabled (#1525 AK1/AK3/AK4/AK5)', () => {
	it.each<[boolean, boolean | undefined, boolean, boolean]>([
		// preferenceEnabled, entitlementAllowed, hasCustomProvider, expected
		[false, true, true, false],
		[false, true, false, false],
		[false, false, true, false],
		[false, false, false, false],
		[false, undefined, true, false],
		[false, undefined, false, false],
		[true, true, true, true],
		[true, true, false, true],
		[true, false, true, true],
		[true, false, false, false],
		[true, undefined, true, false],
		[true, undefined, false, false],
	])(
		'preferenceEnabled=%s x entitlementAllowed=%s x hasCustomProvider=%s → %s',
		(preferenceEnabled, entitlementAllowed, hasCustomProvider, expected) => {
			expect(computeAiFeaturesEnabled({ preferenceEnabled, entitlementAllowed, hasCustomProvider })).toBe(expected);
		},
	);
});

// ── #1549 (AK8b, Spec docs/spec/issue-1549.md) ─────────────────────────────────────────────────

/**
 * Rote Spec-Tests für #1549 — das KI-Gate zählt nur noch **eigene** Custom-Provider.
 *
 * `hasOwnCustomProvider` existiert noch nicht in `aiPreferences.ts` (roter Import-Fehler bis zur
 * Implementierung — echte neue Funktionalität). Vertrag: eine Provider-Liste (DTO von
 * `GET /llm-providers`, inkl. `own`) zählt genau dann als „hat eigenen Custom-Provider“, wenn
 * mindestens eine Zeile `kind === 'custom'` UND `own === true` ist. Instanzweite Customs
 * (`own: false`) öffnen das Free-Gate NICHT — der Server liefert dort 403 `plan_required`
 * (#1548 AK7), das Frontend darf das Gate nicht weiter fassen.
 */
describe('aiPreferences — hasOwnCustomProvider (#1549 AK8b)', () => {
	it.each([
		['leere Liste', [], false],
		['nur instanzweiter Custom', [{ kind: 'custom', own: false }], false],
		['nur Built-ins', [{ kind: 'builtin', own: false }], false],
		['Built-in mit own:true (erwartet nie real)', [{ kind: 'builtin', own: true }], false],
		['eigener Custom', [{ kind: 'custom', own: true }], true],
		[
			'instanzweiter + eigener Custom',
			[
				{ kind: 'custom', own: false },
				{ kind: 'custom', own: true },
			],
			true,
		],
		['fehlendes own-Feld zählt nicht als eigen', [{ kind: 'custom' }], false],
	])(' %s → %s', (_name, providers, expected) => {
		expect(hasOwnCustomProvider(providers as never[])).toBe(expected);
	});

	it('AK8b: Free (kein ai_assist) + nur instanzweite Customs → KI-Schalter aus', () => {
		const instanceWideOnly = [
			{ kind: 'builtin', own: false },
			{ kind: 'custom', own: false },
		];
		expect(
			computeAiFeaturesEnabled({
				preferenceEnabled: true,
				entitlementAllowed: false,
				hasCustomProvider: hasOwnCustomProvider(instanceWideOnly as never[]),
			}),
		).toBe(false);
	});

	it('AK8b: Free (kein ai_assist) + eigener Custom → KI-Schalter an', () => {
		const withOwn = [
			{ kind: 'custom', own: false },
			{ kind: 'custom', own: true },
		];
		expect(
			computeAiFeaturesEnabled({
				preferenceEnabled: true,
				entitlementAllowed: false,
				hasCustomProvider: hasOwnCustomProvider(withOwn as never[]),
			}),
		).toBe(true);
	});
});
