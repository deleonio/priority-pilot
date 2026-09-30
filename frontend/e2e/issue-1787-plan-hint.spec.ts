import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * #1787 AK1/AK2/AK4/AK5/AK6: Paket-Hinweis an der Grenzstelle `groups` (Modal „Gruppe anlegen"), Free-Konto
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

test('#1787 AK1: Hinweis an graph_weight (Modal-Link mit App-Basis) und location_reminders', async ({ page }) => {
	await login(page);
	const created = await page.request.post('/api/v1/tasks', {
		data: { title: 'Hinweis Aufgabe', priority: 3, estimatedEffort: 0.5 },
	});
	const { id } = (await created.json()) as { id: number };
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

	const item = page.getByTestId(`task-list-item-${id}`);
	await item.getByRole('button', { name: 'Weitere Aktionen' }).click();
	await item.getByRole('button', { name: 'Abhängigkeiten' }).click();
	const modalHint = page.getByTestId('plan-hint-graph_weight');
	await expect(modalHint).toBeVisible();
	await expect(modalHint.getByRole('link', { name: 'Pakete ansehen' })).toHaveAttribute('href', '/app/settings/pakete');
	await page.request.delete(`/api/v1/tasks/${id}`);

	await page.goto('/app/settings/orte');
	await waitForStableView(page, 'Allgemein');
	await expect(page.getByTestId('plan-hint-location_reminders')).toBeVisible();
});

test('#1787 AK4: im Kanal play führt der Hinweis zur Paketansicht mit Play-Kauf', async ({ page }) => {
	await page.addInitScript(() => {
		(window as { __PP_CHANNEL__?: string }).__PP_CHANNEL__ = 'play';
	});
	await login(page);
	await page.goto('/app/settings/orte');
	await waitForStableView(page, 'Allgemein');

	await page.getByTestId('plan-hint-location_reminders').getByRole('link', { name: 'Pakete ansehen' }).click();

	await expect(page).toHaveURL(/\/app\/settings\/pakete$/);
	await expect(page.locator('[data-testid="plans-section"] kol-table-stateful')).toBeVisible();
	await expect(page.getByText('Google Play nicht erreichbar')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Buchen' })).toHaveCount(0);
});
