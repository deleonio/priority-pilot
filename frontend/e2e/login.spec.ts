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
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		// … und die Haupt-App (sr-only H1 „Dashboard") ist es NICHT.
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeHidden();
	});

	test('AK1b: Login-Seite ist fullscreen — App-Toolbar und Tabs nicht sichtbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		// Sicherstellen, dass die Login-Seite gerendert ist, bevor wir auf Abwesenheiten prüfen.
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();

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

		const loginButton = page.getByRole('button', { name: 'Mit Google anmelden' });
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
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
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
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeHidden();
	});

	test('AK5: Login-Seite ist auf mobilen Viewports bedienbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');

		// Auch auf einem schmalen Mobil-Viewport ist der Login-Button sichtbar und bedienbar.
		const loginButton = page.getByRole('button', { name: 'Mit Google anmelden' });
		await expect(loginButton).toBeVisible();
		await expect(loginButton).toBeEnabled();
	});
});

test.describe('#1753 — Login-Maske: Hierarchie, Card-Struktur, Website-Link', () => {
	test('#1753/AK1: Card-Kopf — Titel (lg) und Subline innerhalb der Card', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		const title = page.locator('.login-page__card h1.login-page__title');
		await expect(title).toHaveText('Anmelden');
		await expect(page.locator('.login-page__card .login-page__sub')).toBeVisible();
		const fontSize = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(fontSize, 'Titel nutzt --pp-font-size-lg (1.125rem = 18px)').toBe(18);
	});

	test('#1753/AK2: Web-Kanal zeigt „Zurück zur Website“ unterhalb der Card', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		const backLink = page.getByRole('link', { name: 'Zurück zur Website' });
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', '/');
	});

	test('#1753/AK3: Google-Button heißt „Mit Google anmelden“ (Brand-SVG unverändert)', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		const btn = page.getByRole('button', { name: 'Mit Google anmelden' });
		await expect(btn).toBeVisible();
		await expect(btn.locator('svg[aria-hidden="true"]')).toHaveAttribute('width', '18');
	});

	test('#1753/AK4: Magic-Link-Formular über Klasse gestylt, ohne Inline-style', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.route('**/auth/providers', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ google: true, magicLink: true }),
			}),
		);
		await page.goto('/app/');

		const form = page.locator('form.login-page__form');
		await expect(form).toBeVisible();
		await expect(form).not.toHaveAttribute('style');
	});

	test('#1753/AK6: 375px — kein horizontales Scrollen, Touch-Ziele ≥ 44px', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');

		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		const scroll = await page.evaluate(() => ({
			sw: document.documentElement.scrollWidth,
			cw: document.documentElement.clientWidth,
		}));
		expect(scroll.sw, 'kein horizontales Scrollen bei 375px').toBeLessThanOrEqual(scroll.cw);

		const targets = page.locator('.login-page button, .login-page input, .login-page a');
		const count = await targets.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const box = await targets.nth(i).boundingBox();
			expect(box?.height ?? 0, `Touch-Ziel ${i} mindestens 44px hoch`).toBeGreaterThanOrEqual(44);
		}
	});
});
