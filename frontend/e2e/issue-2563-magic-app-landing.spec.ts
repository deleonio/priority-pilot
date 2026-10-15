import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { MOBILE } from './helpers';

/**
 * Rote Spec-Tests (#2563, docs/spec/issue-2563.md): Ein Magic Link mit App-Marker (`client=app`)
 * wird im Browser NICHT eingelöst — die Landing bietet den Rücksprung in die App („In der App
 * öffnen“), ohne den Einmal-Token still zu verbrauchen.
 *
 * **Warum hier gemockt wird (Muster login.spec.ts):** Der Auth-Zustand hängt an realen Logins, die
 * in der E2E-Umgebung nicht deterministisch durchlaufbar sind. `GET /auth/me` wird mit 401 erwidert
 * — genau der Zustand, den TF3 verlangt („GET /auth/me bleibt 401“). POSTs auf
 * `/auth/magic-link/verify` werden mitgezählt: Sie dürfen nie auftreten.
 */

const APP_MAGIC_URL = '/app/?magic=tok-2563&client=app';

/** Beantwortet `GET /auth/me` mit 401 (unauthentifiziert) → die App zeigt Login/Landing. */
const erzwingeAbgemeldet = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Unauthorized' }),
		}),
	);
};

test.describe('Magic-Link-App-Landing (#2563)', () => {
	test('AK2: App-Marker-Link wird nicht verbraucht — Landing bietet den Rücksprung in die App', async ({ page }) => {
		await erzwingeAbgemeldet(page);
		const verifyAufrufe: string[] = [];
		page.on('request', (request: Request) => {
			if (request.url().includes('/auth/magic-link/verify')) verifyAufrufe.push(request.url());
		});
		const meAntwort = page.waitForResponse((response) => response.url().includes('/auth/me'));

		await page.goto(APP_MAGIC_URL);

		expect(await meAntwort.then((r) => r.status()), 'GET /auth/me bleibt 401').toBe(401);
		const ruecksprung = page.getByRole('link', { name: 'In der App öffnen' });
		await expect(ruecksprung).toBeVisible();
		await expect(ruecksprung).toHaveAttribute('href', /balamentum\.app:\/\/auth\/native\?magic=tok-2563/);
		expect(verifyAufrufe, 'Der Token darf im Browser nicht eingereicht werden').toEqual([]);
	});

	test('AK7: Landing bleibt bei schmalen Viewports ohne horizontalen Overflow bedienbar', async ({ page }) => {
		await erzwingeAbgemeldet(page);

		for (const breite of [375, 320]) {
			await page.setViewportSize({ width: breite, height: MOBILE.height });
			await page.goto(APP_MAGIC_URL);

			const ruecksprung = page.getByRole('link', { name: 'In der App öffnen' });
			await expect(ruecksprung).toBeVisible();

			// „Kein horizontaler Overflow“ ist per scrollWidth nicht messbar (App-Shell clippt);
			// die Assertion läuft deshalb über die Bounding-Box (Muster KI-UX-Block).
			const box = await ruecksprung.boundingBox();
			expect(box, `Rücksprung-Link bei ${breite}px gerendert`).not.toBeNull();
			if (!box) continue;
			expect(box.height, `Touch-Target bei ${breite}px`).toBeGreaterThanOrEqual(44);
			expect(box.x, `kein horizontaler Overflow bei ${breite}px`).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(breite);
		}
	});

	// #2565 (docs/spec/issue-2565.md AK1+AK4): Der Marker `client=app` muss die Landing auch bei
	// bestehender Browser-Session zeigen (/auth/me → 200) — heute gewinnt der authentifizierte
	// Zweig, der Token verfällt und der App-Login scheitert.
	test('AK1: Landing erscheint auch bei bestehender Browser-Session — Token bleibt unverbraucht', async ({ page }) => {
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com', termsAccepted: true }),
			}),
		);
		const verifyAufrufe: string[] = [];
		page.on('request', (request: Request) => {
			if (request.url().includes('/auth/magic-link/verify')) verifyAufrufe.push(request.url());
		});

		await page.goto(APP_MAGIC_URL);

		const ruecksprung = page.getByRole('link', { name: 'In der App öffnen' });
		await expect(ruecksprung).toBeVisible();
		await expect(ruecksprung).toHaveAttribute('href', /balamentum\.app:\/\/auth\/native\?magic=tok-2563/);
		expect(verifyAufrufe, 'Der Token darf im Browser nicht eingereicht werden (AK4)').toEqual([]);
	});
});
