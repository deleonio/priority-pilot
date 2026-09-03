import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './reducedMotion';

/**
 * Roter TDD-Vertrag für #1187 — OS-Einstellung „Bewegung reduzieren" live überwachen (AK2).
 *
 * Spezifikation: docs/spec/issue-1187.md. Das Modul `frontend/src/lib/reducedMotion.ts`
 * existiert im Produktivcode noch nicht → RED (Import scheitert).
 *
 * Listener-Muster-Vorgabe: `frontend/src/lib/theme.ts:92-103` (matchMedia + change-Event
 * + Cleanup). jsdom liefert keine Präferenzen → Mock mit auslösbarem change-Event
 * (Stub-Idee: `confetti.test.ts:17-31`, hier um eine aktive Listener-Liste erweitert).
 */

type ChangeListener = (event: { matches: boolean }) => void;

interface FakeMediaQueryList {
	media: string;
	matches: boolean;
	/** Feuert den Systemwechsel: setzt `matches` und benachrichtigt alle Listener. */
	fire: (matches: boolean) => void;
	/** Aktuell registrierte change-Listener (Verifikation des Unmount-Cleanups). */
	listenerCount: () => number;
}

/** Installiert einen steuerbaren matchMedia-Stub für die reduced-motion-Query. */
const stubReducedMotion = (initialMatches: boolean): FakeMediaQueryList => {
	const listeners = new Set<ChangeListener>();
	const mql: FakeMediaQueryList = {
		media: '(prefers-reduced-motion: reduce)',
		matches: initialMatches,
		fire: (matches: boolean) => {
			mql.matches = matches;
			for (const listener of listeners) {
				listener({ matches });
			}
		},
		listenerCount: () => listeners.size,
	};
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockImplementation((query: string) => {
			if (query.includes('prefers-reduced-motion')) {
				return mql;
			}
			return { media: query, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
		}),
	);
	return mql;
};

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('usePrefersReducedMotion — Live-Systemwechsel (#1187 AK2)', () => {
	it('AK2a: initial false ohne System-„Bewegung reduzieren" (no-preference)', () => {
		stubReducedMotion(false);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);
	});

	it('AK2b: initial true bei aktiver Systemeinstellung (reduce)', () => {
		stubReducedMotion(true);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(true);
	});

	it('AK2c: change-Event (reduce an) flippt den Zustand live — ohne Neuladen', () => {
		const mql = stubReducedMotion(false);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(false);

		act(() => {
			mql.fire(true);
		});
		expect(result.current).toBe(true);
	});

	it('AK2d: change-Event (reduce aus) flippt zurück — Meldung blendet sich aus', () => {
		const mql = stubReducedMotion(true);
		const { result } = renderHook(() => usePrefersReducedMotion());
		expect(result.current).toBe(true);

		act(() => {
			mql.fire(false);
		});
		expect(result.current).toBe(false);
	});

	it('AK2e: Unmount meldet den change-Listener wieder ab (kein Leak)', () => {
		const mql = stubReducedMotion(false);
		const { unmount } = renderHook(() => usePrefersReducedMotion());
		expect(mql.listenerCount()).toBe(1);
		unmount();
		expect(mql.listenerCount()).toBe(0);
	});
});
