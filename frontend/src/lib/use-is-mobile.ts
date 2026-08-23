import { useEffect, useState } from 'react';

/** Breakpoint fuer vertikale Stackung auf Mobile (<768px = 47.99rem) — identisch zur CSS-Grenze (48rem). */
const MOBILE_BREAKPOINT = '(max-width: 47.99rem)';

/**
 * React-Hook: Liefert `true`, wenn der Viewport schmaler als der Mobile-Breakpoint ist.
 * Aendert sich live bei Viewport-Aenderungen (Resize, Device-Rotation).
 */
export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mql = window.matchMedia(MOBILE_BREAKPOINT);
		setIsMobile(mql.matches);
		const handler = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
		mql.addEventListener('change', handler);
		return (): void => mql.removeEventListener('change', handler);
	}, []);
	return isMobile;
}
