import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #761 „Layout-Optimierung Titel/Beschreibung/Aktionen".
 *
 * Spezifikation: docs/spec/issue-761.md
 * Ziel: Titel und Beschreibung nutzen die volle verfügbare Breite ihrer Zeile, die Aktionen stehen
 * rechtsbündig unterhalb der Felder.
 *
 * AK 1 — Titel nimmt volle verfügbare Breite ein
 * AK 2 — Beschreibung nimmt volle verfügbare Breite ein
 * AK 3 — Aktionen sind rechtsbündig unterhalb platziert
 * AK 4 — Responsive Design ist gewährleistet (Mobile, Tablet, Desktop)
 * AK 5 — Touch-Ziele sind ausreichend groß (min. 44x44px)
 * AK 6 — A11y: Logical Tab-Order und Focus-Indikator
 * AK 7 — A11y: Screenreader-Semantik (zugängliche Namen der Felder)
 *
 * Die Tests messen das LAYOUT über Bounding-Boxes, nicht die Formular-Funktionalität (die ist in
 * `TaskForm.test.tsx` und `crud.spec.ts` abgedeckt). ROT waren sie, solange die Aktionen linksbündig
 * unter dem Formular klebten (`.modal-actions` ohne `justify-content: flex-end`).
 */

/** Gap zwischen Feld-Wrapper und Lektorat-Button innerhalb einer Feld-Zeile (TaskForm.tsx, `gap: 8px`). */
const FIELD_ROW_GAP = 8;

/** Öffnet das TaskForm über die Kopf-Aktion; der vorgeschaltete Schnellerfassungs-Schritt wird übersprungen. */
const openTaskForm = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);

	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);
};

/** Die Flex-Zeile eines Feldes: Feld-Wrapper (`data-testid`) + zugehöriger Lektorat-Button. */
const fieldRow = (page: Page, testId: string): Locator => page.locator(`[data-testid="${testId}"]`).locator('xpath=..');

/**
 * Prüft, dass der Feld-Wrapper die volle Restbreite seiner Zeile einnimmt: Er beginnt am linken
 * Zeilenrand und reicht bis auf Lektorat-Button + Gap an den rechten Zeilenrand. Ohne `flex: 1`
 * würde der Wrapper auf seine Inhaltsbreite schrumpfen und rechts Leerraum stehen lassen.
 */
const expectFieldFillsRow = async (page: Page, testId: string, controlSelector: string): Promise<void> => {
	const wrapper = page.locator(`[data-testid="${testId}"]`);
	const row = fieldRow(page, testId);
	const lektoratButton = row.locator('kol-button');

	await expect(wrapper).toBeVisible();
	await expect(lektoratButton).toBeVisible();

	const wrapperBox = await wrapper.boundingBox();
	const rowBox = await row.boundingBox();
	const buttonBox = await lektoratButton.boundingBox();
	expect(wrapperBox).not.toBeNull();
	expect(rowBox).not.toBeNull();
	expect(buttonBox).not.toBeNull();

	// Linksbündig am Zeilenanfang …
	expect(Math.abs(wrapperBox!.x - rowBox!.x)).toBeLessThanOrEqual(1);
	// … und bis auf Lektorat-Button + Gap bis zum rechten Zeilenrand.
	const remainder = rowBox!.width - wrapperBox!.width - buttonBox!.width;
	expect(remainder).toBeGreaterThanOrEqual(FIELD_ROW_GAP - 1);
	expect(remainder).toBeLessThanOrEqual(FIELD_ROW_GAP + 1);

	// Das Eingabe-Element selbst füllt den Wrapper vollständig aus (kein eingerücktes Feld).
	const controlBox = await wrapper.locator(controlSelector).boundingBox();
	expect(controlBox).not.toBeNull();
	expect(controlBox!.width).toBeGreaterThanOrEqual(wrapperBox!.width - 1);
};

test.describe('#761 Layout-Optimierung Titel/Beschreibung/Aktionen', () => {
	/**
	 * AK1 — Der Titel nutzt die volle verfügbare Breite seiner Zeile.
	 * Bezug: docs/spec/issue-761.md, Schritt 2 (Titel-Element nimmt volle verfügbare Breite ein).
	 */
	test('AK1 (Desktop): Titel nimmt volle verfügbare Breite ein', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskForm(page);

		await expectFieldFillsRow(page, 'task-title', 'kol-input-text');
	});

	/**
	 * AK2 — Die Beschreibung nutzt die volle verfügbare Breite und steht unterhalb des Titels.
	 * Bezug: docs/spec/issue-761.md, Schritt 2 (Beschreibung-Element nimmt volle verfügbare Breite ein).
	 */
	test('AK2 (Desktop): Beschreibung nimmt volle verfügbare Breite unterhalb des Titels ein', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskForm(page);

		await expectFieldFillsRow(page, 'task-description', 'kol-textarea');

		const titleBox = await page.locator('[data-testid="task-title"]').boundingBox();
		const descBox = await page.locator('[data-testid="task-description"]').boundingBox();
		expect(titleBox).not.toBeNull();
		expect(descBox).not.toBeNull();
		expect(descBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height);
	});

	/**
	 * AK3 — Die Aktionen stehen unterhalb der Felder und sind rechtsbündig ausgerichtet.
	 * ROT ohne `justify-content: flex-end` auf `.modal-actions`: Die Buttons starten dann am linken
	 * Rand des Aktions-Containers.
	 * Bezug: docs/spec/issue-761.md, Schritt 2 (Aktionen-Gruppe ist rechtsbündig unterhalb platziert).
	 */
	test('AK3 (Desktop): Aktionen sind rechtsbündig unterhalb platziert', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskForm(page);

		const actions = page.locator('[data-testid="task-actions"]');
		await expect(actions).toBeVisible();

		const actionsBox = await actions.boundingBox();
		const descBox = await page.locator('[data-testid="task-description"]').boundingBox();
		expect(actionsBox).not.toBeNull();
		expect(descBox).not.toBeNull();

		// Unterhalb der Felder.
		expect(actionsBox!.y).toBeGreaterThanOrEqual(descBox!.y + descBox!.height);

		const buttons = actions.locator('button');
		await expect(buttons).toHaveCount(2);
		const firstBox = await buttons.first().boundingBox();
		const lastBox = await buttons.last().boundingBox();
		expect(firstBox).not.toBeNull();
		expect(lastBox).not.toBeNull();

		// Rechtsbündig: Der letzte Button schließt mit dem rechten Rand des Containers ab …
		const rightOffset = actionsBox!.x + actionsBox!.width - (lastBox!.x + lastBox!.width);
		expect(rightOffset).toBeLessThanOrEqual(2);
		// … und links bleibt deutlicher Freiraum (Beweis für flex-end statt flex-start).
		expect(firstBox!.x - actionsBox!.x).toBeGreaterThanOrEqual(20);
	});

	/**
	 * AK4 — Das Breiten-Verhalten gilt auch auf schmalen Viewports, ohne horizontalen Scroll.
	 * Bezug: docs/spec/issue-761.md, Schritt 3 (Responsive-Verhalten bei verschiedenen Viewport-Größen).
	 */
	test('AK4 (Mobile): Titel und Beschreibung volle Breite auch auf schmalem Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await openTaskForm(page);

		await expectFieldFillsRow(page, 'task-title', 'kol-input-text');
		await expectFieldFillsRow(page, 'task-description', 'kol-textarea');

		// Kein horizontaler Scroll durch die Felder.
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBe(375);
	});

	/**
	 * AK5 — Die Aktionen bleiben mobil im Viewport, rechtsbündig, mit ausreichend großen Touch-Zielen.
	 * Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Touch-Ziele min. 44x44px).
	 */
	test('AK5 (Mobile): Aktionen rechtsbündig im Viewport mit Touch-Zielen ab 44px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await openTaskForm(page);

		const actions = page.locator('[data-testid="task-actions"]');
		await expect(actions).toBeVisible();

		const actionsBox = await actions.boundingBox();
		expect(actionsBox).not.toBeNull();
		expect(actionsBox!.x).toBeGreaterThanOrEqual(0);
		expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(375);

		const buttons = actions.locator('button');
		await expect(buttons).toHaveCount(2);

		const lastBox = await buttons.last().boundingBox();
		expect(lastBox).not.toBeNull();
		expect(actionsBox!.x + actionsBox!.width - (lastBox!.x + lastBox!.width)).toBeLessThanOrEqual(2);

		const buttonCount = await buttons.count();
		for (let i = 0; i < buttonCount; i++) {
			const buttonBox = await buttons.nth(i).boundingBox();
			expect(buttonBox).not.toBeNull();
			expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
			expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
		}
	});

	/**
	 * AK6 — Logische Tab-Reihenfolge und sichtbarer Focus-Indikator am Titel-Feld. Das Mikrofon-Overlay
	 * ist bewusst `tabIndex={-1}` (#522), Tab führt daher vom Titel-Feld direkt zum Lektorat-Button.
	 * Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Logical Tab-Order, Focus-Indikator).
	 */
	test('AK6 (A11y): Logische Tab-Order und sichtbarer Focus-Indikator', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskForm(page);

		const titleInput = page.locator('[data-testid="task-title"] input').first();
		await expect(titleInput).toBeVisible();
		await titleInput.focus();
		await expect(titleInput).toBeFocused();

		// Focus-Indikator: KoliBri rendert den Ring auf einem Element der Feld-Box (Shadow DOM),
		// nicht auf dem nativen Input — daher die Vorfahren-Kette bis zum Wrapper prüfen.
		const hasFocusRing = await titleInput.evaluate((el: HTMLElement) => {
			let node: Element | null = el;
			while (node !== null && !(node instanceof HTMLElement && node.dataset.testid === 'task-title')) {
				const styles = window.getComputedStyle(node as HTMLElement);
				if (styles.outlineStyle !== 'none' && parseFloat(styles.outlineWidth) > 0) {
					return true;
				}
				node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null;
			}
			return false;
		});
		expect(hasFocusRing).toBe(true);

		// Tab-Order: Titel-Feld → Lektorat-Button derselben Zeile.
		await page.keyboard.press('Tab');
		await expect(fieldRow(page, 'task-title').locator('kol-button')).toBeFocused();
	});

	/**
	 * AK7 — Screenreader-Semantik: Titel und Beschreibung sind über ihre sichtbaren Labels zugänglich,
	 * der Titel ist als Pflichtfeld ausgezeichnet.
	 * Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Screenreader-Support).
	 */
	test('AK7 (A11y): Titel und Beschreibung haben zugängliche Namen', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskForm(page);

		await expect(page.locator('[data-testid="task-title"]').getByRole('textbox', { name: /titel/i })).toBeVisible();
		await expect(
			page.locator('[data-testid="task-description"]').getByRole('textbox', { name: /beschreibung/i }),
		).toBeVisible();

		await expect(page.locator('[data-testid="task-title"] input').first()).toHaveJSProperty('required', true);
	});
});
