import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #122 — „Was ist jetzt dran?"-Ansicht gegen das echte Backend.
 *
 * Vertrag: Es existiert eine „Was ist jetzt dran?"-Ansicht, die die Vorschlagsliste
 * (`GET /suggestions`) anzeigt — nach Score sortiert, also bei sonst gleichen Faktoren die höhere
 * Priorität zuerst. Die UI-Komponente folgt durch die Umsetzung; bis dahin ist diese Spec rot.
 */
test.describe('„Was ist jetzt dran?"-Liste (#122)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `WID ${label} #${(runId += 1)}-${Date.now()}`;

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('zeigt die Vorschläge in erwarteter Reihenfolge (höchste Priorität zuerst)', async ({ page }) => {
		const titelNiedrig = uniqueTitle('Niedrig');
		const titelHoch = uniqueTitle('Hoch');

		// Seed über die echte API (Vite-Proxy → Backend): gleiche Voraussetzungen außer Priorität.
		await page.request.post('/api/v1/tasks', { data: { title: titelNiedrig, priority: 2, estimatedEffort: 1 } });
		await page.request.post('/api/v1/tasks', { data: { title: titelHoch, priority: 5, estimatedEffort: 1 } });

		await page.goto('/');
		await waitForStableView(page);

		// Die „Was ist jetzt dran?"-Ansicht ist als benannte Region erreichbar.
		const region = page.getByRole('region', { name: /Was ist jetzt dran/i });
		await expect(region).toBeVisible();
		await expect(region.getByText(titelHoch)).toBeVisible();

		// Reihenfolge: der höher priorisierte Task steht vor dem niedriger priorisierten.
		const eintraege = await region.getByRole('listitem').allTextContents();
		const idxHoch = eintraege.findIndex((t) => t.includes(titelHoch));
		const idxNiedrig = eintraege.findIndex((t) => t.includes(titelNiedrig));
		expect(idxHoch, 'höher priorisierter Task ist gelistet').toBeGreaterThanOrEqual(0);
		expect(idxNiedrig, 'niedriger priorisierter Task ist gelistet').toBeGreaterThanOrEqual(0);
		expect(idxHoch).toBeLessThan(idxNiedrig);
	});
});
