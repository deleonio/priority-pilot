import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#190) für die Login-Page/Maske (Frontend-UI für Google OAuth).
 *
 * **Warum hier — anders als in `crud.spec.ts`/`smoke.spec.ts` — gemockt wird:** Die funktionalen
 * Specs sprechen bewusst das echte Backend an. Der Auth-Status hängt jedoch an einem echten Google-
 * OAuth-Flow, der in der E2E-Umgebung weder durchlaufbar noch deterministisch ist. Wir steuern den
 * Auth-Zustand daher über `page.route('**\/auth/me', ...)`: 401 = unauthentifiziert (Login-Seite),
 * 200 = authentifiziert (Haupt-App). Den OAuth-Start (`/auth/google`) fangen wir ab, statt ihn zur
 * echten Google-Consent-Seite navigieren zu lassen.
 */

/** Antwortet auf `GET /auth/me` mit 401 (unauthentifiziert) → die App soll die Login-Seite zeigen. */
const mockUnauthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Unauthorized' }),
		}),
	);
};

/** Antwortet auf `GET /auth/me` mit 200 + User → die App soll die Haupt-App zeigen. */
const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com' }),
		}),
	);
};

test.describe('Balamentum — Login-Page für Google OAuth (#190)', () => {
	test('AK1a: Unauthentifizierter Benutzer sieht Login-Seite statt Haupt-App', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		// Der auffällige Google-Login-Button ist sichtbar …
		await expect(page.getByRole('button', { name: /Mit Google anmelden/i })).toBeVisible();
		// … und die Haupt-App (sr-only H1 „Dashboard") ist es NICHT.
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeHidden();
	});

	test('AK1b: Login-Seite ist fullscreen — App-Toolbar und Tabs nicht sichtbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		// Sicherstellen, dass die Login-Seite gerendert ist, bevor wir auf Abwesenheiten prüfen.
		await expect(page.getByRole('button', { name: /Mit Google anmelden/i })).toBeVisible();

		// Kein Einbetten in die normale UI: weder der „Neuen Task anlegen"-Button …
		await expect(page.getByRole('button', { name: 'Neuen Task anlegen' })).toBeHidden();
		// … noch die Tab-Leiste (z. B. der „Dashboard"-Tab) ist sichtbar.
		await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeHidden();
	});

	test('AK2: Klick auf Google Login Button navigiert zu /auth/google', async ({ page }) => {
		await mockUnauthenticated(page);
		// Den OAuth-Start abfangen, OHNE wirklich zur Google-Consent-Seite zu navigieren.
		await page.route('**/auth/google', (route: Route) => route.abort());
		await page.goto('/app/');

		const loginButton = page.getByRole('button', { name: /Mit Google anmelden/i });
		await expect(loginButton).toBeVisible();

		// Der Klick muss einen Request an `/auth/google` auslösen (Start des OAuth-Flows).
		const requestPromise = page.waitForRequest((req) => req.url().includes('/auth/google'));
		await loginButton.click();
		const request = await requestPromise;
		expect(request.url()).toContain('/auth/google');
	});

	test('AK3a: ?error=access_denied zeigt benutzerfreundliche Fehlermeldung', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/?error=access_denied');

		// Die Fehlermeldung ist als alert-Role ausgewiesen und sichtbar.
		await expect(page.getByRole('alert')).toBeVisible();
		// Die Login-Seite bleibt erreichbar — der Login-Button ist weiterhin da.
		await expect(page.getByRole('button', { name: /Mit Google anmelden/i })).toBeVisible();
	});

	test('AK3b: ?error=invalid_email zeigt E-Mail-Fehler-Hinweis', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/?error=invalid_email');

		// Die spezifische Meldung nimmt Bezug auf die E-Mail-Adresse.
		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText(/E-Mail|email/i);
	});

	test('AK4: Authentifizierter Benutzer sieht Haupt-App — kein Login-Screen', async ({ page }) => {
		await mockAuthenticated(page);
		await page.goto('/app/');

		// Die Haupt-App (sr-only H1 „Dashboard") ist im DOM …
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		// … und der Login-Button ist es NICHT.
		await expect(page.getByRole('button', { name: /Mit Google anmelden/i })).toBeHidden();
	});

	test('AK5: Login-Seite ist auf mobilen Viewports bedienbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');

		// Auch auf einem schmalen Mobil-Viewport ist der Login-Button sichtbar und bedienbar.
		const loginButton = page.getByRole('button', { name: /Mit Google anmelden/i });
		await expect(loginButton).toBeVisible();
		await expect(loginButton).toBeEnabled();
	});

	test('AK7 (#1751): kein horizontales Scrollen bei 375px, Touch-Targets bleiben ≥44px', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');

		const loginButton = page.getByRole('button', { name: /Mit Google anmelden/i });
		await expect(loginButton).toBeVisible();

		const innerBox = await page.locator('.login-page__inner').boundingBox();
		const buttonBox = await loginButton.boundingBox();
		expect(innerBox, '.login-page__inner muss eine Bounding-Box haben').toBeTruthy();
		expect(buttonBox, 'Login-Button muss eine Bounding-Box haben').toBeTruthy();

		// Nichts ragt über den Viewport hinaus (Memory 2026-08-24: scrollWidth ist hier nicht
		// aussagekräftig, die App-Shell clippt mit overflow-x: hidden).
		expect(innerBox!.x).toBeGreaterThanOrEqual(0);
		expect(innerBox!.x + innerBox!.width).toBeLessThanOrEqual(375);
		expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
	});
});
