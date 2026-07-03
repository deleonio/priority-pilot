import { useEffect } from 'react';

/**
 * Registers a keydown listener that fires `callback` when Ctrl+Enter or ⌘+Enter is pressed,
 * but only when `enabled` is true. Prevents default to avoid newlines in textareas.
 */
export const useCtrlEnter = (callback: () => void, enabled: boolean): void => {
	useEffect(() => {
		if (!enabled) return;
		const handler = (e: KeyboardEvent): void => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				callback();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [callback, enabled]);
};
