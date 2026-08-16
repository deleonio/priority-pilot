import type { Route } from '@playwright/test';
import { test as base } from '@playwright/test';

/**
 * Gemeinsame Test-Basis für die **funktionalen** E2E-Specs (`smoke`, `crud`, `balance`, `series`,
 * `suggestions`, `focus-after-delete`, `header-toolbar`, `api-v1-proxy`).
 *
 * **Hintergrund:** Seit #190 hängt vor der Haupt-App eine Auth-Gate (`Root.tsx`): Nur wenn
 * `GET /auth/me` einen User liefert, rendert die App; sonst erscheint die Login-Seite. Die
 * funktionalen Specs sprechen bewusst das echte Backend an — dieses kennt jedoch **keine**
 * `/auth`-Route, und der Vite-Proxy reicht nur `/api/v1/*` durch. `GET /auth/me` fiele also auf den
 * SPA-Fallback (HTML) zurück → `checkAuth()` wertet das als „nicht authentifiziert" → Login-Seite,
 * und jede Assertion auf die Haupt-App liefe in einen Timeout.
 *
 * Diese Fixture mockt `GET /auth/me` daher **standardmäßig** mit einem authentifizierten User, sodass
 * die Auth-Gate für alle funktionalen Specs durchlässig ist. Nur `/auth/me` wird abgefangen — alle
 * übrigen Requests (`/api/v1/*` etc.) gehen unverändert an das echte Backend.
 *
 * **Vorrang spec-eigener Mocks:** Playwright wertet Route-Handler in umgekehrter Registrierungsreihen-
 * folge aus (zuletzt registriert = zuerst geprüft). Da diese Fixture ihren `/auth/me`-Handler **vor**
 * Übergabe der Page registriert, gewinnt jeder spätere `page.route('**\/auth/me', ...)` aus einem Spec
 * (z. B. `login.spec.ts`, das gezielt 401/200 steuert). `login.spec.ts` importiert daher weiterhin
 * direkt aus `@playwright/test` und braucht diese Fixture nicht.
 */

const AUTHENTICATED_USER = { id: 1, displayName: 'Test User', email: 'test@example.com' };

export const test = base.extend({
	// Zweiter Parameter ist die Playwright-Fixture-Übergabe (`use`); bewusst `runTest` benannt, damit
	// die `react-hooks/rules-of-hooks`-Heuristik den Aufruf nicht als React-Hook fehldeutet.
	page: async ({ page }, runTest) => {
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(AUTHENTICATED_USER),
			}),
		);
		await runTest(page);
	},
});

export { expect, type Page } from '@playwright/test';
