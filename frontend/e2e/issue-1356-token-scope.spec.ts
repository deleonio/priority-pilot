import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1356 (Spec docs/spec/issue-1356.md) — Rechte-Umschalter je Token im
 * Settings-Tab „Zugriff".
 *
 * - AK8: eine Token-Zeile zeigt „Nur lesend", nach dem Umschalten und einem Reload steht
 *   „Lesen und Schreiben" weiterhin da (Persistenz über die DB, nicht die Sitzung).
 * - AK9: bei 375px Viewportbreite bleibt die Zeile inkl. Umschalter und „Zurückziehen" ohne
 *   horizontales Scrollen bedienbar (Bounding-Box-Assertion statt `scrollWidth`, MEMORY 2026-08-24).
 *
 * Muster: issue-1352-api-tokens.spec.ts (echte Session über `/auth/test-login`, echtes Backend).
 */

const TEST_EMAIL = 'api-tokens-scope@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Scope Tester' },
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

test.describe('Priority Pilot — #1356: Rechte-Umschalter je Token', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTokens(page);
	});

	test('AK8: neuer Token zeigt „Nur lesend", nach Umschalten + Reload weiterhin „Lesen und Schreiben"', async ({
		page,
	}) => {
		await login(page);
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		// Test-Pflege (#1357, s. PR-Body): seit #1357 (AK1/AK6) ist die Laufzeit ein Pflichtfeld,
		// ohne die ist „Token erzeugen" wirkungslos.
		await page.getByTestId('api-token-duration-select').selectOption({ label: '365 Tage (12 Monate)' });
		await page.getByRole('button', { name: 'Token erzeugen' }).click();

		const row = page.getByTestId('api-token-row').first();
		await expect(row).toContainText('Nur lesend');

		const toggle = row.getByTestId('api-token-scope-toggle');
		await toggle.click();
		await expect(row).toContainText('Lesen und Schreiben');

		await page.reload();
		await waitForStableView(page, 'Allgemein');
		await expect(page.getByTestId('api-token-row').first()).toContainText('Lesen und Schreiben');
	});

	test('AK9: 375px — Token-Zeile inkl. Umschalter und „Zurückziehen" ohne horizontalen Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await page.getByTestId('api-token-duration-select').selectOption({ label: '365 Tage (12 Monate)' });
		await page.getByRole('button', { name: 'Token erzeugen' }).click();
		const row = page.getByTestId('api-token-row').first();
		await expect(row).toBeVisible();

		const box = await row.boundingBox();
		expect(box, 'Token-Zeile muss eine Bounding-Box haben').not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});
});
