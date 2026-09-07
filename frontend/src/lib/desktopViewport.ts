import { useEffect, useState } from 'react';

/** MediaQuery des Desktop-Breakpoints — identisch zur CSS-Grenze in `app.css` (48rem). */
const DESKTOP_VIEWPORT_QUERY = '(min-width: 48rem)';

/**
 * #1258: Überwacht live, ob der Viewport den Desktop-Breakpoint (≥ 48rem) erreicht — Wechsel am
 * MediaQueryList-`change`-Event landen ohne Neuladen im State, beim Unmount wird der Listener
 * abgemeldet. Listener-Muster wie `usePrefersReducedMotion` in `reducedMotion.ts`.
 *
 * Verbraucher (aktuell `CompletedTasksTable`): Komponenten, die unterhalb des Breakpoints eine
 * andere DOM-Struktur rendern als CSS allein umformatieren kann (z. B. andere Tabellen-Spalten).
 * Die Breakpoint-Grenze muss mit den Media-Queries in `app.css` übereinstimmen — bei einer
 * Verschiebung beide Stellen ändern.
 */
export const useDesktopViewport = (): boolean => {
	const [isDesktop, setIsDesktop] = useState<boolean>(() => window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches);

	useEffect(() => {
		const mediaQuery = window.matchMedia(DESKTOP_VIEWPORT_QUERY);
		const handleChange = (event: MediaQueryListEvent): void => {
			setIsDesktop(event.matches);
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	return isDesktop;
};
