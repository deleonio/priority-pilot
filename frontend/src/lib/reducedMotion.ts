import { useEffect, useState } from 'react';

/** MediaQuery, über die das Betriebssystem „Bewegung reduzieren" meldet. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * #1187: Überwacht die OS-Einstellung „Bewegung reduzieren" live — Wechsel am
 * MediaQueryList-`change`-Event landen ohne Neuladen im State, beim Unmount wird
 * der Listener abgemeldet. Listener-Muster wie `useTheme` in `theme.ts`.
 *
 * Die Einstellung hat Vorrang vor dem Master-Schalter „Animationen" (#1183):
 * Das Konfetti-Gate prüft die Query selbst bei jedem Aufruf (`confetti.ts`),
 * dieser Hook liefert nur den Anzeige-Zustand für die Info-Meldung.
 */
export const usePrefersReducedMotion = (): boolean => {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
		() => window.matchMedia(REDUCED_MOTION_QUERY).matches,
	);

	useEffect(() => {
		const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
		const handleChange = (event: MediaQueryListEvent): void => {
			setPrefersReducedMotion(event.matches);
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	return prefersReducedMotion;
};
