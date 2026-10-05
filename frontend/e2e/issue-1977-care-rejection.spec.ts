import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1977 (docs/spec/issue-1977.md): „Nicht jetzt" öffnet eine Inline-Grundauswahl
 * (fünf Gründe), nach dem Speichern rückt die nächste Empfehlung nach. ROT, bis CareHint die
 * Grundauswahl anbietet. Der Rejections-POST wird wie bei #1793 (AK3) per `page.route` bedient —
 * das E2E-Backend läuft im Pass-Through-Modus ohne Sitzung (CSRF-Token-Fetch im Weg).
 */
const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

test.describe('Dashboard — „Nicht jetzt" mit Grund (Issue #1977)', () => {
	test('AK5: bei 375 px Grundauswahl bedienbar ohne Überlauf — danach rückt die nächste Empfehlung nach', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		const vorschlagVorher = await hint.locator('p').first().textContent();

		await page.getByRole('button', { name: 'Nicht jetzt' }).click();

		// Test-Pflege #1977 (KoliBri-Realität): KolInputRadio rendert ein `fieldset` im Shadow-DOM
		// (Implizite Rolle `group`, keine `radiogroup`) — die Auswahl wird über den Host im Hinweis
		// gescopet, die Optionszeilen sind die Shadow-Labels (44 px Mindesthöhe über --a11y-min-size).
		const gruppe = hint.locator('kol-input-radio');
		await expect(gruppe).toBeVisible();
		const optionen = gruppe.getByRole('radio');
		await expect(optionen).toHaveCount(5);
		for (const hoehe of await gruppe
			.locator('label.kol-input-radio')
			.evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height))) {
			expect(hoehe).toBeGreaterThanOrEqual(44);
		}
		const hintBox = await hint.boundingBox();
		expect(hintBox!.x).toBeGreaterThanOrEqual(0);
		expect(hintBox!.x + hintBox!.width).toBeLessThanOrEqual(375 + 1);

		await page.route('**/scores/care-suggestions/rejections', (route) => route.fulfill({ status: 204 }));
		await optionen.nth(2).click();
		await page.getByRole('button', { name: 'Grund speichern' }).click();

		await expect(gruppe).toHaveCount(0);
		await expect(hint).toBeVisible();
		await expect(hint).not.toContainText(vorschlagVorher!);
	});
});
