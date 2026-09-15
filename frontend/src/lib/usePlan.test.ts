import { act, renderHook } from '@testing-library/react';
import type { Plan } from './planOffers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests zu #1458 AK1–AK3 — Paket-Spiegel im `localStorage`.
 *
 * Der Spiegel liegt je Konto unter einem eigenen Schlüssel (AK2) und ist gegen gesperrten Storage
 * abgesichert (AK3) — dann bleibt nur der Weg über `/auth/me`.
 */

import { clearPlanMirror, planMirrorKey, readPlanMirror, storePlanMirror, useBillingReturnPoll } from './usePlan';

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('Paket-Spiegel (#1458 AK1–AK3)', () => {
	it('AK2: der Schlüssel trägt die User-Id — Konto B liest den Eintrag von Konto A nicht', () => {
		storePlanMirror(1, { plan: 'pro', entitlements: { groups: { allowed: true, requiredPlan: 'pro' } } });

		expect(planMirrorKey(1)).toContain('1');
		expect(readPlanMirror(1).plan).toBe('pro');
		expect(readPlanMirror(2)).toEqual({ plan: null, entitlements: {} });
	});

	it('AK2: Logout löscht den Spiegel des Kontos', () => {
		storePlanMirror(1, { plan: 'pro', entitlements: {} });

		clearPlanMirror(1);

		expect(localStorage.getItem(planMirrorKey(1))).toBeNull();
	});

	it('AK1: der gespiegelte Zustand steht synchron zur Verfügung', () => {
		storePlanMirror(7, { plan: 'max', entitlements: { graph_write: { allowed: true, requiredPlan: 'max' } } });

		expect(readPlanMirror(7).entitlements.graph_write).toEqual({ allowed: true, requiredPlan: 'max' });
	});

	it('AK3: gesperrter localStorage führt nicht zum Fehler, sondern zum Leerzustand', () => {
		// `vi.stubGlobal` statt eines Spies: Manche Setups ersetzen `localStorage` durch ein eigenes
		// Objekt — ein Spy auf `Storage.prototype` griffe dann nicht.
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('SecurityError');
			},
			removeItem: () => {
				throw new Error('SecurityError');
			},
		});

		expect(() => storePlanMirror(1, { plan: 'pro', entitlements: {} })).not.toThrow();
		expect(readPlanMirror(1)).toEqual({ plan: null, entitlements: {} });
	});

	it('AK3: kaputter JSON-Inhalt führt zum Leerzustand statt zum Absturz', () => {
		localStorage.setItem(planMirrorKey(3), '{kein json');

		expect(readPlanMirror(3)).toEqual({ plan: null, entitlements: {} });
	});
});

/**
 * Rote Spec-Tests für #1496 AK4 (Spec docs/spec/issue-1496.md) — `useBillingReturnPoll` löst nach
 * der Rückkehr aus dem Buchungsvorgang genau einen sofortigen Refresh aus, schreibt selbst keinen
 * Plan-Wert und pollt danach in Abständen mit Obergrenze, bis das erwartete Paket ankommt.
 */
describe('useBillingReturnPoll (#1496 AK4)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('löst bei Mount genau einen sofortigen refresh()-Aufruf aus', () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		renderHook(({ currentPlan }) => useBillingReturnPoll(refresh, 'pro', currentPlan), {
			initialProps: { currentPlan: 'free' as Plan },
		});

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('meldet "waiting", solange currentPlan vom erwarteten Paket abweicht', () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(({ currentPlan }) => useBillingReturnPoll(refresh, 'pro', currentPlan), {
			initialProps: { currentPlan: 'free' as Plan },
		});

		expect(result.current.status).toBe('waiting');
	});

	it('wechselt zu "confirmed", sobald currentPlan dem erwarteten Paket entspricht', () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		const { result, rerender } = renderHook(({ currentPlan }) => useBillingReturnPoll(refresh, 'pro', currentPlan), {
			initialProps: { currentPlan: 'free' as Plan },
		});

		rerender({ currentPlan: 'pro' as const });

		expect(result.current.status).toBe('confirmed');
	});

	it('pollt in Abständen nach, bis die Obergrenze erreicht ist, dann "timeout" ohne weiteren Poll', () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(({ currentPlan }) => useBillingReturnPoll(refresh, 'pro', currentPlan), {
			initialProps: { currentPlan: 'free' as Plan },
		});

		// Default-Obergrenze laut Spec: 10 Versuche à 3000ms. Nach genügend Intervallen muss der Hook
		// selbst abbrechen (kein Endlos-Polling) und darf danach nicht mehr aufrufen.
		act(() => {
			vi.advanceTimersByTime(3000 * 12);
		});

		expect(result.current.status).toBe('timeout');
		const callsAtTimeout = refresh.mock.calls.length;

		act(() => {
			vi.advanceTimersByTime(3000 * 5);
		});

		expect(refresh.mock.calls.length).toBe(callsAtTimeout);
	});

	it('schreibt selbst keinen Plan-Wert in den localStorage-Spiegel (nur refresh() darf das)', () => {
		const refresh = vi.fn().mockResolvedValue(undefined);
		renderHook(({ currentPlan }) => useBillingReturnPoll(refresh, 'pro', currentPlan), {
			initialProps: { currentPlan: 'free' as Plan },
		});

		expect(localStorage.getItem(planMirrorKey(1))).toBeNull();
	});
});
