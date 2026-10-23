import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openAccordionSection, waitForStableView, MOBILE } from './helpers';

/**
 * E2E-Layout-Tests für #728 „Checklist-Item-Abstand optimieren".
 *
 * Ziel: Die Checkliste im TaskForm nutzt CSS Gaps für ihre Abstände — vertikal zwischen den Items
 * sowie horizontal zwischen Eingabefeld + „Hinzufügen"-Button und innerhalb eines Items
 * (Switch mit Titel als Label, Entfernen-Button).
 *
 * Spezifikation: docs/spec/issue-728.md
 *
 * Diese Tests prüfen das LAYOUT-Verhalten (Positionen und Freiraum über Bounding-Boxes), nicht die
 * Checklisten-Funktionalität (Anlegen/Entfernen/Abhaken ist in TaskForm.test.tsx abgedeckt). Sie
 * waren ROT, solange die Checklist-Sektion ungestylt war: ohne Gap stapeln sich die Items ohne
 * vertikalen Freiraum, und Eingabefeld/Button bzw. Item-Inhalte flossen unstrukturiert inline.
 */

/** Öffnet das TaskForm (QuickCapture-Schritt übersprungen) und legt Checklisten-Einträge an. */
const openFormWithChecklistItems = async (page: Page, titles: string[]): Promise<Locator> => {
	await page.goto('/app/');
	await waitForStableView(page);

	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);

	// #1260: Checkliste liegt im zugeklappten „Optional"-Akkordeon — erst öffnen.
	await openAccordionSection(page, 'Optional');

	const section = page.locator('[data-testid="checklist-section"]');
	await expect(section).toBeVisible();

	for (const title of titles) {
		await page.locator('.checklist-add input').fill(title);
		await page.locator('.checklist-add').getByRole('button', { name: 'Hinzufügen' }).click();
	}

	const items = page.locator('[data-testid="checklist-item"]');
	await expect(items).toHaveCount(titles.length);
	return items;
};

test.describe('#728 Checklist-Layout über alle Viewports', () => {
	/**
	 * AK1 (Desktop) — Checklist-Items haben einen deutlichen vertikalen Abstand (Gap statt Stapelung).
	 * RED, solange die Items ohne vertikalen Freiraum direkt untereinander stehen.
	 * Bezug: docs/spec/issue-728.md, Schritt 2 (vertikale Abstände optimieren).
	 */
	test('AK1 (Desktop): Checklist-Items haben bei 1024×768 einen deutlichen vertikalen Abstand', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		const items = await openFormWithChecklistItems(page, ['Erster Schritt', 'Zweiter Schritt']);

		const firstBox = await items.nth(0).boundingBox();
		const secondBox = await items.nth(1).boundingBox();

		expect(firstBox).not.toBeNull();
		expect(secondBox).not.toBeNull();

		// Vertikaler Freiraum zwischen den Items: mindestens 8px Luft zwischen den Boxen.
		const verticalGap = secondBox!.y - (firstBox!.y + firstBox!.height);
		expect(verticalGap).toBeGreaterThanOrEqual(8);
	});

	/**
	 * AK2 (Desktop) — Eingabefeld und „Hinzufügen"-Button teilen sich eine Zeile mit Freiraum.
	 * Bezug: docs/spec/issue-728.md, Schritt 3 (CSS Gap für effektive Freiraumnutzung).
	 */
	test('AK2 (Desktop): Eingabefeld + Hinzufügen-Button bei 1024×768 in einer Zeile mit Freiraum', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openFormWithChecklistItems(page, ['Erster Schritt']);

		const inputBox = await page.locator('.checklist-add kol-input-text').boundingBox();
		const buttonBox = await page.locator('.checklist-add kol-button').boundingBox();

		expect(inputBox).not.toBeNull();
		expect(buttonBox).not.toBeNull();

		// Horizontale Reihenfolge: Eingabefeld links, Button rechts — in derselben Zeile (±10px vertikal).
		expect(inputBox!.x).toBeLessThan(buttonBox!.x);
		const inputCenterY = inputBox!.y + inputBox!.height / 2;
		const buttonCenterY = buttonBox!.y + buttonBox!.height / 2;
		expect(Math.abs(inputCenterY - buttonCenterY)).toBeLessThanOrEqual(10);

		// Horizontaler Freiraum zwischen Feld und Button: mindestens 6px, nicht direkt aneinandergeklebt.
		const horizontalGap = buttonBox!.x - (inputBox!.x + inputBox!.width);
		expect(horizontalGap).toBeGreaterThanOrEqual(6);
	});

	/**
	 * AK3 (Mobile) — Der vertikale Abstand gilt auf allen Viewports, nicht nur auf dem Desktop.
	 * RED, solange die Items auf schmalen Viewports ohne Freiraum stapeln. (Das Umbruch-Verhalten
	 * langer Titel wird bereits global durch die Dialog-Styles gesichert und ist hier nicht Gegenstand.)
	 * Bezug: docs/spec/issue-728.md, Schritt 2 (vertikale Abstände optimieren) + Testfall „Checklist
	 * in verschiedenen Viewports".
	 */
	test('AK3 (Mobile): Checklist-Items haben auch bei 375×812 einen deutlichen vertikalen Abstand', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		const items = await openFormWithChecklistItems(page, ['Erster Schritt', 'Zweiter Schritt']);

		const firstBox = await items.nth(0).boundingBox();
		const secondBox = await items.nth(1).boundingBox();

		expect(firstBox).not.toBeNull();
		expect(secondBox).not.toBeNull();

		// Vertikaler Freiraum zwischen den Items auch mobil: mindestens 8px Luft.
		const verticalGap = secondBox!.y - (firstBox!.y + firstBox!.height);
		expect(verticalGap).toBeGreaterThanOrEqual(8);

		// Kein horizontaler Scroll durch die Checkliste.
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBe(375);
	});

	/**
	 * AK4 (Desktop) — Der Switch (Pill + Titel als Label, #2897) und der Entfernen-Button liegen in
	 * einer Zeile mit Freiraum — bessere Touch-Targets statt aneinandergeklebter Inline-Inhalte.
	 * Bezug: docs/spec/issue-728.md, Schritt 3 (CSS Gap für effektive Freiraumnutzung).
	 */
	test('AK4 (Desktop): Switch mit Titel und Entfernen-Button eines Items in einer Zeile mit Freiraum', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		const items = await openFormWithChecklistItems(page, ['Erster Schritt']);

		const item = items.first();
		const switchBox = await item.locator('kol-input-checkbox').boundingBox();
		const removeBox = await item.locator('kol-button').boundingBox();

		expect(switchBox).not.toBeNull();
		expect(removeBox).not.toBeNull();

		// Horizontale Reihenfolge links → rechts: Switch (Pill + Titel), Entfernen-Button.
		expect(switchBox!.x).toBeLessThan(removeBox!.x);

		// Beide in derselben Zeile (vertikale Zentren ±10px).
		const centerY = (box: { y: number; height: number }) => box.y + box.height / 2;
		expect(Math.abs(centerY(switchBox!) - centerY(removeBox!))).toBeLessThanOrEqual(10);

		// Horizontaler Freiraum zwischen den Elementen: mindestens 6px.
		expect(removeBox!.x - (switchBox!.x + switchBox!.width)).toBeGreaterThanOrEqual(6);
	});
});
