import { test, expect } from '@playwright/test';

test.describe('LLM Provider Toggle UI – Spec: Issue-749', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to app
		await page.goto('/');
	});

	test('should display provider toggle switches – Spec: Issue-749 Journey Step 1', async ({ page }) => {
		// Arrange: App is loaded
		// Act: Look for provider toggle UI
		// Assert: Two toggle switches are visible: "Mistral" and "OpenRouter"
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });
		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });

		await expect(mistralToggle).toBeVisible();
		await expect(openrouterToggle).toBeVisible();
	});

	test('should highlight active provider – Spec: Issue-749 Journey Step 1', async ({ page }) => {
		// Arrange: Mistral provider is active
		// Act: Check visual state
		// Assert: Mistral toggle is highlighted, OpenRouter is grayed out
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });
		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });

		await expect(mistralToggle).toHaveAttribute('aria-checked', 'true');
		await expect(openrouterToggle).toHaveAttribute('aria-checked', 'false');
	});

	test('should switch provider on click – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: Mistral is active
		// Act: Click OpenRouter toggle
		// Assert: OpenRouter becomes active, Mistral becomes inactive
		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });

		await openrouterToggle.click();

		await expect(openrouterToggle).toHaveAttribute('aria-checked', 'true');
		await expect(mistralToggle).toHaveAttribute('aria-checked', 'false');
	});

	test('should show toast notification on provider switch – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: App is loaded
		// Act: Switch provider
		// Assert: Toast notification appears "Provider gewechselt: [Provider Name]"
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });

		await mistralToggle.click();

		const toast = page.getByText(/Provider gewechselt/);
		await expect(toast).toBeVisible();
	});

	test('should persist provider selection after page reload – Spec: Issue-749 Journey Step 4', async ({ page }) => {
		// Arrange: User selects OpenRouter provider
		// Act: Reload page
		// Assert: OpenRouter is still active

		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });
		await openrouterToggle.click();

		await page.reload();

		const persistedToggle = page.getByRole('switch', { name: 'OpenRouter' });
		await expect(persistedToggle).toHaveAttribute('aria-checked', 'true');
	});

	test('should enforce exclusive provider selection – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		// Arrange: Both toggles are visible
		// Act: Activate Mistral, then OpenRouter
		// Assert: Only one provider is active at a time
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });
		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });

		await mistralToggle.click();
		await expect(mistralToggle).toHaveAttribute('aria-checked', 'true');

		await openrouterToggle.click();
		await expect(openrouterToggle).toHaveAttribute('aria-checked', 'true');
		await expect(mistralToggle).toHaveAttribute('aria-checked', 'false');
	});

	test('should have minimum touch target size (44px) on mobile – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		// Arrange: Viewport is mobile size
		// Act: Check toggle dimensions
		// Assert: Touch targets are at least 44px high
		await page.setViewportSize({ width: 375, height: 667 });

		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });
		const box = await mistralToggle.boundingBox();

		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test('should stack toggles vertically on mobile – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		// Arrange: Mobile viewport (<768px)
		// Act: Check toggle positioning
		// Assert: Toggles are stacked vertically
		await page.setViewportSize({ width: 375, height: 667 });

		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });
		const openrouterToggle = page.getByRole('switch', { name: 'OpenRouter' });

		const mistralBox = await mistralToggle.boundingBox();
		const openrouterBox = await openrouterToggle.boundingBox();

		// OpenRouter should be below Mistral (y-coordinate is greater)
		expect(openrouterBox!.y).toBeGreaterThan(mistralBox!.y);
	});

	test('should support keyboard navigation – Spec: Issue-749 UX A11y/BITV', async ({ page }) => {
		// Arrange: Toggles are visible
		// Act: Navigate with Tab, activate with Space/Enter
		// Assert: Toggle can be operated without mouse
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });

		await page.keyboard.press('Tab');
		await page.keyboard.press('Space');

		await expect(mistralToggle).toHaveAttribute('aria-checked', 'true');
	});

	test('should have proper ARIA attributes – Spec: Issue-749 UX A11y/BITV', async ({ page }) => {
		// Arrange: Toggles are rendered
		// Act: Inspect ARIA attributes
		// Assert: role="switch", aria-checked, aria-label are correct
		const mistralToggle = page.getByRole('switch', { name: 'Mistral' });

		await expect(mistralToggle).toHaveAttribute('role', 'switch');
		await expect(mistralToggle).toHaveAttribute('aria-label', /Mistral Provider/);
		await expect(mistralToggle).toHaveAttribute('aria-checked'); // either true or false
	});

	test('should use KoliBri toggle components – Spec: Issue-749 UX KoliBri', async ({ page }) => {
		// Arrange: Toggles are rendered
		// Act: Inspect component structure
		// Assert: kol-toggle-group or kol-toggle-button is used
		const toggleGroup = page.locator('kol-toggle-group, kol-toggle-button');

		await expect(toggleGroup.first()).toBeVisible();
	});
});
