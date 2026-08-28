import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { afterEach } from 'vitest';

/**
 * Globaler RTL-Auto-Cleanup: `@testing-library/react` registriert seinen `afterEach(cleanup)`
 * nur, wenn Vitest-Globals aktiv sind (`globals: true`) — hier ist das nicht der Fall, deshalb
 * explizit. Ohne diesen Aufruf bleibt das gerenderte DOM über alle Tests einer Datei hinweg
 * stehen und `getByRole`-Abfragen werden mehrdeutig (`Found multiple elements with the role …`).
 */
afterEach(() => {
	cleanup();
});

/**
 * Web-Storage-Shim für das jsdom-Test-Environment.
 *
 * Node ≥ 26 stellt `localStorage`/`sessionStorage` als native globale Getter bereit, die ohne
 * `--localstorage-file` nur `undefined` liefern (ExperimentalWarning). Da vitests jsdom-Environment
 * `window === globalThis` setzt, belegt dieser native, leere Getter den Slot und verdrängt die
 * Web-Storage-Implementierung, die jsdom sonst bereitstellt — bare `localStorage`-Zugriffe (wie in
 * `src/lib/theme.ts`) sind dadurch zur Laufzeit `undefined`.
 *
 * Wir binden die Globals deshalb an die Storage-Objekte einer frischen jsdom-Instanz. Die stammen aus
 * demselben jsdom-Modul wie der globale `Storage`-Konstruktor, also bleibt `Storage.prototype`
 * (z. B. für `vi.spyOn(Storage.prototype, …)`) gültig. Reiner Test-Workaround; Produktivcode (Browser)
 * ist nicht betroffen. Unter Node 22/24 ist der Global bereits jsdoms Storage → der Shim ist ein No-op.
 */
const isUnavailable = (name: 'localStorage' | 'sessionStorage'): boolean => {
	try {
		return globalThis[name] == null;
	} catch {
		return true;
	}
};

if (isUnavailable('localStorage') || isUnavailable('sessionStorage')) {
	const { localStorage, sessionStorage } = new JSDOM('', { url: 'http://localhost' }).window;
	const impls = { localStorage, sessionStorage } as const;
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		if (isUnavailable(name)) {
			Object.defineProperty(globalThis, name, {
				configurable: true,
				writable: true,
				value: impls[name],
			});
		}
	}
}

// jsdom implementiert window.matchMedia nicht — minimaler Stub damit Theme-Code in Tests nicht crasht.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}
