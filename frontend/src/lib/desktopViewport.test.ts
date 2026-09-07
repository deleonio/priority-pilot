import { act, cleanup, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesktopViewport } from './desktopViewport';

/**
 * #1258 (Review-Nit 1): Live-Wechsel des Desktop-Breakpoints am MediaQueryList-`change`-Event —
 * der Hook-Pfad war bisher nur statisch gestubbt (`CompletedTasksTable.test.tsx`). Listener-Muster-
 * Vorgabe: `reducedMotion.test.ts` (Stub mit auslösbarem change-Event inkl. Listener-Liste).
 *
 * Ergänzt einen Drift-Schutz: die Breakpoint-Grenze `(min-width: 48rem)` ist zwischen `app.css`
 * und dem Hook dupliziert — der Test hält beide Quellen gegeneinander.
 */

type ChangeListener = (event: { matches: boolean }) => void;

interface FakeMediaQueryList {
	media: string;
	matches: boolean;
	/** Registriert einen change-Listener wie die echte MediaQueryList. */
	addEventListener: (type: string, listener: ChangeListener) => void;
	/** Meldet einen change-Listener ab (Verifikation des Unmount-Cleanups). */
	removeEventListener: (type: string, listener: ChangeListener) => void;
	/** Feuert den Viewport-Wechsel: setzt `matches` und benachrichtigt alle Listener. */
	fire: (matches: boolean) => void;
	/** Aktuell registrierte change-Listener (Verifikation des Unmount-Cleanups). */
	listenerCount: () => number;
}

const DESKTOP_QUERY = '(min-width: 48rem)';

/** Installiert einen steuerbaren matchMedia-Stub für die Desktop-Breakpoint-Query. */
const stubDesktopViewport = (initialMatches: boolean): FakeMediaQueryList => {
	const listeners = new Set<ChangeListener>();
	const mql: FakeMediaQueryList = {
		media: DESKTOP_QUERY,
		matches: initialMatches,
		addEventListener: (type: string, listener: ChangeListener) => {
			if (type === 'change') {
				listeners.add(listener);
			}
		},
		removeEventListener: (type: string, listener: ChangeListener) => {
			if (type === 'change') {
				listeners.delete(listener);
			}
		},
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
			if (query === DESKTOP_QUERY) {
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

describe('useDesktopViewport — Live-Breakpoint-Wechsel (#1258)', () => {
	it('initial false unterhalb des Desktop-Breakpoints (Mobile-Tabelle)', () => {
		stubDesktopViewport(false);
		const { result } = renderHook(() => useDesktopViewport());
		expect(result.current).toBe(false);
	});

	it('initial true ab dem Desktop-Breakpoint (Desktop-Tabelle)', () => {
		stubDesktopViewport(true);
		const { result } = renderHook(() => useDesktopViewport());
		expect(result.current).toBe(true);
	});

	it('change-Event (Breakpoint erreicht) flippt den Zustand live — ohne Neuladen', () => {
		const mql = stubDesktopViewport(false);
		const { result } = renderHook(() => useDesktopViewport());
		expect(result.current).toBe(false);

		act(() => {
			mql.fire(true);
		});
		expect(result.current).toBe(true);
	});

	it('change-Event (unter Breakpoint geschrumpft) flippt zurück — Mobile-Tabelle kehrt zurück', () => {
		const mql = stubDesktopViewport(true);
		const { result } = renderHook(() => useDesktopViewport());
		expect(result.current).toBe(true);

		act(() => {
			mql.fire(false);
		});
		expect(result.current).toBe(false);
	});

	it('Unmount meldet den change-Listener wieder ab (kein Leak)', () => {
		const mql = stubDesktopViewport(false);
		const { unmount } = renderHook(() => useDesktopViewport());
		expect(mql.listenerCount()).toBe(1);
		unmount();
		expect(mql.listenerCount()).toBe(0);
	});
});

describe('useDesktopViewport — Breakpoint-Drift-Schutz (#1258 Review-Nit 1)', () => {
	it('Media-Query des Hooks stimmt mit der Desktop-Grenze in app.css überein', () => {
		const dir = fileURLToPath(new URL('.', import.meta.url));
		const hookSource = readFileSync(`${dir}desktopViewport.ts`, 'utf8');
		const appCss = readFileSync(`${dir}../app.css`, 'utf8');

		const queryMatch = hookSource.match(/\(min-width:\s*[\d.]+rem\)/);
		expect(queryMatch, 'desktopViewport.ts muss eine (min-width: …rem)-Query enthalten').not.toBeNull();
		const query = queryMatch?.[0] ?? '';

		// Whitespace-normalisierter Vergleich, damit Formatierung („48rem" vs. „ 48rem") nicht fälschlich rot wird.
		const normalize = (text: string): string => text.replace(/\s+/g, '');
		expect(
			normalize(appCss),
			`app.css muss die Media-Query ${query} des Hooks enthalten — bei Verschiebung beide Stellen ändern`,
		).toContain(normalize(`@media ${query}`));
	});
});
