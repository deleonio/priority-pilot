import { useEffect, useRef } from 'react';

/**
 * Registers a keydown listener that fires `callback` when Ctrl+Enter or ⌘+Enter is pressed,
 * but only when `enabled` is true. Prevents default to avoid newlines in textareas.
 *
 * Der Callback wird in einem `useRef` gehalten und bleibt so aus der `useEffect`-Dependency-Array
 * heraus: würde die (bei jedem Render neu erzeugte) Callback-Referenz in den Deps stehen, würde der
 * Listener bei jedem Render (u. a. bei jedem Tastendruck ins Textfeld) ab- und wieder angemeldet.
 *
 * `enabled` darf ein `boolean` ODER eine `() => boolean`-Funktion sein: Der Listener wird IMMER
 * (leere Deps) angemeldet, und die Aktivierungs-Bedingung wird ZUM EVENT-ZEITPUNKT via Ref geprüft.
 * Als Funktion übergeben liest die Bedingung stets frische Werte (z. B. `ref.current`), auch wenn
 * React nach einer State-Änderung noch nicht neu gerendert hat — Refs werden von Event-Handlern
 * synchron VOR dem Re-Render aktualisiert. Das schließt die Race, bei der Ctrl+Enter direkt nach
 * einer Eingabe/Auswahl feuert, bevor der über `enabled` gebundene State neu berechnet wurde.
 */
export const useCtrlEnter = (callback: () => void, enabled: boolean | (() => boolean)): void => {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;
	const enabledRef = useRef<boolean | (() => boolean)>(enabled);
	enabledRef.current = enabled;

	useEffect(() => {
		const handler = (e: KeyboardEvent): void => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				const isEnabled = typeof enabledRef.current === 'function' ? enabledRef.current() : enabledRef.current;
				if (!isEnabled) return;
				e.preventDefault();
				callbackRef.current();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);
};
