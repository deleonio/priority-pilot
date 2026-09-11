import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1357 (Spec docs/spec/issue-1357.md) — Settings-Tab „Zugriff" (API-Tokens),
 * Pflicht-Ablaufdatum.
 *
 * - AK8: bei 375px Viewportbreite sind Laufzeit-Auswahl, „Token erzeugen" und die
 *   Ablaufdatum-Angabe ohne horizontales Scrollen bedien-/lesbar (Bounding-Box-Assertion statt
 *   `scrollWidth`, MEMORY 2026-08-24 — die App-Shell clippt mit `overflow-x: hidden`).
 *
 * Läuft gegen das echte Backend (Vite-Proxy), Muster `issue-1352-api-tokens.spec.ts`: die
 * Token-Routen sind pro Nutzer gebunden und antworten ohne echte Session mit 401, daher Login über
 * `POST /auth/test-login`.
 */

const TEST_EMAIL = 'api-tokens-expiry@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Token Expiry Tester' },
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

test.describe('Priority Pilot — #1357: Pflicht-Ablaufdatum für API-Tokens', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTokens(page);
	});

	test('AK8: 375px — Laufzeit-Auswahl, Erzeugen-Button und Ablaufdatum ohne horizontalen Overflow', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const panel = page.getByTestId('api-tokens-panel');
		await expect(panel).toBeVisible();

		const durationSelect = page.getByTestId('api-token-duration-select');
		await expect(durationSelect).toBeVisible();
		// Test-Pflege (#1357, s. PR-Body): KolSelect schreibt auf die native <option> stets einen
		// synthetischen Index-Key (z. B. "-4"), nie den logischen `_options`-Wert — `selectOption('365')`
		// kann dagegen nie matchen. Auswahl über das sichtbare Label trifft dieselbe Option und liefert
		// über KoliBris onChange-Facade weiterhin den echten Wert ("365") an die Komponente.
		await durationSelect.selectOption({ label: '365 Tage (12 Monate)' });

		await page.getByRole('button', { name: 'Token erzeugen' }).click();

		const row = page.getByTestId('api-token-row').first();
		await expect(row).toBeVisible();
		await expect(row).toContainText(/\d{2}\.\d{2}\.\d{4}/);

		for (const locator of [durationSelect, page.getByRole('button', { name: 'Token erzeugen' }), row]) {
			const box = await locator.boundingBox();
			expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
