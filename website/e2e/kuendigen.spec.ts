import { expect, test } from '@playwright/test';

/**
 * #2317 (Vertrag: docs/spec/issue-2317.md) — Kündigung ohne Login: Formular absenden, Rückmeldung
 * sichtbar, kein Überlauf (Bounding-Box statt scrollWidth). Die Website-E2E läuft ohne Backend,
 * deshalb ist der Anfrage-Endpunkt gestubbt.
 */
test.describe('Kündigung ohne Login (#2317)', () => {
	test('Formular absenden zeigt die Rückmeldung, ohne horizontalen Überlauf (AK2, AK7)', async ({ page }) => {
		let sent: Record<string, unknown> | undefined;
		await page.route('**/api/v1/public/cancellation/request', async (route) => {
			sent = route.request().postDataJSON() as Record<string, unknown>;
			await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
		});
		await page.goto('/kuendigen/');

		const viewport = page.viewportSize()?.width ?? 375;
		for (const element of await page.locator('[data-cancel-form] :is(input:visible, select, button, label)').all()) {
			const box = await element.boundingBox();
			if (box) expect(box.x + box.width).toBeLessThanOrEqual(viewport);
		}

		await page.getByLabel('E-Mail-Adresse deines Kontos (Pflichtfeld)').fill('kunde@example.com');
		await page.getByText('Außerordentlich', { exact: true }).click();
		await page.getByLabel('Grund der außerordentlichen Kündigung (Pflichtfeld)').fill('Umzug ins Ausland');
		await page.getByRole('button', { name: 'Jetzt kündigen' }).click();

		await expect(page.getByRole('status')).toContainText('Bestätigungslink');
		expect(sent).toMatchObject({ email: 'kunde@example.com', kind: 'extraordinary', reason: 'Umzug ins Ausland' });
	});
});
