import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * E2E-Specs für #2463 „Gesetzte Deadline wieder leeren können".
 *
 * Contract: docs/spec/issue-2463.md (AK2 End-to-End, AK4 mobil).
 *
 * Gegen das echte Backend (In-Memory-DB): Task per API mit (Zukunfts-)Deadline angelegt, Entfernen
 * über die UI, Persistenz über API-GET, erneutes Öffnen und Dashboard-Widget „Anstehende Deadlines"
 * geprüft. Gemessen wird über Bounding-Boxes — nicht per `scrollWidth`, da die App-Shell mit
 * `overflow-x: hidden` clippt (Präzedenz issue-1072/1159).
 *
 * Rot-Zustand: der Entfernen-Button „Deadline entfernen" existiert noch nicht — die Klick-Schritte
 * scheitern schnell mit klarem Locator.
 */

/** Öffnet den Bearbeiten-Dialog der (einzigen, per API angelegten) Aufgabe und das Deadline-Akkordeon. */
const openEditDialog = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	// API-angelegte Task in die Liste holen (Muster issue-934).
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
	await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await waitForStableView(page);
	// #1260: Deadline liegt im zugeklappten „Termin & Ort"-Akkordeon — erst öffnen.
	await openAccordionSection(page, 'Termin & Ort');
};

test.describe('#2463 Deadline am Feld entfernen', () => {
	let runId = 0;
	const createdTaskIds: number[] = [];

	// Eindeutiger Titel je Test (Muster crud.spec.ts), Aufräumen über die echte API.
	const uniqueTitle = (label: string): string => `E2E #2463 ${label} #${(runId += 1)}`;

	const createTaskWithDeadline = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 0.5, deadline: '2027-03-15' },
		});
		expect(response.ok()).toBe(true);
		const task = (await response.json()) as { id: number };
		createdTaskIds.push(task.id);
		return task.id;
	};

	test.afterEach(async ({ page }) => {
		for (const id of createdTaskIds.splice(0)) {
			await page.request.delete(`/api/v1/tasks/${id}`);
		}
	});

	// AK2: Entfernen + Speichern → Formular beim Reopen ohne Datum, API-GET `deadline: null`,
	// Task fehlt im Dashboard-Widget „Anstehende Deadlines".
	test('TF3 — entfernte Deadline bleibt gespeichert: Reopen ohne Datum, API null, Widget ohne Task', async ({
		page,
	}) => {
		await registerOwnSession(page, '2463');
		const title = uniqueTitle('Deadline');
		const id = await createTaskWithDeadline(page, title);

		await openEditDialog(page);
		const deadlineField = page.getByLabel('Deadline (optional)');
		await expect(deadlineField).toHaveValue('2027-03-15');

		const clearButton = page.getByRole('button', { name: 'Deadline entfernen' });
		await expect(clearButton).toBeVisible(); // schneller Rot-Bruch (Präzedenz MEMORY 2026-08-25)
		await clearButton.click();
		await expect(deadlineField).toHaveValue('');

		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();

		// API: Deadline dauerhaft null.
		const get = await page.request.get(`/api/v1/tasks/${id}`);
		expect(get.ok()).toBe(true);
		expect(((await get.json()) as { deadline: string | null }).deadline).toBeNull();

		// Reopen: Formular zeigt kein Datum mehr.
		await openEditDialog(page);
		await expect(page.getByLabel('Deadline (optional)')).toHaveValue('');

		// Dashboard-Widget: Task nicht mehr unter „Anstehende Deadlines".
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.locator('.dashboard-deadlines').getByText(title)).toHaveCount(0);
	});

	// AK4: Mobil (375 px) per Tap bedienbar; deadline-group bleibt im Viewport (Bounding-Box).
	test('TF4 — 375 px: Tap entfernt die Deadline, deadline-group ohne horizontales Clipping', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await registerOwnSession(page, '2463m');
		await createTaskWithDeadline(page, uniqueTitle('Mobil'));

		await openEditDialog(page);

		const clearButton = page.getByRole('button', { name: 'Deadline entfernen' });
		await expect(clearButton).toBeVisible();
		await clearButton.click();
		await expect(page.getByLabel('Deadline (optional)')).toHaveValue('');

		const groupBox = await page.getByTestId('deadline-group').boundingBox();
		expect(groupBox).not.toBeNull();
		expect(groupBox!.x).toBeGreaterThanOrEqual(0);
		expect(groupBox!.x + groupBox!.width).toBeLessThanOrEqual(375);
	});
});
