import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #788 „LLM-Einstellungsmenü optimieren"
 * (Spec-Phase: ausführbarer Vertrag aus docs/spec/issue-788.md).
 *
 * Ziel: Kompaktere Darstellung der LLM-Einstellungen mit verbesserter UX.
 * - API-Keys werden als Punkte (••••) direkt in den Eingabefeldern angezeigt
 * - X-Button zum Löschen direkt am InputPassword-Feld
 * - Keine separaten "Key gesetzt"-Anzeigen mehr
 * - Model-Auswahl als Single-Select (kein Modal)
 *
 * Siehe Ablauf: Spec-first → rote Tests → Draft-PR → Implementierung
 */
test.describe('#788 LLM-Einstellungsmenü optimieren', () => {
	/**
	 * Szenario 1 (Spec: API-Key-Eingabe mit Anzeige als Punkte)
	 * TC1: API-Key eingeben → Feld zeigt Punkte an, X-Button erscheint
	 */
	test('TC1: API-Key eingeben zeigt Punkte an, X-Button erscheint', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const llmTab = page.getByRole('tab', { name: 'LLM', exact: true });
		await expect(llmTab).toBeVisible();
		await llmTab.click();

		const passwordInput = page.locator('input[type="password"]').first();
		const xButton = page.locator('button[aria-label="API-Key löschen"]').first();

		// Initially: No X-Button visible (key not set)
		await expect(xButton).toHaveCount(0);

		// User types API-Key
		await passwordInput.fill('test-api-key');

		// Feld zeigt nur Punkte an (••••), nicht den Klartext
		await expect(passwordInput).toHaveValue(/.+/); // Masked characters

		// X-Button erscheint nach der Eingabe
		await expect(xButton).toBeVisible();
	});

	/**
	 * Szenario 2 (Spec: X-Button zum Löschen von Keys)
	 * TC2: X-Button klicken → Key wird gelöscht, Feld ist leer
	 */
	test('TC2: X-Button löscht Key, Feld ist leer, X-Button verschwindet', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		const passwordInput = page.locator('input[type="password"]').first();
		const xButton = page.locator('button[aria-label="API-Key löschen"]').first();

		// Set a key first
		await passwordInput.fill('test-api-key');
		await expect(xButton).toBeVisible();

		// Click X-Button to delete
		await xButton.click();

		// Feld ist leer
		await expect(passwordInput).toHaveValue('');

		// X-Button verschwindet nach dem Löschen
		await expect(xButton).toHaveCount(0);
	});

	/**
	 * Szenario 3 (Spec: Model-Auswahl als Single-Select)
	 * TC3: Model auswählen → Single-Select öffnet sich, Auswahl wird übernommen
	 */
	test('TC3: Model-Auswahl ist Single-Select, kein Modal', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		// OpenRouter-Provider sollte vorhanden sein
		const openRouterSection = page.locator('[data-provider="openrouter"]');
		await expect(openRouterSection).toBeVisible();

		// Model-Auswahl als Single-Select (nicht als Modal-Trigger)
		const modelSelect = page.locator('select[name="model"], [role="combobox"]').first();
		await expect(modelSelect).toBeVisible();

		// Klick öffnet ein Dropdown, kein Modal
		await modelSelect.click();

		// Kein Modal sichtbar, sondern Dropdown/Options
		const modal = page.locator('[role="dialog"]');
		await expect(modal).toHaveCount(0);
	});

	/**
	 * Szenario 4 (Spec: Mobile-First kompakteres UI)
	 * TC4: Gesamtbild prüfen: UI ist kompakter, keine redundante Anzeige
	 */
	test('TC4: UI ist kompakter, keine separaten "Key gesetzt"-Anzeigen', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		// KEINE separaten "Key gesetzt" Anzeigen mehr
		const statusText = page.getByText(/Key gesetzt/i);
		await expect(statusText).toHaveCount(0);

		// InputPassword-Felder sind direkt sichtbar
		const passwordInputs = page.locator('input[type="password"]');
		await expect(passwordInputs).toHaveCount(2); // Mistral + OpenRouter

		// X-Buttons sind nur bei gesetzten Keys sichtbar
		const xButtons = page.locator('button[aria-label="API-Key löschen"]');
		const setKeyCount = await passwordInputs.evaluateAll(
			(inputs) => inputs.filter((i) => (i as HTMLInputElement).value !== '').length,
		);
		await expect(xButtons).toHaveCount(setKeyCount);
	});

	/**
	 * Szenario 5 (Spec: Accessibility)
	 * A11y: Tastatur-Navigation, Screenreader-Labels
	 */
	test('A11y: X-Button ist tastatur-navigierbar und hat aria-label', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		const passwordInput = page.locator('input[type="password"]').first();

		// Set a key to make X-Button appear
		await passwordInput.fill('test-api-key');

		const xButton = page.locator('button[aria-label="API-Key löschen"]').first();
		await expect(xButton).toBeVisible();

		// X-Button hat aria-label
		await expect(xButton).toHaveAttribute('aria-label', 'API-Key löschen');

		// X-Button ist mit Tab erreichbar (fokussierbar)
		await xButton.focus();
		await expect(xButton).toBeFocused();

		// X-Button ist mit Enter/Space aktivierbar
		await xButton.press('Enter');
		await expect(passwordInput).toHaveValue(''); // Key wurde gelöscht
	});
});
