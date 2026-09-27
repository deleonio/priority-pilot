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
});

test.describe('Login-Maske: Hierarchie, Card-Struktur, Website-Link (#1752)', () => {
	test('AK1: Titel nutzt --pp-font-size-lg, Titel+Subline liegen in der Card, kein negatives Sub-Margin', async ({
		page,
	}) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();

		// Font-Size gegen eine Probe mit dem lg-Token vergleichen (löst Theme-/Skalierungswerte auf).
		const result = await page.evaluate(() => {
			const title = document.querySelector('.login-page__title');
			const sub = document.querySelector('.login-page__sub');
			const probe = document.createElement('div');
			probe.style.fontSize = 'var(--pp-font-size-lg)';
			document.body.appendChild(probe);
			const expected = getComputedStyle(probe).fontSize;
			probe.remove();
			return {
				actual: title ? getComputedStyle(title).fontSize : null,
				expected,
				titleInCard: Boolean(document.querySelector('.login-page__card .login-page__title')),
				subInCard: Boolean(document.querySelector('.login-page__card .login-page__sub')),
				subMarginTop: sub ? getComputedStyle(sub).marginTop : null,
			};
		});
		expect(result.actual, 'Titel nutzt --pp-font-size-lg').toBe(result.expected);
		expect(result.titleInCard, 'Titel liegt innerhalb .login-page__card').toBe(true);
		expect(result.subInCard, 'Subline liegt innerhalb .login-page__card').toBe(true);
		expect(
			parseFloat(result.subMarginTop ?? '-1'),
			'kein negatives Margin auf .login-page__sub',
		).toBeGreaterThanOrEqual(0);
	});

	test('AK2: Website-Link unter der Card mit href="/"', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		const link = page.getByRole('link', { name: /Website/ });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', '/');
	});

	test('AK3: Google-Button trägt den deutschen Text', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');

		await expect(page.getByRole('button', { name: /Mit Google anmelden/i })).toBeVisible();
		await expect(
			page.getByRole('button', { name: /Login with Google/i }),
			'kein englischer Button-Text mehr',
		).toHaveCount(0);
	});

	test('AK6: Bei 375 px kein horizontaler Overflow, Bedienelemente mindestens 44 px hoch', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');
		await expect(page.getByRole('button', { name: /Google/i }).first()).toBeVisible();

		// Bounding-Box statt scrollWidth: Die App-Shell clippt overflow-x, scrollWidth bleibt
		// strukturell klein (Erfahrung 2026-08-24).
		const overflow = await page.evaluate(() => {
			const vw = document.documentElement.clientWidth;
			return Array.from(document.querySelectorAll('.login-page, .login-page *')).some((el) => {
				if (!(el instanceof HTMLElement) || el.offsetParent === null) return false;
				const box = el.getBoundingClientRect();
				return box.left < -0.5 || box.right > vw + 0.5;
			});
		});
		expect(overflow, 'kein Element der Login-Seite ragt bei 375 px aus dem Viewport').toBe(false);

		const controls = await page.evaluate(() =>
			Array.from(document.querySelectorAll('.login-page__btn, .login-page__input')).map((el) => ({
				label: (el.textContent ?? el.getAttribute('placeholder') ?? el.id ?? '').trim(),
				height: el.getBoundingClientRect().height,
			})),
		);
		expect(controls.length, 'Buttons/Input müssen vorhanden sein').toBeGreaterThan(0);
		for (const { label, height } of controls) {
			expect(height, `Bedienelement "${label}" muss mindestens 44 px hoch sein`).toBeGreaterThanOrEqual(44);
		}
	});
});
