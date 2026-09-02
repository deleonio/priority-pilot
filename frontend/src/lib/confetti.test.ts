import { TaskStatus } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchConfetti, shouldCelebrateDone } from './confetti';

/**
 * Roter TDD-Vertrag für #1169 — Konfetti beim Erledigt-Toggle (Unit-Ebene).
 *
 * Spezifikation: `docs/spec/issue-1169.md` (Modul-Vertrag `frontend/src/lib/confetti.ts`).
 * Das Modul existiert im Produktivcode noch nicht → RED (Import scheitert zur Compile-Zeit).
 *
 * Die Richtung (`shouldCelebrateDone`) ist bewusst `matchMedia`-unabhängig geprüft (TF3);
 * die reduced-motion-Unterdrückung ist separat in `launchConfetti` verankert (TF6) — die
 * globale CSS-Regel (`app.css:187`) stoppt KEINE rAF-Animation, deshalb JS-Abfrage.
 */

/** jsdom liefert kein `matchMedia` mit Präferenzen → explizit stubben (Vorbild `theme.test.ts`). */
const stubReducedMotion = (reduce: boolean): void => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockImplementation((query: string) => ({
			matches: reduce && query.includes('prefers-reduced-motion'),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn().mockReturnValue(false),
		})),
	);
};

/** Räumt Overlay-Reste zwischen den Tests weg, damit sich Tests nicht gegenseitig beeinflussen. */
const removeConfettiOverlays = (): void => {
	document.querySelectorAll('[data-testid="confetti-overlay"]').forEach((el) => el.remove());
};

afterEach(() => {
	removeConfettiOverlays();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('shouldCelebrateDone — Richtungsentcheidung (#1169 AK3, matchMedia-unabhängig)', () => {
	it('AK3a: Open→Done feiert', () => {
		expect(shouldCelebrateDone(TaskStatus.Open, TaskStatus.Done)).toBe(true);
	});

	it('AK3b: Done→Open (Wieder-Öffnen) feiert NICHT', () => {
		expect(shouldCelebrateDone(TaskStatus.Done, TaskStatus.Open)).toBe(false);
	});

	it('AK3c: Done→Done und Open→InProcess feiern NICHT — nur Übergänge auf Done', () => {
		expect(shouldCelebrateDone(TaskStatus.Done, TaskStatus.Done)).toBe(false);
		expect(shouldCelebrateDone(TaskStatus.Open, TaskStatus.InProcess)).toBe(false);
	});
});

describe('launchConfetti — Overlay-Vertrag (#1169 AK1/AK2/AK5/AK6)', () => {
	it('AK1: ohne reduced-motion wird ein Full-Viewport-Overlay erzeugt und true zurückgegeben', () => {
		stubReducedMotion(false);
		expect(launchConfetti()).toBe(true);
		const overlay = document.querySelector('[data-testid="confetti-overlay"]');
		expect(overlay).not.toBeNull();
	});

	it('AK5: das Overlay ist rein dekorativ und blockiert keine Bedienung', () => {
		stubReducedMotion(false);
		launchConfetti();
		const overlay = document.querySelector('[data-testid="confetti-overlay"]');
		expect(overlay?.getAttribute('aria-hidden')).toBe('true');
		// KI-UX: pointer-events: none nach dem UpdatePrompt-Overlay-Muster (app.css:1765-1781).
		expect(overlay?.style.pointerEvents).toBe('none');
	});

	it('AK2: das Overlay entfernt sich spätestens nach 6 s selbst aus dem DOM', () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		expect(launchConfetti()).toBe(true);
		expect(document.querySelector('[data-testid="confetti-overlay"]')).not.toBeNull();
		vi.advanceTimersByTime(6_000);
		expect(document.querySelector('[data-testid="confetti-overlay"]')).toBeNull();
	});

	it('AK6: bei prefers-reduced-motion: reduce wird kein Overlay erzeugt und false zurückgegeben', () => {
		stubReducedMotion(true);
		expect(launchConfetti()).toBe(false);
		expect(document.querySelector('[data-testid="confetti-overlay"]')).toBeNull();
	});
});
