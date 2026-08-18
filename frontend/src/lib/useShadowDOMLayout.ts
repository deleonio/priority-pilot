import { useEffect } from 'react';

/**
 * Custom Hook für Shadow-DOM Layout-Adjustments (#843).
 *
 * Setzt marginLeft auf Shadow-DOM Controls (role="radio", role="switch", button) um
 * konsistentes Alignment (24dp = 1.5rem) über alle Settings-Controls zu erreichen.
 *
 * @param selector - CSS-Selector für die Shadow-Host-Elemente (z.B. 'kol-input-radio')
 * @param controlSelector - CSS-Selector für die Controls im Shadow-DOM (z.B. '[role="radio"]')
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');
 * ```
 */
export const useShadowDOMLayout = (
	ref: React.RefObject<HTMLElement | null>,
	hostSelector: string,
	controlSelector: string,
) => {
	useEffect(() => {
		if (!ref.current) return;

		let updateTimeout: ReturnType<typeof setTimeout> | null = null;

		const updateMargins = () => {
			const shadowHosts = ref.current?.querySelectorAll(hostSelector);
			shadowHosts?.forEach((host) => {
				try {
					const shadowRoot = (host as HTMLElement).shadowRoot;
					if (shadowRoot) {
						const controls = shadowRoot.querySelectorAll(controlSelector);
						controls.forEach((control) => {
							(control as HTMLElement).style.marginLeft = '1.5rem';
						});
					}
				} catch (error) {
					// Closed Shadow-DOM oder anderer Fehler – Element überspringen
					console.debug('Shadow-DOM Zugriff fehlgeschlagen:', error);
				}
			});
		};

		// MutationObserver mit Debounce (100ms) für späte Renderings
		const observer = new MutationObserver(() => {
			if (updateTimeout) clearTimeout(updateTimeout);
			updateTimeout = setTimeout(updateMargins, 100);
		});

		if (ref.current) {
			observer.observe(ref.current, { childList: true, subtree: true });
			// Initial update direkt nach Mount
			updateMargins();
		}

		return () => {
			if (updateTimeout) clearTimeout(updateTimeout);
			observer.disconnect();
		};
	}, [ref, hostSelector, controlSelector]);
};
