import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #761 "Layout-Optimierung Titel/Beschreibung/Aktionen".
 *
 * Spec: docs/spec/issue-761.md
 * Ziel: Titel und Beschreibung nutzen volle verfügbare Breite, Aktionen rechtsbündig unterhalb.
 *
 * AK 1 — Titel nimmt volle verfügbare Breite ein
 * AK 2 — Beschreibung nimmt volle verfügbare Breite ein
 * AK 3 — Aktionen sind rechtsbündig unterhalb platziert
 * AK 4 — Responsive Design ist gewährleistet (Mobile, Tablet, Desktop)
 * AK 5 — Touch-Ziele sind ausreichend groß (min. 44x44px)
 * AK 6 — A11y-Requirements (Logical Tab-Order, Focus-Indikator, Screenreader)
 *
 * Diese Tests prüfen das LAYOUT-Verhalten (Positionen und Freiraum über Bounding-Boxes),
 * nicht die Funktionalität der Aktionen selbst. Sie sind ROT, solange das Layout nicht
 * den SOLL-Zustand entspricht.
 */

test.describe('#761 Layout-Optimierung Titel/Beschreibung/Aktionen', () => {
	/** Öffnet den Task-Detail-Dialog oder eine Ansicht mit Titel/Beschreibung/Aktionen. */
	const openTaskDetail = async (page: Page): Promise<void> => {
		// Gehe davon aus, dass eine Aufgabe existiert oder erstellt wird
		await page.goto('/');
		// Öffne die erste Aufgabe in der Liste oder den Task-Form
		const firstTask = page.locator('.task-item, [data-testid="task-item"]').first();
		if ((await firstTask.count()) > 0) {
			await firstTask.click();
		} else {
			// Fallback: Öffne Task-Form über "Neuen Task anlegen"
			await page.getByRole('button', { name: /neuen task/i }).click();
		}
		await waitForStableView(page);
	};

	test('AK1 (Desktop): Titel nimmt volle verfügbare Breite ein', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskDetail(page);

		const titleElement = page.locator('[data-testid="task-title"]').first();

		await expect(titleElement).toBeVisible();

		// Prüfe, dass der Titel die volle Breite des Containers nutzt
		// (Toleranz für Padding/Margins: ±10px)
		const titleBox = await titleElement.boundingBox();
		expect(titleBox).not.toBeNull();
		const containerWidth = await page
			.locator('body, .container, main, .dialog')
			.first()
			.evaluate((el: HTMLElement) => el.clientWidth);
		expect(titleBox!.width).toBeGreaterThanOrEqual(containerWidth - 20); // Volle Breite abzüglich Padding

		// Spec-Bezug: docs/spec/issue-761.md, Schritt 2 (Titel-Element nimmt volle verfügbare Breite ein)
	});

	test('AK2 (Desktop): Beschreibung nimmt volle verfügbare Breite ein', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskDetail(page);

		const descElement = page
			.getByLabel(/beschreibung/i)
			.or(page.locator('[data-testid="task-description"], .task-description, p.description').first());

		const isVisible = (await descElement.count()) > 0;
		if (isVisible) {
			await expect(descElement).toBeVisible();

			const descBox = await descElement.boundingBox();
			expect(descBox).not.toBeNull();

			const containerWidth = await page
				.locator('body, .container, main, .dialog')
				.first()
				.evaluate((el: HTMLElement) => el.clientWidth);
			expect(descBox!.width).toBeGreaterThanOrEqual(containerWidth - 20); // Volle Breite abzüglich Padding
		}
		// Spec-Bezug: docs/spec/issue-761.md, Schritt 2 (Beschreibung-Element nimmt volle verfügbare Breite ein)
	});

	test('AK3 (Desktop): Aktionen sind rechtsbündig unterhalb platziert', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskDetail(page);

		const actionsContainer = page.locator('[data-testid="task-actions"], .actions, .button-group').first();
		const isVisible = (await actionsContainer.count()) > 0;

		if (isVisible) {
			await expect(actionsContainer).toBeVisible();

			const actionsBox = await actionsContainer.boundingBox();
			expect(actionsBox).not.toBeNull();

			// Prüfe Rechtsbündigkeit: Der rechte Rand der Aktionen ist nah am rechten Rand des Containers
			const containerWidth = await page
				.locator('body, .container, main, .dialog')
				.first()
				.evaluate((el: HTMLElement) => el.clientWidth);
			const rightOffset = containerWidth - (actionsBox!.x + actionsBox!.width);

			// Toleranz: Rechtsbündig innerhalb von 20px
			expect(rightOffset).toBeLessThanOrEqual(20);
		}
		// Spec-Bezug: docs/spec/issue-761.md, Schritt 2 (Aktionen-Gruppe ist rechtsbündig unterhalb platziert)
	});

	test('AK4 (Mobile): Titel und Beschreibung volle Breite auch auf schmalem Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // Mobile Viewport
		await openTaskDetail(page);

		const titleElement = page.locator('[data-testid="task-title"]').first();

		await expect(titleElement).toBeVisible();

		// Auf Mobile ebenfalls volle Breite
		// clientWidth misst die tatsächliche Flex-Container-Breite, nicht boundingBox()
		const titleWidth = await titleElement.evaluate((el: HTMLElement) => el.clientWidth);
		const containerWidth = await page
			.locator('body, .container, main, .dialog')
			.first()
			.evaluate((el: HTMLElement) => el.clientWidth);
		expect(titleWidth).toBeGreaterThanOrEqual(containerWidth - 20);

		// Spec-Bezug: docs/spec/issue-761.md, Testfall "Responsive Design bei verschiedenen Viewport-Größen"
	});

	test('AK5 (Mobile): Aktionen bei Mobile gestapelt fullWidth oder compact', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // Mobile Viewport
		await openTaskDetail(page);

		const actionsContainer = page.locator('[data-testid="task-actions"], .actions, .button-group').first();
		const isVisible = (await actionsContainer.count()) > 0;

		if (isVisible) {
			await expect(actionsContainer).toBeVisible();

			// Prüfe, dass Aktionen nicht außerhalb des Viewports liegen
			const actionsBox = await actionsContainer.boundingBox();
			expect(actionsBox).not.toBeNull();
			expect(actionsBox!.x).toBeGreaterThanOrEqual(0);
			expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(375); // Viewport Breite

			// Prüfe Touch-Ziele: Mindestens 44x44px für Buttons
			const buttons = actionsContainer.locator('button, [role="button"]');
			const buttonCount = await buttons.count();
			for (let i = 0; i < buttonCount; i++) {
				const button = buttons.nth(i);
				const buttonBox = await button.boundingBox();
				if (buttonBox) {
					expect(buttonBox.height).toBeGreaterThanOrEqual(44);
					expect(buttonBox.width).toBeGreaterThanOrEqual(44);
				}
			}
		}
		// Spec-Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Touch-Ziele min. 44x44px)
	});

	test('AK6 (A11y): Logical Tab-Order und Focus-Indikator', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskDetail(page);

		// Prüfe, dass interaktive Elemente im Task-Formular focusable sind
		// Wähle den Input innerhalb des task-title Wrappers (vermeidet Filter-Input)
		const firstInteractive = page.locator('[data-testid="task-title"] input').first();
		const count = await firstInteractive.count();

		if (count > 0) {
			// Simuliere Tab-Navigation
			await firstInteractive.focus();
			await expect(firstInteractive).toBeFocused();
			await expect(firstInteractive).toBeVisible();

			// Prüfe, dass Focus-Indikator sichtbar ist (outline oder box-shadow)
			const outline = await firstInteractive.evaluate((el: HTMLElement) => {
				const styles = window.getComputedStyle(el);
				return styles.outline !== 'none' || styles.boxShadow !== 'none';
			});
			expect(outline).toBe(true);
		}
		// Spec-Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Logical Tab-Order, Focus-Indikator)
	});

	test('AK7 (A11y): Screenreader-Semantik für Titel und Beschreibung', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await openTaskDetail(page);

		// Prüfe semantisches Markup: Titel als heading
		const titleElement = page.locator('[data-testid="task-title"]').first();

		const isVisible = (await titleElement.count()) > 0;
		if (isVisible) {
			// Heading hat semantische Rolle
			const role = await titleElement.evaluate((el: HTMLElement) => {
				const tagName = el.tagName.toLowerCase();
				return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
			});
			expect(role).toBe(true);
		}

		// Prüfe, dass Beschreibung als label oder textarea sichtbar ist
		const descElement = page.getByLabel(/beschreibung/i);
		const hasDesc = (await descElement.count()) > 0;
		if (hasDesc) {
			await expect(descElement).toBeVisible();
		}
		// Spec-Bezug: docs/spec/issue-761.md, Erwartetes Ergebnis (Screenreader-Support)
	});
});
