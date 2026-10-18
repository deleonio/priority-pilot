import { expect, test } from './fixtures';

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
