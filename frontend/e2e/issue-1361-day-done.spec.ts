import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1361 „Tag geschafft" (Spec docs/spec/issue-1361.md).
 *
 * AK1/AK2/AK7: Sind alle Aufgaben erledigt und wurde heute mindestens eine Aufgabe abgehakt, zeigen
 * Dashboard und Aufgaben-Tab einen Abschluss-Hinweis (`data-testid="day-done"`); mit einer offenen
 * Aufgabe verschwindet er wieder. Bei 375px/320px Viewportbreite bleibt der Hinweis vollständig
 * innerhalb der Viewportbreite (Bounding-Box, Muster `issue-1360-streak.spec.ts` AK6).
 *
 * Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy) wie `issue-1360-streak.spec.ts`.
 */

const createTask = async (page: import('@playwright/test').Page, title: string): Promise<{ id: number }> => {
	const res = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(res.ok()).toBeTruthy();
	return (await res.json()) as { id: number };
};

const completeTask = async (page: import('@playwright/test').Page, id: number): Promise<void> => {
	const res = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
	expect(res.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: import('@playwright/test').Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Priority Pilot — #1361: Tag geschafft', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1 — Dashboard zeigt den Abschluss-Hinweis, wenn alle Aufgaben heute erledigt sind', async ({ page }) => {
		const task = await createTask(page, 'E2E 1361 heute erledigt');
		await completeTask(page, task.id);
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByTestId('day-done')).toBeVisible();
	});

	test('AK2 — Hinweis verschwindet, sobald eine offene Aufgabe existiert', async ({ page }) => {
		const task = await createTask(page, 'E2E 1361 heute erledigt (2)');
		await completeTask(page, task.id);
		await createTask(page, 'E2E 1361 noch offen');
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByTestId('day-done')).toHaveCount(0);
	});

	test('AK1/AK4 — Aufgaben-Tab zeigt denselben Hinweis', async ({ page }) => {
		const task = await createTask(page, 'E2E 1361 aufgaben-tab');
		await completeTask(page, task.id);
		await page.goto('/aufgaben');
		await waitForStableView(page);

		await expect(page.getByTestId('day-done')).toBeVisible();
	});

	test('AK7 — bei 375px und 320px bleibt der Hinweis innerhalb der Viewportbreite', async ({ page }) => {
		const task = await createTask(page, 'E2E 1361 mobile');
		await completeTask(page, task.id);

		for (const width of [375, 320]) {
			await page.setViewportSize({ width, height: 812 });
			await page.goto('/');
			await waitForStableView(page);

			const hint = page.getByTestId('day-done');
			await expect(hint).toBeVisible();
			const box = await hint.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
		}
	});
});
