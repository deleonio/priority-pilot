import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * #1787 AK2/AK5/AK6: Paket-Hinweis an der Grenzstelle `groups` (Modal „Gruppe anlegen"), Free-Konto
 * gegen das echte Backend (Muster `issue-1484-plan-badges.spec.ts`), 375 px. AK1/AK3/AK5-Details
 * decken die Unit-Tests in `PlanHint.test.tsx`.
 */
const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: 'plan-hint-1787@example.com', displayName: 'Hint Tester' },
	});
	expect(res.status()).toBe(200);
	// Der Fixture-Mock von `/auth/me` liefert keine Entitlements — hier die echte Serverantwort.
	await page.unroute('**/auth/me');
};

test('#1787: Hinweis im Gruppen-Dialog ist per Tastatur schließbar, Eingabe bleibt, kein Überlauf', async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await login(page);
	await page.goto('/app/settings/gruppen');
	await waitForStableView(page, 'Allgemein');
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();

	const hint = page.getByTestId('plan-hint-groups');
	await expect(hint).toBeVisible();
	await expect(hint).toContainText('Plus');
	await expect(page.getByRole('dialog')).toHaveCount(1);

	const box = await hint.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

	await page.getByRole('searchbox', { name: 'Name' }).fill('Mein Gruppenname');
	await hint.getByRole('button').first().focus();
	await page.keyboard.press('Enter');

	await expect(hint).toBeHidden();
	await expect(page.getByRole('dialog')).toHaveCount(1);
	await expect(page.getByRole('searchbox', { name: 'Name' })).toHaveValue('Mein Gruppenname');
});
