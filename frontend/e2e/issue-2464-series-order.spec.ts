import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * E2E-Reihenfolge-Tests für #2464 „Serien-Formular: „Automatisch anlegen“ als erste
 * Option vor dem Startdatum“.
 *
 * Contract: docs/spec/issue-2464.md.
 *
 * Gemessen wird über Bounding-Boxes (y-Vergleich, Vorlage `issue-1072-deadline-group.spec.ts`)
 * — nicht per `scrollWidth`, da die App-Shell mit `overflow-x: hidden` clippt.
 *
 * Rot-Zustand: Im Serie-Modus steht der Schalter „Automatisch anlegen“ heute UNTER dem
 * Startdatum-Feld (TaskForm.tsx, Serie-Zweig) — die y-Reihenfolge-Assertions scheitern.
 */

/** Öffnet das Task-Anlegeformular im Serie-Modus (QuickCapture übersprungen). */
const openSeriesForm = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);
	// #1260: Termin-Abschnitt liegt im zugeklappten Akkordeon.
	await openAccordionSection(page, 'Termin & Ort');
	await page.getByTestId('mode-switch').getByRole('checkbox').click();
};

const autoCreateSwitch = (page: Page) => page.getByRole('checkbox', { name: 'Automatisch anlegen' });
const startDateField = (page: Page) => page.getByLabel('Startdatum');
const rhythmField = (page: Page) => page.locator('kol-single-select[_label="Rhythmus"]');

test.describe('#2464 Serien-Formular: Schalter vor dem Startdatum', () => {
	// AK1: Der Schalter „Automatisch anlegen“ liegt sichtbar über dem Startdatum-Feld.
	test('AK1 — Schalter „Automatisch anlegen“ liegt über dem Startdatum-Feld', async ({ page }) => {
		await openSeriesForm(page);

		await expect(autoCreateSwitch(page)).toBeVisible();
		await expect(startDateField(page)).toBeVisible();

		const switchBox = await autoCreateSwitch(page).boundingBox();
		const startDateBox = await startDateField(page).boundingBox();

		expect(switchBox).not.toBeNull();
		expect(startDateBox).not.toBeNull();
		expect(switchBox!.y).toBeLessThan(startDateBox!.y);
	});

	// AK2: Schalter aus → Startdatum und Rhythmus ausgeblendet; wieder an → beide erscheinen
	// unterhalb des Schalters (Reihenfolge Schalter → Startdatum → Rhythmus).
	test('AK2 — Schalter aus blendet Startdatum/Rhythmus aus, an blendet beide darunter ein', async ({ page }) => {
		await openSeriesForm(page);

		const toggle = autoCreateSwitch(page);
		await toggle.click();
		await expect(startDateField(page)).toHaveCount(0);
		await expect(rhythmField(page)).toHaveCount(0);

		await toggle.click();
		await expect(startDateField(page)).toBeVisible();
		await expect(rhythmField(page)).toBeVisible();

		const switchBox = await toggle.boundingBox();
		const startDateBox = await startDateField(page).boundingBox();
		const rhythmBox = await rhythmField(page).boundingBox();

		expect(switchBox).not.toBeNull();
		expect(startDateBox).not.toBeNull();
		expect(rhythmBox).not.toBeNull();

		expect(switchBox!.y).toBeLessThan(startDateBox!.y);
		expect(startDateBox!.y).toBeLessThan(rhythmBox!.y);
	});

	// AK3 (Mobile-first, 375px): Reihenfolge Schalter → Startdatum → Rhythmus bleibt erhalten,
	// kein Feld wird horizontal abgeschnitten.
	test('AK3 — 375px: Reihenfolge erhalten, kein Feld wird horizontal abgeschnitten', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openSeriesForm(page);

		const switchBox = await autoCreateSwitch(page).boundingBox();
		const startDateBox = await startDateField(page).boundingBox();
		const rhythmBox = await rhythmField(page).boundingBox();

		expect(switchBox).not.toBeNull();
		expect(startDateBox).not.toBeNull();
		expect(rhythmBox).not.toBeNull();

		expect(switchBox!.y).toBeLessThan(startDateBox!.y);
		expect(startDateBox!.y).toBeLessThan(rhythmBox!.y);

		for (const box of [switchBox!, startDateBox!, rhythmBox!]) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(375);
		}
	});
});
