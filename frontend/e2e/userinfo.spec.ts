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
const mockMe = async (page: Page, user: { id: number; displayName: string; email: string }): Promise<void> => {
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
	// AK3a ("E-Mail aus /auth/me ist im Header/Navigation sichtbar") ist durch #222 überholt: der
	// homogenere App-Header entfernt die E-Mail bewusst aus dem DOM (siehe
	// e2e/header-appearance.spec.ts, AK1: `not.toBeAttached()`). Beide Kriterien sind nicht
	// gleichzeitig erfüllbar — #222 hat Vorrang, AK3a entfällt ersatzlos.

	test('AK3b: Name aus /auth/me ist im Header/Navigation sichtbar', async ({ page }) => {
		await mockMe(page, { id: 1, displayName: 'Max Mustermann', email: 'max@example.com' });
		await page.goto('/');

		await expect(page.getByText('Max Mustermann')).toBeVisible();
	});

	test('AK6: Bei HTTP 500 erscheint eine Fehlermeldung — KEIN Login-Screen', async ({ page }) => {
		await mockMeServerError(page);
		await page.goto('/');

		// Ein Serverfehler (500) ist kein „unauthentifiziert" (401): Es muss eine Fehlermeldung
		// (alert-Role) erscheinen …
		await expect(page.getByRole('alert')).toBeVisible();
		// … und NICHT die Login-Seite.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});
});
