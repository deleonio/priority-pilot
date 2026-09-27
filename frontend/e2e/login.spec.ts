import type { Locator, Page, Route } from '@playwright/test';
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

	test('AK1 (#1769): Titel und Subline liegen als Card-Kopf in der Card, Titel nutzt die lg-Skala', async ({
		page,
	}) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		const card = page.locator('.login-page__card');
		await expect(card).toBeVisible();
		await expect(card.locator('h1.login-page__title')).toHaveText('Anmelden');
		await expect(card.locator('p.login-page__sub')).toHaveText('Melde dich an, um fortzufahren.');

		// Skalen-Treue: computed fontSize == --pp-font-size-lg (Probe-Element statt hartem Pixelwert,
		// damit der Breakpoint-Override in app.css:200 eingehalten bleibt).
		const sizes = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.fontSize = 'var(--pp-font-size-lg)';
			document.body.appendChild(probe);
			const lg = getComputedStyle(probe).fontSize;
			probe.remove();
			const title = document.querySelector('.login-page__title');
			const sub = document.querySelector('.login-page__sub');
			return {
				lg,
				title: title ? getComputedStyle(title).fontSize : null,
				subMarginTop: sub ? parseFloat(getComputedStyle(sub).marginTop) : null,
			};
		});
		expect(sizes.title, 'Titel-Fontgröße entspricht --pp-font-size-lg').toBe(sizes.lg);
		expect(sizes.subMarginTop, 'keine negative Margin mehr auf der Subline').toBeGreaterThanOrEqual(0);
	});

	test('AK2 (#1769): „Zurück zur Website“ unter der Card — im Web sichtbar mit href="/"', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		// Name darf präziser sein als der sichtbare Text (UX: aria-label, siehe docs/spec/issue-1769.md).
		const link = page.getByRole('link', { name: /Zurück zur/ });
		await expect(link).toBeVisible();
		expect(await link.getAttribute('href')).toBe('/');
	});

	test('AK2b (#1769): nativer Kanal rendert den Website-Link nicht', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.addInitScript(() => {
			(window as { __PP_CHANNEL__?: string }).__PP_CHANNEL__ = 'play';
		});
		await page.goto('/app/');

		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		await expect(page.getByRole('link', { name: /Zurück zur/ })).toHaveCount(0);
	});

	test('AK3 (#1769): Google-Button deutsch beschriftet, keine englische Textfläche', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		await expect(page.getByText('Login with Google')).toHaveCount(0);
	});

	test('AK6 (#1769): 375px — kein Overflow, Touch-Targets inkl. Website-Link mindestens 44px', async ({ page }) => {
		await mockUnauthenticated(page);
		// E2E-Backend hat kein SMTP → Magic-Link-Formular für die Messung einschalten
		// (Muster auth.spec.ts:42).
		await page.route('**/auth/providers', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ google: true, magicLink: true }),
			}),
		);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');

		const targets: [string, Locator][] = [
			['Card', page.locator('.login-page__card')],
			['Google-Button', page.getByRole('button', { name: 'Mit Google anmelden' })],
			['E-Mail-Input', page.getByLabel('Anmeldelink per E-Mail')],
			['Sende-Button', page.getByRole('button', { name: 'Anmeldelink senden' })],
			['Website-Link', page.getByRole('link', { name: /Zurück zur/ })],
		];
		for (const [name, locator] of targets) {
			// evaluate wartet bei fehlendem Element den vollen Timeout (MEMORY 2026-08-25) →
			// erst Sichtbarkeit gate'n.
			await expect(locator, name).toBeVisible();
			const box = await locator.evaluate((el) => {
				const r = el.getBoundingClientRect();
				return { x: r.x, width: r.width, height: r.height };
			});
			expect(box.x + box.width, `${name}: keine Bounding-Box über den 375px-Viewport hinaus`).toBeLessThanOrEqual(375);
			if (name !== 'Card') {
				expect(box.height, `${name}: Touch-Target mindestens 44px hoch`).toBeGreaterThanOrEqual(44);
			}
		}
	});
});
