import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests zu #1458 AK1–AK3 — Paket-Spiegel im `localStorage`.
 *
 * Der Spiegel liegt je Konto unter einem eigenen Schlüssel (AK2) und ist gegen gesperrten Storage
 * abgesichert (AK3) — dann bleibt nur der Weg über `/auth/me`.
 */

import { clearPlanMirror, planMirrorKey, readPlanMirror, storePlanMirror } from './usePlan';

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
