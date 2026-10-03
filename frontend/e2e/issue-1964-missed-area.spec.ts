import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1964 „Verpasst-Bereich“ (Spec docs/spec/issue-1964.md).
 *
 * AK2: die Section „Verpasst“ bietet je Aufgabe „Neu planen“, „Archivieren“ und „Löschen“.
 * AK3 (e2e-Teil): der Verschiebe-Zähler ist als Text-Badge sichtbar („N× verschoben“);
 *   Aufgaben ohne Verschiebung zeigen keinen Zähler.
 * AK6 (Mobile-First): bei 375 px ist der Bereich inkl. aller drei Aktionen ohne horizontalen
 *   Scroll vollständig sichtbar (Bounding-Box statt scrollWidth — die App-Shell clippt mit
 *   `overflow-x: hidden`), Touch-Targets ≥ 44 px.
 *
 * Wie crud.spec.ts laufen diese Specs gegen das echte Backend (In-Memory-DB, Vite-Proxy); der
 * überfällige Task wird direkt über die API angelegt (Deadline in der Vergangenheit ist API-
 * valide, nur das Formular verbietet sie) und abgeräumt.
 * Rot, bis `missed-section`/`missed-item` und die drei Aktionen existieren. KEIN Produktivcode.
 */

const DAY = 24 * 60 * 60 * 1000;

const createTaskViaApi = async (page: Page, data: Record<string, unknown>): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data });
	expect(response.ok()).toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

const patchTaskViaApi = async (page: Page, id: number, data: Record<string, unknown>): Promise<void> => {
	const response = await page.request.patch(`/api/v1/tasks/${id}`, { data });
	expect(response.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Balamentum — #1964: Verpasst-Bereich', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK2+AK3 — Bereich zeigt überfällige Aufgabe mit Zähler-Badge und den drei Aktionen', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		const id = await createTaskViaApi(page, { title: 'Verpasster Zahnarzt', deadline: past });
		// einmal nach hinten verschoben, dann wieder überfällig gesetzt (früher zählt nicht → Zähler 1)
		await patchTaskViaApi(page, id, { deadline: new Date(Date.now() + DAY).toISOString() });
		await patchTaskViaApi(page, id, { deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);

		const section = page.getByTestId('missed-section');
		await expect(section).toBeVisible({ timeout: 5000 });
		const item = page.getByTestId('missed-item');
		await expect(item).toHaveCount(1);
		await expect(item).toContainText('Verpasster Zahnarzt');
		await expect(item).toContainText(/1× verschoben/);
		await expect(item.getByRole('button', { name: /neu planen/i })).toBeVisible();
		await expect(item.getByRole('button', { name: /archivieren/i })).toBeVisible();
		await expect(item.getByRole('button', { name: /löschen/i })).toBeVisible();

		// AK3: ohne Verschiebung kein Zähler (0 wird nicht angezeigt)
		await createTaskViaApi(page, { title: 'Nie verschoben', deadline: past });
		await page.reload();
		await waitForStableView(page);
		const second = page.getByTestId('missed-item').filter({ hasText: 'Nie verschoben' });
		await expect(second).toHaveCount(1);
		// Test-Pflege #1964 (Umsetzung): geprüft wird das Zähler-Badge, nicht der freie Text — der
		// Task-Titel „Nie verschoben" enthielt das Wort selbst, die ursprüngliche Assertion
		// `not.toContainText(/verschoben/)` konnte dadurch nie grün sein.
		await expect(second).not.toContainText(/\d+× verschoben/);
	});

	test('AK6 — 375px: Bereich inkl. drei Aktionen ohne horizontalen Scroll, Targets >= 44px', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Mobile Verpasst', deadline: past });

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const item = page.getByTestId('missed-item').first();
		await expect(item).toBeVisible({ timeout: 5000 });

		const itemBox = await item.boundingBox();
		expect(itemBox).not.toBeNull();
		expect(itemBox!.x).toBeGreaterThanOrEqual(0);
		expect(itemBox!.x + itemBox!.width).toBeLessThanOrEqual(375);

		for (const name of [/neu planen/i, /archivieren/i, /löschen/i]) {
			const button = item.getByRole('button', { name });
			await expect(button).toBeVisible();
			// boundingBox() misst einmalig und wartet nicht nach (Memory 2026-09-14): kurze Schleife
			let box = await button.boundingBox();
			for (let i = 0; i < 30 && !box; i += 1) {
				await page.waitForTimeout(100);
				box = await button.boundingBox();
			}
			expect(box, `Aktion ${String(name)} muss messbar sein`).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});
});
