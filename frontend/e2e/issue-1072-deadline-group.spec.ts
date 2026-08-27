import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #1072 „Deadline-Felder visuell gruppieren, Adresse als letztes Feld".
 *
 * Contract: docs/spec/issue-1072.md.
 *
 * Gemessen wird über Bounding-Boxes — nicht per `scrollWidth`, da die App-Shell mit
 * `overflow-x: hidden` clippt und `scrollWidth` strukturell ≤ Viewport bleibt (siehe
 * `issue-1061-task-address.spec.ts`).
 *
 * Rot-Zustand: der Gruppen-Container `data-testid="deadline-group"` existiert noch nicht,
 * das Adressfeld steht heute zwischen Deadline-Datum und Auto-Löschen-Schalter.
 */

/** Öffnet das Task-Anlegeformular (QuickCapture-Schritt übersprungen). */
const openForm = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);
	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);
};

const deadlineGroup = (page: Page) => page.getByTestId('deadline-group');
const deadlineField = (page: Page) => page.getByLabel('Deadline (optional)');
const autoDeleteToggle = (page: Page) => page.locator('kol-input-checkbox.auto-delete-toggle');
const addressField = (page: Page) => page.getByLabel('Adresse (optional)');

test.describe('#1072 Deadline-Gruppe im TaskForm', () => {
	// AK1: Deadline-Datum + Auto-Löschen-Schalter liegen in einem eigenen Gruppen-Container,
	// der sie visuell absetzt; die Adresse gehört nicht hinein.
	test('AK1 — Deadline-Datum und Auto-Löschen-Schalter liegen in einer eigenen Gruppe, die Adresse nicht', async ({
		page,
	}) => {
		await openForm(page);

		const group = deadlineGroup(page);
		await expect(group).toBeVisible();
		await expect(deadlineField(page)).toBeVisible();
		await expect(autoDeleteToggle(page)).toBeVisible();

		// Die Gruppe enthält genau die beiden Deadline-Felder …
		await expect(group.getByLabel('Deadline (optional)')).toBeVisible();
		await expect(group.locator('kol-input-checkbox.auto-delete-toggle')).toBeVisible();
		// … und die Adresse nicht.
		await expect(group.getByLabel('Adresse (optional)')).toHaveCount(0);
	});

	// AK2/AK3: Deadline-Datum → Auto-Löschen-Schalter → Adresse. Kein Formularfeld zwischen
	// den beiden Deadline-Feldern; die Adresse folgt erst nach der ganzen Gruppe.
	test('AK2/AK3 — Reihenfolge: Deadline-Datum vor Schalter vor Adresse', async ({ page }) => {
		await openForm(page);

		await expect(deadlineField(page)).toBeVisible();
		await expect(autoDeleteToggle(page)).toBeVisible();
		await expect(addressField(page)).toBeVisible();

		const deadlineBox = await deadlineField(page).boundingBox();
		const toggleBox = await autoDeleteToggle(page).boundingBox();
		const addressBox = await addressField(page).boundingBox();

		expect(deadlineBox).not.toBeNull();
		expect(toggleBox).not.toBeNull();
		expect(addressBox).not.toBeNull();

		expect(deadlineBox!.y).toBeLessThan(toggleBox!.y);
		expect(toggleBox!.y).toBeLessThan(addressBox!.y);
	});

	// AK3 (Serie-Modus): dieselbe Gruppierung — Startdatum/Rhythmus + Schalter gehören zur
	// Gruppe, die Adresse folgt danach.
	test('AK3 — Serie-Modus: Adresse folgt der Deadline-Gruppe (Startdatum/Rhythmus + Schalter)', async ({ page }) => {
		await openForm(page);

		await page.getByTestId('mode-switch').getByRole('checkbox').click();
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByLabel('Rhythmus')).toBeVisible();

		const group = deadlineGroup(page);
		await expect(group).toBeVisible();
		await expect(group.locator('kol-input-checkbox.auto-delete-toggle')).toBeVisible();
		await expect(group.getByLabel('Adresse (optional)')).toHaveCount(0);

		const startDateBox = await page.getByLabel('Startdatum').boundingBox();
		const toggleBox = await autoDeleteToggle(page).boundingBox();
		const addressBox = await addressField(page).boundingBox();

		expect(startDateBox).not.toBeNull();
		expect(toggleBox).not.toBeNull();
		expect(addressBox).not.toBeNull();

		expect(startDateBox!.y).toBeLessThan(toggleBox!.y);
		expect(toggleBox!.y).toBeLessThan(addressBox!.y);
	});

	// AK4 (Mobile-first, 375px): Gruppierung und Reihenfolge bleiben erhalten und kein Feld
	// wird horizontal abgeschnitten.
	test('AK4 — 375px: Reihenfolge erhalten, kein Feld wird horizontal abgeschnitten', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openForm(page);

		const deadlineBox = await deadlineField(page).boundingBox();
		const toggleBox = await autoDeleteToggle(page).boundingBox();
		const addressBox = await addressField(page).boundingBox();

		expect(deadlineBox).not.toBeNull();
		expect(toggleBox).not.toBeNull();
		expect(addressBox).not.toBeNull();

		expect(deadlineBox!.y).toBeLessThan(toggleBox!.y);
		expect(toggleBox!.y).toBeLessThan(addressBox!.y);

		for (const box of [deadlineBox!, toggleBox!, addressBox!]) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(375);
		}
	});
});
