import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#192) für die Anzeige aktueller Benutzerinformationen (User Info Display).
 *
 * **Direkt-Import aus `@playwright/test`** (nicht aus `./fixtures`): Die geteilten Fixtures mocken
 * `/auth/me` automatisch mit einem festen User und würden die hier benötigten, fallweisen Mocks
 * (eigener Name/E-Mail bzw. HTTP 500) überschreiben. Den Auth-Zustand steuern wir daher pro Test
 * selbst über `page.route('**\/auth/me', ...)` — analog zu `login.spec.ts`.
 */

/** Antwortet auf `GET /auth/me` mit 200 + einem konkreten User (Name + E-Mail). */
const mockMe = async (page: Page, user: { id: number; name: string; email: string }): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(user),
		}),
	);
};

/** Antwortet auf `GET /auth/me` mit HTTP 500 (Serverfehler — bewusst KEIN 401). */
const mockMeServerError = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Internal Server Error' }),
		}),
	);
};

test.describe('Priority Pilot — User Info Display (#192)', () => {
	test('AK3a: E-Mail aus /auth/me ist im Header/Navigation sichtbar', async ({ page }) => {
		await mockMe(page, { id: 1, name: 'Max Mustermann', email: 'max@example.com' });
		await page.goto('/');

		// Rot, weil `App.tsx` den Anzeigewert aktuell aus `localStorage` liest, nicht aus der
		// `/auth/me`-Response — die echte E-Mail erscheint dort daher (noch) nicht.
		await expect(page.getByText('max@example.com')).toBeVisible();
	});

	test('AK3b: Name aus /auth/me ist im Header/Navigation sichtbar', async ({ page }) => {
		await mockMe(page, { id: 1, name: 'Max Mustermann', email: 'max@example.com' });
		await page.goto('/');

		// Rot, weil der Name nicht aus der `/auth/me`-Response in den Header übernommen wird.
		await expect(page.getByText('Max Mustermann')).toBeVisible();
	});

	test('AK6: Bei HTTP 500 erscheint eine Fehlermeldung — KEIN Login-Screen', async ({ page }) => {
		await mockMeServerError(page);
		await page.goto('/');

		// Ein Serverfehler (500) ist kein „unauthentifiziert" (401): Es muss eine Fehlermeldung
		// (alert-Role) erscheinen …
		await expect(page.getByRole('alert')).toBeVisible();
		// … und NICHT die Login-Seite. Rot, weil `Root.tsx` aktuell bei jedem Fehler (auch 500) auf
		// `unauthenticated` schaltet und damit den Google-Login-Button zeigt.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});
});
