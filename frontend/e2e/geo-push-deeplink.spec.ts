import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/** Deep-Link des Geo-Push (`/tasks/<id>`, geo-background-job.ts) öffnet die Aufgabe, statt still aufs Dashboard zu fallen. */
test('Geo-Push-Link /tasks/<id> öffnet den Bearbeiten-Dialog und landet auf dem Dashboard', async ({ page }) => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title: 'Apotheke', priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok()).toBe(true);
	const { id } = (await response.json()) as { id: number };

	await page.goto(`/app/tasks/${id}`);

	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await expect(page).toHaveURL(/\/app\/$/);
});

/** Gelöschte Aufgabe (#2848 AK5): kein stiller Dashboard-Fall mehr — die App meldet sich dauerhaft. */
test('Geo-Push-Link auf unbekannte Aufgabe zeigt Hinweis "Diese Aufgabe gibt es nicht mehr."', async ({ page }) => {
	await page.goto('/app/tasks/99999999');
	await waitForStableView(page);

	await expect(page.getByText('Diese Aufgabe gibt es nicht mehr.')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
});
