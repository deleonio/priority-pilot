import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { waitForStableView } from './helpers';

test.describe('Priority Pilot — Fokus nach dem Löschen (Issue #182)', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen
	// (kein Verlass auf Demo-Seed) und parallele/aufeinanderfolgende Läufe sich nicht stören.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E ${label} #${(runId += 1)}-${Date.now()}`;

	/** Löscht alle aktuell vorhandenen Tasks über die echte API (Vite-Proxy → Backend). */
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

	/** Wechselt auf den „Aufgaben"-Tab (die Task-Tabelle liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Legt über die UI einen Task mit dem gegebenen Titel an (Default-Felder genügen der Validierung:
	 * Priorität 3, Aufwand 0,5, Status „Offen") und wartet, bis der Dialog geschlossen ist.
	 */
	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Titel').fill(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	test('AC1: Nach erfolgreichem Löschen liegt der Fokus auf dem [data-focus-fallback]-Element', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Löschen-Fokus');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// Der auslösende „Löschen"-Button ist nach dem Reload nicht mehr im DOM; daher muss der Fokus
		// auf das Fallback-Element wandern (noch nicht implementiert → dieser Test ist rot).
		await expect(page.locator('[data-focus-fallback]')).toBeFocused();
	});

	test('AC2 (Regression): Beim Abbrechen kehrt der Fokus zum auslösenden „Löschen"-Button zurück', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Abbrechen-Fokus');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

		const deleteButton = page.getByRole('button', { name: 'Löschen' }).first();
		await deleteButton.click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// Der Task bleibt erhalten, der auslösende Button ist weiterhin im DOM → bestehende
		// Fokus-Restore-Logik bringt den Fokus exakt dorthin zurück (kann bereits grün sein).
		await expect(deleteButton).toBeFocused();
	});

	test('AC3: Nach dem Löschen des ersten von zwei Tasks ist activeElement nicht document.body', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const firstTitle = uniqueTitle('Erster');
		const secondTitle = uniqueTitle('Zweiter');
		await createTaskViaUi(page, firstTitle);
		await createTaskViaUi(page, secondTitle);

		await openTasksTab(page);
		await expect(page.getByRole('cell', { name: firstTitle, exact: true })).toBeVisible();
		await expect(page.getByRole('cell', { name: secondTitle, exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// Der Fokus darf nach dem Löschen nicht auf den <body> fallen (aktueller Bug → rot).
		await page.waitForFunction(() => document.activeElement?.tagName?.toLowerCase() !== 'body');
	});
});
