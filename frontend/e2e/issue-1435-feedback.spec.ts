import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für Issue #1435 — Feedback direkt in Obsidian (AK8–AK10).
 *
 * Vertrag (docs/spec/issue-1435.md): ein vierter Hilfe-Tab „Feedback" (Kategorie, Titel,
 * Beschreibung, Senden-Button). Erfolg → Bestätigung sichtbar, Felder geleert (AK8). Fehler →
 * sichtbare Fehlermeldung, Eingaben bleiben erhalten, erneutes Senden möglich (AK9). Bei 375px
 * Viewportbreite ragt kein Formularelement über die Viewportbreite hinaus (AK10).
 *
 * `POST /api/v1/feedback` wird per `page.route` abgefangen — kein echter GitHub-Aufruf im Test.
 */
test.describe('Feedback direkt in Obsidian (#1435)', () => {
	/**
	 * Die Status-Meldung wird im Alert des Formulars geprüft, nicht seitenweit: „Fehler" steht auch
	 * in der Einleitung und als Kategorie-Option (die `selectOption({ label: 'Fehler melden' })` oben
	 * braucht), „gesendet" im Button-Label während des Sendens — ein seitenweites `getByText`
	 * verletzt deshalb zwangsläufig den Strict Mode. Muster: `bahn.spec.ts:176`.
	 */
	const statusAlert = (page: import('@playwright/test').Page) => page.locator('.feedback-form kol-alert');

	const openFeedbackTab = async (page: import('@playwright/test').Page): Promise<void> => {
		await page.goto('/hilfe');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Feedback', exact: true }).click();
	};

	/**
	 * #1475 AK1: Das Kategorie-Select fasst die bisherigen vier Optionen zu drei zusammen —
	 * Label-Vertrag: „Fragen und Hilfe" (frage), „Wünsche und Ideen" (wunsch), „Fehler melden"
	 * (bug), in genau dieser Reihenfolge. Die Vorauswahl bleibt die Fehler-Kategorie (Wert `bug`).
	 */
	test('AK1 (#1475): Kategorie-Select bietet genau die drei neuen Optionen in Reihenfolge, Vorauswahl ist die Fehler-Kategorie', async ({
		page,
	}) => {
		await openFeedbackTab(page);

		const combobox = page.getByRole('combobox', { name: /Kategorie/ });
		await expect(combobox).toBeVisible();
		const options = (await combobox.locator('option').allTextContents()).map((label) => label.trim());
		expect(options).toEqual(['Fragen und Hilfe', 'Wünsche und Ideen', 'Fehler melden']);
		// Test-Pflege (#1475, Impl-Phase; Muster #1357): KolSelect schreibt der nativen <option>
		// einen synthetischen Index-Key (z. B. "-2"), nie den logischen `_options`-Wert —
		// `toHaveValue('bug')` ist damit unerfüllbar. Die Vorauswahl wird über die gewählte
		// Option geprüft (Wert `bug` wird in AK8/AK9 über die API-Mock-Payload mitgedeckt).
		await expect
			.poll(async () => combobox.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim() ?? ''))
			.toBe('Fehler melden');
	});

	test('AK8: erfolgreiches Absenden zeigt eine Bestätigung und leert die Felder', async ({ page }) => {
		await page.route('**/api/v1/feedback', (route: Route) =>
			route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
		);

		await openFeedbackTab(page);
		await page.getByRole('combobox', { name: /Kategorie/ }).selectOption({ label: 'Fehler melden' });
		await page.getByRole('textbox', { name: /Titel/ }).fill('Login hängt');
		await page.getByRole('textbox', { name: /Beschreibung/ }).fill('Nach dem Login lädt nichts mehr.');
		await page.getByRole('button', { name: /Senden/ }).click();

		await expect(statusAlert(page)).toBeVisible();
		await expect(statusAlert(page)).toContainText(/gesendet|danke|erfolgreich/i);
		await expect(page.getByRole('textbox', { name: /Titel/ })).toHaveValue('');
		await expect(page.getByRole('textbox', { name: /Beschreibung/ })).toHaveValue('');
	});

	test('AK9: fehlgeschlagenes Absenden zeigt eine Fehlermeldung, Eingaben bleiben erhalten, erneutes Senden ist möglich', async ({
		page,
	}) => {
		let callCount = 0;
		await page.route('**/api/v1/feedback', (route: Route) => {
			callCount += 1;
			if (callCount === 1) {
				return route.fulfill({
					status: 502,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Upstream-Fehler' }),
				});
			}
			return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
		});

		await openFeedbackTab(page);
		await page.getByRole('combobox', { name: /Kategorie/ }).selectOption({ label: 'Fehler melden' });
		await page.getByRole('textbox', { name: /Titel/ }).fill('Login hängt');
		await page.getByRole('textbox', { name: /Beschreibung/ }).fill('Nach dem Login lädt nichts mehr.');
		await page.getByRole('button', { name: /Senden/ }).click();

		await expect(statusAlert(page)).toBeVisible();
		await expect(statusAlert(page)).toContainText(/fehler|fehlgeschlagen/i);
		await expect(page.getByRole('textbox', { name: /Titel/ })).toHaveValue('Login hängt');
		await expect(page.getByRole('textbox', { name: /Beschreibung/ })).toHaveValue('Nach dem Login lädt nichts mehr.');

		// Zweiter Versuch (kein stiller Verlust der Eingaben) führt jetzt zum Erfolg.
		await page.getByRole('button', { name: /Senden/ }).click();
		await expect(statusAlert(page)).toContainText(/gesendet|danke|erfolgreich/i);
		expect(callCount).toBe(2);
	});

	test('AK10: bei 375×812 ragt kein Element des Feedback-Formulars über die Viewportbreite hinaus', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openFeedbackTab(page);

		const elements = [
			page.getByRole('combobox', { name: /Kategorie/ }),
			page.getByRole('textbox', { name: /Titel/ }),
			page.getByRole('textbox', { name: /Beschreibung/ }),
			page.getByRole('button', { name: /Senden/ }),
		];
		for (const element of elements) {
			const box = await element.boundingBox();
			expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
});
