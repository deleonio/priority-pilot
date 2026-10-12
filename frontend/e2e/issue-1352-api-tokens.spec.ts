import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1352 (Spec docs/spec/issue-1352.md) — Settings-Tab „Zugriff" (API-Tokens).
 *
 * - AK8: „Token erzeugen" zeigt den Klartext genau einmal; nach Reload sind nur noch die
 *   Metadaten (Name, Datum) sichtbar, kein Klartext mehr.
 * - AK9: bei 375px Viewportbreite ist das Panel ohne horizontalen Overflow bedienbar; der
 *   Klartext-Token bricht um statt die Seite zu verbreitern (Bounding-Box-Assertion statt
 *   `scrollWidth`, MEMORY 2026-08-24 — die App-Shell clippt mit `overflow-x: hidden`).
 *
 * Läuft gegen das echte Backend (Vite-Proxy) wie llm-settings.spec.ts. Anders als die übrigen
 * funktionalen Specs braucht diese eine **echte** Session: die Token-Routen sind pro Nutzer
 * gebunden und antworten ohne `req.session.user` mit 401 (`getUserId()` ist im Pass-Through-Modus
 * `undefined`, siehe `server/src/express/requireAuth.ts`). Der Login läuft daher über
 * `POST /auth/test-login` (Muster issue-1252-handover.spec.ts); `page.request` teilt den
 * Cookie-Jar des Browser-Kontexts, die UI-Aufrufe tragen den Session-Cookie damit mit.
 */

const TEST_EMAIL = 'api-tokens@example.com';

/** Legt eine echte Session im Kontext der Page an — ohne sie liefern die Token-Routen 401. */
const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Token Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
};

const deleteAllTokens = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/api-tokens');
	if (!res.ok()) return;
	for (const token of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/api-tokens/${token.id}`);
	}
};

test.describe('Balamentum — #1352: API-Tokens (Settings-Tab „Zugriff")', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTokens(page);
	});

	test('AK8: Klartext erscheint genau einmal, nach Reload nur noch Metadaten', async ({ page }) => {
		await login(page);
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const panel = page.getByTestId('api-tokens-panel');
		await expect(panel).toBeVisible();

		// Test-Pflege (#1357, s. PR-Body): seit #1357 (AK1/AK6) ist die Laufzeit ein Pflichtfeld,
		// ohne die ist „Token erzeugen" wirkungslos.
		await page.getByTestId('api-token-duration-select').selectOption({ label: '365 Tage (12 Monate)' });
		await page.getByRole('button', { name: 'Token erzeugen' }).click();

		const plaintext = page.getByTestId('api-token-plaintext');
		await expect(plaintext).toBeVisible();
		const tokenText = (await plaintext.textContent())?.trim() ?? '';
		expect(tokenText.length).toBeGreaterThan(10);

		await page.reload();
		await waitForStableView(page, 'Allgemein');
		await expect(page.getByTestId('api-tokens-panel')).toBeVisible();
		// Nach Reload: kein Klartext mehr, nur die Zeile mit Name/Datum.
		await expect(page.getByTestId('api-token-plaintext')).toHaveCount(0);
		await expect(page.getByTestId('api-token-row')).toHaveCount(1);
		await expect(page.getByTestId('api-token-row').first()).not.toContainText(tokenText);
	});

	test('AK9: 375px — Panel ohne horizontalen Overflow, Klartext bricht um', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await page.getByTestId('api-token-duration-select').selectOption({ label: '365 Tage (12 Monate)' });
		await page.getByRole('button', { name: 'Token erzeugen' }).click();
		const plaintext = page.getByTestId('api-token-plaintext');
		await expect(plaintext).toBeVisible();

		const box = await plaintext.boundingBox();
		expect(box, 'Klartext-Anzeige muss eine Bounding-Box haben').not.toBeNull();
		// Bounding-Box darf den Viewport nicht überragen (kein horizontales Scrollen, AK9).
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});

	test('#2499 AK4: 375px — Widerrufen der Geräte-Zeile mindestens 44px hoch, nichts geclippt', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		// kind:'app'-Tokens entstehen nur im nativen Android-Login (Google-ID-Token-Flow) — im E2E
		// nicht herstellbar, daher gezielter Mock der Liste (page.route-Regel der E2E-Doku).
		await page.route('**/api/v1/api-tokens', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 42,
						name: 'Pixel 8',
						kind: 'app',
						scope: 'read',
						createdAt: '2026-01-05T10:00:00.000Z',
						lastUsedAt: '2026-02-10T09:30:00.000Z',
						expiresAt: null,
					},
				]),
			}),
		);
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const section = page.getByTestId('api-devices-section');
		await expect(section, 'Abschnitt "Angemeldete Geräte" fehlt (rote Spec, #2499)').toBeVisible();
		const revoke = section.getByRole('button', { name: 'Widerrufen' });
		await expect(revoke).toBeVisible();

		// Bounding-Box statt scrollWidth (App-Shell clippt mit overflow-x:hidden) und Nachmessen bis
		// das Layout steht (boundingBox kann einmalig null liefern, Muster ai-disable.spec.ts).
		let box: { x: number; y: number; width: number; height: number } | null = null;
		for (let attempt = 0; attempt < 30 && box === null; attempt++) {
			box = await revoke.boundingBox();
			if (box === null) await page.waitForTimeout(100);
		}
		expect(box, 'Widerrufen-Button muss messbar sein').not.toBeNull();
		expect(box!.height, 'Touch-Target mindestens 44px hoch').toBeGreaterThanOrEqual(44);
		expect(box!.x + box!.width, 'nichts über den 375px-Viewport hinaus geclippt').toBeLessThanOrEqual(375 + 1);
	});
});
