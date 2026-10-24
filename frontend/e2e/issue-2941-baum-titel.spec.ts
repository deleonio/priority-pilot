import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2941 AK1 (Vertrag: docs/spec/issue-2941.md) — der Titel im
 * Aufgabenbaum ist ein KolLink auf die Aufgaben-Ansicht `/aufgaben/<id>` (#2938): Tap öffnet
 * die Leseseicht statt des Bearbeiten-Dialogs; die Zielfläche ist die ganze Titelzeile
 * (mindestens 44 px, Mobile-UI-Regel 2).
 */

const createTreeTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok(), 'Setup: Task-Anlage muss 2xx liefern').toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

test.describe('Balamentum — #2941 Baum-Titel-Einstieg', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('AK1: Titel-Tap im Baum öffnet die Aufgaben-Ansicht (kein Dialog)', async ({ page }) => {
		await registerOwnSession(page, 'baum-2941');
		const title = 'E2E #2941 Baumtitel';
		const id = await createTreeTask(page, title);

		await page.goto('/app/');
		await waitForStableView(page);

		const titelLink = page.getByRole('link', { name: title });
		await expect(titelLink).toBeVisible();
		// Zielfläche: ganze Titelzeile, mindestens 44 px hoch (AK1, Mobile-UI-Regel 2).
		expect((await titelLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

		await titelLink.click();
		await expect(page).toHaveURL(new RegExp(`/aufgaben/${id}$`));
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
	});
});
