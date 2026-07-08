import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#208) für das Frontend-Auth-Gate (AK 7 + AK 8).
 *
 * AK 7 — Frontend-Guard: Unauthentifiziert → LoginPage sichtbar, Haupt-App ausgeblendet.
 * AK 8 — Login-UI mit exakten deutschen Fehlermeldungen für OAuth-Fehlerparameter.
 *
 * Warum gemockt: Google-OAuth-Flow ist in der E2E-Umgebung nicht durchlaufbar.
 * Der Auth-Zustand wird über page.route('**\/auth/me', ...) gesteuert.
 */

const mockUnauthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Unauthorized' }),
		}),
	);
};

const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, name: 'Test User', email: 'test@example.com' }),
		}),
	);
};

test.describe('AK 7 — Frontend-Guard (#208)', () => {
	test('AK7a: Unauthentifizierter Aufruf zeigt LoginPage — Haupt-App ausgeblendet', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/');

		// LoginPage muss sichtbar sein …
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		// … die Haupt-App (sr-only H1 „Dashboard") darf NICHT im Dokument sein.
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeHidden();
	});

	test('AK7b: Authentifizierter Benutzer sieht Haupt-App, nicht die LoginPage', async ({ page }) => {
		await mockAuthenticated(page);
		await page.goto('/');

		// Haupt-App muss sichtbar sein (sr-only H1 „Dashboard" im DOM) …
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		// … LoginPage darf NICHT erscheinen.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});

	test('AK7c: Wechsel von unauthentifiziert auf authentifiziert zeigt Haupt-App', async ({ page }) => {
		// Erst 401 zurückgeben, dann auf 200 umschalten (simuliert Redirect nach OAuth).
		await mockUnauthenticated(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();

		// Auth-State auf eingeloggt setzen und Seite neu laden.
		await mockAuthenticated(page);
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});
});

test.describe('AK 8 — Login-UI mit Fehlerbehandlung (#208)', () => {
	test('AK8a: ?error=access_denied zeigt exakte deutsche Fehlermeldung', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/?error=access_denied');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText('Der Zugriff wurde verweigert.');
	});

	test('AK8b: ?error=invalid_email zeigt E-Mail-spezifische Fehlermeldung', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/?error=invalid_email');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText('Deine E-Mail-Adresse ist nicht zugelassen.');
	});

	test('AK8c: Unbekannter Fehlerparameter zeigt generische Fehlermeldung', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/?error=unknown_error');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText('Ein unbekannter Anmeldefehler ist aufgetreten.');
	});

	test('AK8d: Kein Fehlerparameter → kein Alert sichtbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/');

		// Ohne ?error-Parameter darf kein Alert erscheinen.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		await expect(page.getByRole('alert')).toBeHidden();
	});
});
