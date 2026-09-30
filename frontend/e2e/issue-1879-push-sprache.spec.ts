import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1879 — App-Sprache für den Fürsorge-Push (Spec: docs/spec/issue-1879.md).
 *
 * - AK5: wechselt der Nutzer in den Einstellungen die Sprache, sendet das Frontend die neue
 *   Sprache per `PUT /api/v1/care-config/sprache` an den echten Server (kein `page.route`).
 */
test.describe('Balamentum — #1879: Push-Sprache', () => {
	test('AK5 — Sprachwechsel in den Einstellungen löst PUT /care-config/sprache mit dem neuen Code aus', async ({
		page,
	}) => {
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');

		const request = page.waitForRequest(
			(req) =>
				req.method() === 'PUT' && req.url().endsWith('/care-config/sprache') && req.postDataJSON()?.sprache === 'en',
		);
		// KoliBri-SingleSelect = Combobox (Muster series-rhythm.spec.ts); Endonym „English".
		await page.getByLabel('Sprache').click();
		await page.getByRole('option', { name: 'English' }).click();

		expect((await request).postDataJSON()).toEqual({ sprache: 'en' });
	});
});
