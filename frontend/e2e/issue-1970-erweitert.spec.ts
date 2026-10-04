import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1970: Die Anbieter-Konfiguration (KI-Provider-Karte) steht hinter einem
 * Klappbereich „Erweitert" (Spec docs/spec/issue-1970.md) — standardmäßig zu, Kopf immer
 * sichtbar, bei 375 px ohne horizontalen Overflow (zu und offen).
 */

/** Öffnet den KI-Tab der Einstellungen (ohne „Erweitert" anzufassen). */
const openLlmTab = async (page: import('@playwright/test').Page): Promise<void> => {
	await page.goto('/app/settings/llm');
	await waitForStableView(page, 'Balamentum');
	await expect(page.getByRole('tab', { name: 'KI', exact: true })).toBeVisible();
};

test.describe('KI-Anbieter-Konfiguration hinter „Erweitert" (#1970)', () => {
	test('AK1: standardmäßig zu — keine Provider-Bedienelemente sichtbar, Öffnen zeigt sie', async ({ page }) => {
		await openLlmTab(page);

		const trigger = page.getByText('Erweitert', { exact: true });
		await expect(trigger).toBeVisible();
		await expect(page.getByRole('button', { name: 'Neuer Provider' })).toBeHidden();
		await expect(page.locator('kol-input-radio[_label="KI-Provider"]')).toBeHidden();

		await trigger.click();
		await expect(page.getByRole('button', { name: 'Neuer Provider' })).toBeVisible();
		await expect(page.locator('kol-input-radio[_label="KI-Provider"]')).toBeVisible();
	});

	test('AK4: 375×812 — kein Element ragt über den Viewport, „Erweitert" klickbar (zu und offen)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openLlmTab(page);

		// Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x:hidden (Muster #1549 AK8).
		const overflows = () =>
			page
				.locator('.settings-page *:visible')
				.evaluateAll(
					(els) =>
						els
							.map((el) => el.getBoundingClientRect())
							.filter((box) => box.width > 0 && (box.right > 375.5 || box.left < -0.5)).length,
				);

		await expect(page.getByText('Erweitert', { exact: true })).toBeVisible();
		expect(await overflows(), 'zu: kein Overflow').toBe(0);

		await page.getByText('Erweitert', { exact: true }).click();
		await expect(page.getByRole('button', { name: 'Neuer Provider' })).toBeVisible();
		expect(await overflows(), 'offen: kein Overflow').toBe(0);
	});
});
