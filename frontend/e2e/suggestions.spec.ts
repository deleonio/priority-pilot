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
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `WID ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

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
		// P2-1: Die Vorschlagsliste schließt die bereits als „Nächste Aufgabe"
		// prominent angezeigte Aufgabe aus (keine doppelte Hauptaussage, #443). Damit nach dem Filtern
		// noch genügend Vorschläge übrig sind, legen wir drei Tasks an.
		const titelNiedrig = uniqueTitle('Niedrig');
		const titelMittel = uniqueTitle('Mittel');
		const titelHoch = uniqueTitle('Hoch');

		// Seed über die echte API (Vite-Proxy → Backend): gleiche Voraussetzungen außer Priorität.
		await page.request.post('/api/v1/tasks', { data: { title: titelNiedrig, priority: 1, estimatedEffort: 1 } });
		await page.request.post('/api/v1/tasks', { data: { title: titelMittel, priority: 2, estimatedEffort: 1 } });
		await page.request.post('/api/v1/tasks', { data: { title: titelHoch, priority: 5, estimatedEffort: 1 } });

		await page.goto('/');
		await waitForStableView(page);

		// Die höchste Priorität (5) ist die „Nächste Aufgabe" — sie darf NICHT in der Vorschlagsliste
		// auftauchen (P2-1: keine Wiederholung der Hauptaussage).
		const region = page.getByRole('region', { name: /Was ist jetzt dran/i });
		await expect(region).toBeVisible();
		await expect(region.getByText(titelHoch)).not.toBeVisible();

		// Die beiden übrigen Vorschläge erscheinen in Prioritätsreihenfolge (höhere zuerst).
		const eintraege = await region.getByRole('listitem').allTextContents();
		const idxMittel = eintraege.findIndex((t) => t.includes(titelMittel));
		const idxNiedrig = eintraege.findIndex((t) => t.includes(titelNiedrig));
		expect(idxMittel, 'mittlerer Task ist gelistet').toBeGreaterThanOrEqual(0);
		expect(idxNiedrig, 'niedriger Task ist gelistet').toBeGreaterThanOrEqual(0);
		expect(idxMittel).toBeLessThan(idxNiedrig);
	});
});
