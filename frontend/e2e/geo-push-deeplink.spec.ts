import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec für #2941 AK5 (Vertrag: docs/spec/issue-2941.md): der Deep-Link alter Pushes
 * (`/tasks/<id>`) leitet mit `replace` auf die Aufgaben-Ansicht um — auch bei gelöschter
 * Aufgabe (Meldung in der Ansicht statt Dashboard-Alert #2848). Dauerzustand für Alt-Pushes.
 */

test('Deep-Link /tasks/<id> landet mit replace in der Aufgaben-Ansicht', async ({ page }) => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title: 'Apotheke', priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok()).toBe(true);
	const { id } = (await response.json()) as { id: number };

	await page.goto(`/app/tasks/${id}`);
	await waitForStableView(page);

	await expect(page).toHaveURL(new RegExp(`/app/aufgaben/${id}$`));
	await expect(page.getByRole('heading', { level: 1, name: 'Apotheke' })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
	// replace statt push: kein /tasks-Eintrag in der History — Back führt zur Ursprungsseite.
	await page.goBack();
	await expect(page).not.toHaveURL(/\/app\/tasks\//);
});

test('Deep-Link auf gelöschte Aufgabe zeigt den Hinweis in der Ansicht', async ({ page }) => {
	await page.goto('/app/tasks/99999999');
	await waitForStableView(page);

	await expect(page).toHaveURL(/\/app\/aufgaben\/99999999$/);
	await expect(page.getByText('Diese Aufgabe gibt es nicht mehr.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Zu den Aufgaben' })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
});
