import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1873 (docs/spec/issue-1873.md, AK5/AK8): Der Fürsorge-Hinweis kennzeichnet einen
 * KI-Vorschlag sichtbar und bleibt bei 375 px ohne Überlauf. Nur `GET /scores/care-suggestions` ist
 * gemockt (der LLM-Aufruf läuft serverseitig und ist im E2E nicht echt herstellbar).
 * ROT, bis `CareHint` die Kennzeichnung (`data-testid="care-hint-ki"`) rendert.
 */
test.describe('Dashboard — KI-Kennzeichnung im Fürsorge-Hinweis (Issue #1873)', () => {
	test('AK5/AK8: KI-Kennzeichnung sichtbar, bei 375 px innerhalb des Viewports', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.route('**/api/v1/scores/care-suggestions', (route) =>
			route.fulfill({
				json: {
					vorschlaege: [
						{
							typ: 'ki',
							titel: 'Mit Anna wandern gehen',
							beschreibung: 'Du planst öfter Bewegung mit Freunden.',
							saeuleId: 1,
							saeuleName: 'Körper',
							saeulenBeitraege: [{ pillarId: 1, share: 100 }],
							anlass: 'defizit',
						},
					],
				},
			}),
		);
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		const hint = page.getByTestId('care-hint');
		const kennzeichnung = page.getByTestId('care-hint-ki');
		await expect(hint).toBeVisible();
		await expect(kennzeichnung).toBeVisible();
		for (const el of [hint, kennzeichnung]) {
			const box = await el.boundingBox();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
