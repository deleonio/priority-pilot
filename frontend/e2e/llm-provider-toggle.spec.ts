import { test, expect } from '@playwright/test';

test.describe('LLM Provider Toggle UI – Spec: Issue-749', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to app and open Settings page
		await page.goto('/');
		await page.getByRole('button', { name: 'Einstellungen' }).click();
		// Select LLM tab (index 2, labeled "LLM")
		const llmTab = page.getByRole('tab', { name: 'LLM', exact: true });
		await llmTab.click();
		// Wait for tab panel to become visible
		const llmTabPanel = page.getByRole('tabpanel').filter({ hasText: /LLM-Provider/ });
		await expect(llmTabPanel).toBeVisible();
	});

	test('should display provider toggle switches – Spec: Issue-749 Journey Step 1', async ({ page }) => {
		// Arrange: App is loaded
		// Act: Look for provider toggle UI (KolInputRadio with radio buttons)
		// Assert: Radio options for Mistral and OpenRouter are visible
		const mistralRadio = page.locator('input[value="mistral"]');
		const openrouterRadio = page.locator('input[value="openrouter"]');

		await expect(mistralRadio).toBeVisible();
		await expect(openrouterRadio).toBeVisible();
	});

	test('should highlight active provider – Spec: Issue-749 Journey Step 1', async ({ page }) => {
		// Arrange: Mistral provider is active
		// Act: Check visual state
		// Assert: Mistral radio is checked, OpenRouter is unchecked
		const mistralRadio = page.locator('input[value="mistral"]');
		const openrouterRadio = page.locator('input[value="openrouter"]');

		await expect(mistralRadio).toHaveAttribute('aria-checked', 'true');
		await expect(openrouterRadio).toHaveAttribute('aria-checked', 'false');
	});

	test('should switch provider on click – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: Mistral is active
		// Act: Click OpenRouter radio
		// Assert: OpenRouter becomes active, Mistral becomes inactive
		const openrouterRadio = page.locator('input[value="openrouter"]');
		const mistralRadio = page.locator('input[value="mistral"]');

		await openrouterRadio.click();

		await expect(openrouterRadio).toHaveAttribute('aria-checked', 'true');
		await expect(mistralRadio).toHaveAttribute('aria-checked', 'false');
	});

	test('should show toast notification on provider switch – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: App is loaded
		// Act: Switch provider
		// Assert: Toast notification appears "Provider gewechselt: [Provider Name]"
		const mistralRadio = page.locator('input[value="mistral"]');

		await mistralRadio.click();

		const toast = page.getByText(/Provider gewechselt/);
		await expect(toast).toBeVisible();
	});

	test('should persist provider selection after page reload – Spec: Issue-749 Journey Step 4', async ({ page }) => {
		// Arrange: User selects OpenRouter provider
		// Act: Reload page
		// Assert: OpenRouter is still active

		const openrouterRadio = page.locator('input[value="openrouter"]');
		await openrouterRadio.click();

		await page.reload();

		// Reopen Settings after reload
		await page.getByRole('button', { name: 'Einstellungen' }).click();

		const persistedRadio = page.locator('input[value="openrouter"]');
		await expect(persistedRadio).toHaveAttribute('aria-checked', 'true');
	});

	test('should enforce exclusive provider selection – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: Both radios are visible
		// Act: Activate Mistral, then OpenRouter
		// Assert: Only one provider is active at a time
		const mistralRadio = page.locator('input[value="mistral"]');
		const openrouterRadio = page.locator('input[value="openrouter"]');

		await mistralRadio.click();
		await expect(mistralRadio).toHaveAttribute('aria-checked', 'true');

		await openrouterRadio.click();
		await expect(openrouterRadio).toHaveAttribute('aria-checked', 'true');
		await expect(mistralRadio).toHaveAttribute('aria-checked', 'false');
	});

	test('should have minimum touch target size (44px) on mobile – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		// Arrange: Viewport is mobile size
		// Act: Check radio dimensions
		// Assert: Touch targets are at least 44px high
		await page.setViewportSize({ width: 375, height: 667 });

		const mistralRadio = page.locator('input[value="mistral"]');
		const box = await mistralRadio.boundingBox();

		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test('should stack radios vertically on mobile – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		// Arrange: Mobile viewport (<768px)
		// Act: Check radio positioning
		// Assert: Radios are stacked vertically
		await page.setViewportSize({ width: 375, height: 667 });

		const mistralRadio = page.locator('input[value="mistral"]');
		const openrouterRadio = page.locator('input[value="openrouter"]');

		const mistralBox = await mistralRadio.boundingBox();
		const openrouterBox = await openrouterRadio.boundingBox();

		// OpenRouter should be below Mistral (y-coordinate is greater)
		expect(openrouterBox!.y).toBeGreaterThan(mistralBox!.y);
	});

	test('should support keyboard navigation – Spec: Issue-749 UX A11y/BITV', async ({ page }) => {
		// Arrange: Radios are visible
		// Act: Navigate with Tab, activate with Space/Enter
		// Assert: Radio can be operated without mouse
		const mistralRadio = page.locator('input[value="mistral"]');

		await page.keyboard.press('Tab');
		await page.keyboard.press('Space');

		await expect(mistralRadio).toHaveAttribute('aria-checked', 'true');
	});

	test('should have proper ARIA attributes – Spec: Issue-749 UX A11y/BITV', async ({ page }) => {
		// Arrange: Radios are rendered
		// Act: Inspect ARIA attributes
		// Assert: role="radio", aria-checked, aria-label are correct
		const mistralRadio = page.locator('input[value="mistral"]');

		await expect(mistralRadio).toHaveAttribute('role', 'radio');
		await expect(mistralRadio).toHaveAttribute('aria-label', /Mistral/);
		await expect(mistralRadio).toHaveAttribute('aria-checked'); // either true or false
	});

	test('should use KoliBri radio component – Spec: Issue-749 UX KoliBri', async ({ page }) => {
		// Arrange: Radios are rendered
		// Act: Inspect component structure
		// Assert: kol-input-radio is used
		const radioComponent = page.locator('kol-input-radio');

		await expect(radioComponent.first()).toBeVisible();
	});
});
