import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #640 „LLM-Provider-Konfiguration: Backend-Config-API + Frontend-Settings-UI"
 * (Stufe 1 TDD, der einklagbare Vertrag). Teil Frontend/UI — Journey 6+7 aus docs/spec/issue-640.md.
 *
 * Ziel: Ein neuer Tab „LLM" in der bestehenden `SettingsPage` zeigt die persistierte
 * Mistral/OpenRouter-Konfiguration; API-Key-Felder sind als Passwort-Eingabe (maskiert) dargestellt.
 * Speichern zeigt Erfolgs-Feedback; nach einem Reload sind die Werte weiterhin vorhanden (Backend-
 * Persistenz aus Journey 2, nicht nur lokaler State).
 *
 * Diese Tests sind bewusst rot, bis der Tab „LLM", die maskierten Eingabefelder und die Anbindung an
 * `GET/PUT /llm-config` existieren. Sie sprechen das echte Backend an (kein API-Mock, wie in
 * `crud.spec.ts`/`settings-page.spec.ts`); `/auth/me` wird durch die Fixture authentifiziert, damit
 * die Frontend-Auth-Gate durchlässig ist — der Backend-Request selbst läuft im Pass-Through-Modus
 * (kein SESSION_SECRET im e2e-Dev-Server), analog zu den bestehenden Settings-Specs.
 */
test.describe('#640 Einstellungen – LLM-Tab', () => {
	/**
	 * AK4 (Journey 6) — Tab „LLM" existiert und zeigt die API-Key-Felder maskiert (type=password).
	 */
	test('AK4: LLM-Tab ist sichtbar, API-Key-Felder sind maskiert', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const llmTab = page.getByRole('tab', { name: 'LLM', exact: true });
		await expect(llmTab).toBeVisible();
		await llmTab.click();
		await expect(llmTab).toHaveAttribute('aria-selected', 'true');

		// Mind. zwei maskierte Eingabefelder (Mistral- + OpenRouter-Key).
		const passwordInputs = page.locator('input[type="password"]');
		await expect(passwordInputs).toHaveCount(2);
	});

	/**
	 * AK5 (Journey 7) — Speichern zeigt Erfolgs-Feedback; nach Reload bleibt der Status „gespeichert".
	 *
	 * SECURITY: Die gespeicherten API-Keys werden bewusst NICHT an den Client zurückgegeben
	 * (Write-Only). Nach Reload müssen die Eingabefelder daher LEER sein — der Secret-Wert verlässt
	 * nie den Server. Die UI signalisiert lediglich pro Provider, ob ein Key gesetzt ist.
	 */
	test('AK5: Speichern zeigt Erfolgsmeldung; nach Reload bleiben Felder leer, Status „gespeichert"', async ({
		page,
	}) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		const passwordInputs = page.locator('input[type="password"]');
		await passwordInputs.nth(0).fill('e2e-mistral-key');
		await passwordInputs.nth(1).fill('e2e-openrouter-key');

		await page.getByRole('button', { name: /Speichern/i }).click();

		await expect(page.getByRole('alert')).toBeVisible();

		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		// SECURITY: Keys werden nicht zurückgelesen — die Felder bleiben nach Reload leer.
		const reloadedInputs = page.locator('input[type="password"]');
		await expect(reloadedInputs.nth(0)).toHaveValue('');
		await expect(reloadedInputs.nth(1)).toHaveValue('');

		// Statt des Werts zeigt die UI nur den Status „gespeichert" je Provider.
		await expect(page.locator('[data-provider="mistral"]')).toContainText('gespeichert');
		await expect(page.locator('[data-provider="openrouter"]')).toContainText('gespeichert');
	});
});
