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
	const openFeedbackTab = async (page: import('@playwright/test').Page): Promise<void> => {
		await page.goto('/hilfe');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Feedback', exact: true }).click();
	};

	test('AK8: erfolgreiches Absenden zeigt eine Bestätigung und leert die Felder', async ({ page }) => {
		await page.route('**/api/v1/feedback', (route: Route) =>
			route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
		);

		await openFeedbackTab(page);
		await page.getByRole('combobox', { name: /Kategorie/ }).selectOption({ label: 'Fehler' });
		await page.getByRole('textbox', { name: /Titel/ }).fill('Login hängt');
		await page.getByRole('textbox', { name: /Beschreibung/ }).fill('Nach dem Login lädt nichts mehr.');
		await page.getByRole('button', { name: /Senden/ }).click();

		await expect(page.getByText(/gesendet|danke|erfolgreich/i)).toBeVisible();
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
		await page.getByRole('combobox', { name: /Kategorie/ }).selectOption({ label: 'Fehler' });
		await page.getByRole('textbox', { name: /Titel/ }).fill('Login hängt');
		await page.getByRole('textbox', { name: /Beschreibung/ }).fill('Nach dem Login lädt nichts mehr.');
		await page.getByRole('button', { name: /Senden/ }).click();

		await expect(page.getByText(/fehler|fehlgeschlagen/i)).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Titel/ })).toHaveValue('Login hängt');
		await expect(page.getByRole('textbox', { name: /Beschreibung/ })).toHaveValue('Nach dem Login lädt nichts mehr.');

		// Zweiter Versuch (kein stiller Verlust der Eingaben) führt jetzt zum Erfolg.
		await page.getByRole('button', { name: /Senden/ }).click();
		await expect(page.getByText(/gesendet|danke|erfolgreich/i)).toBeVisible();
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
