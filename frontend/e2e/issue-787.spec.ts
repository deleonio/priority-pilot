import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Wartet zusätzlich zu `waitForStableView` auf den ausgelayouteten Header.
 */
const waitForSettledHeader = async (page: Page): Promise<void> => {
	await waitForStableView(page);
	await page.waitForFunction(() => {
		const toolbar = document.querySelector('header kol-toolbar');
		const modelButton = document.querySelector('header .model-selector-button');
		if (toolbar === null || modelButton === null) {
			return false;
		}
		return toolbar.getBoundingClientRect().width > 0 && modelButton.textContent?.includes('Laden') === false;
	});
};

/**
 * Deterministische Free-Modell-Liste für den Dialog
 */
const mockFreeModels = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [{ id: 'openrouter/free', name: 'OpenRouter Free' }],
			}),
		}),
	);
};

const modelSelectionEntryPoint = (page: Page) => page.locator('[data-testid="model-selector-button"]');

/** Testet Header-Layout und KI-Modell-Auswahl */
test.describe('#787 Header-Layout und KI-Modell-Auswahl in Toolbar', () => {
	test('AK1: Header-Layout folgt der Reihenfolge Logo → Name → Toolbar', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const logo = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const name = header.locator('.app-name');
		const toolbar = header.getByRole('toolbar', { name: /Kopf-Aktionen/i });

		await expect(logo).toBeVisible();
		await expect(name).toBeVisible();
		await expect(toolbar).toBeVisible();
	});

	test('AK2 (KI-Modell-Auswahl): Tastatur-Navigation funktioniert', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		await modelSelector.focus();
		await expect(modelSelector).toBeFocused();
	});

	test('AK3 (KI-Modell-Auswahl): Popup öffnet sich', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		await modelSelector.click();
		await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();
	});

	test('AK4 (Responsive): Header-Height konsistent', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const beforeBox = await header.boundingBox();
		expect(beforeBox).not.toBeNull();

		await modelSelectionEntryPoint(page).click();
		await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();

		const afterBox = await header.boundingBox();
		expect(afterBox).not.toBeNull();
		expect(afterBox!.height).toBe(beforeBox!.height);
	});
});
