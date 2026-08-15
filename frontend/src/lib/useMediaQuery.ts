import { useEffect, useState } from 'react';

/**
 * React-Hook für eine CSS-Media-Query. Verallgemeinert das `matchMedia`-Muster, das `useTheme`
 * (src/lib/theme.ts) bereits für `prefers-color-scheme` nutzt: Startwert synchron lesen, danach
 * live auf `change` lauschen und den Listener beim Unmount wieder abmelden.
 *
 * Einsatzfall: Der Kopfbereich rendert unterhalb von 48rem eine kompakte Variante (Sekundäraktionen
 * hinter einem Avatar-Menü). Das muss in React entschieden werden und nicht per CSS `display: none`,
 * damit immer nur EINE Variante im DOM steht — sonst gäbe es dieselben Accessible Names doppelt.
 *
 * Fehlt `matchMedia` (jsdom ohne Stub), gilt die Query als nicht erfüllt; der Aufrufer bekommt also
 * die Basis-/Mobile-Variante. `frontend/vitest.setup.ts` stellt für Unit-Tests einen Stub bereit.
 */
export const useMediaQuery = (query: string): boolean => {
	const [matches, setMatches] = useState<boolean>(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return false;
		}
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return;
		}
		const media = window.matchMedia(query);
		const apply = (): void => setMatches(media.matches);
		// Erneut anwenden: Zwischen dem Initial-State und dem Effekt kann sich die Breite geändert
		// haben (z. B. Playwright `setViewportSize` direkt nach dem Mount).
		apply();
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	}, [query]);

	return matches;
};
