import { useEffect, useRef } from 'react';

/**
 * Registers a keydown listener that fires `callback` when Ctrl+Enter or ⌘+Enter is pressed,
 * but only when `enabled` is true. Prevents default to avoid newlines in textareas.
 *
 * Der Callback wird in einem `useRef` gehalten und bleibt so aus der `useEffect`-Dependency-Array
 * heraus: würde die (bei jedem Render neu erzeugte) Callback-Referenz in den Deps stehen, würde der
 * Listener bei jedem Render (u. a. bei jedem Tastendruck ins Textfeld) ab- und wieder angemeldet.
 */
export const useCtrlEnter = (callback: () => void, enabled: boolean): void => {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;
		const handler = (e: KeyboardEvent): void => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				callbackRef.current();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [enabled]);
};
