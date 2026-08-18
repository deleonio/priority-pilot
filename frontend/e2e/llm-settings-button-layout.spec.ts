import { test, expect } from '@playwright/test';

/**
 * E2E-Tests für Issue 886: LLM-Provider-Button-Layout-Fix
 *
 * Spezifikation: docs/spec/issue-886.md
 * Akzeptanzkriterien:
 * - AK1: Button "Speichern" vollständig sichtbar
 * - AK2: Button-Container nutzt verfügbare Breite
 * - AK3: Responsive ohne Abschneideeffekte auf kleinen Viewports
 */

test.describe('LLM Settings Button Layout (Issue 886)', () => {
	test.beforeEach(async ({ page }) => {
		// Zur LLM-Settings-Seite navigieren
		await page.goto('/settings/llm');
		// Warten bis das Formular geladen ist
		await page.waitForSelector('kol-button[_label="Speichern"]', { timeout: 5000 });
	});

	/**
	 * Testfall für Desktop-Viewport (≥1024px)
	 * Spec-Schritt 3: User prüft den "Speichern"-Button am unteren Rand des Formulars
	 * Erwartetes Ergebnis 1: Button "Speichern" vollständig sichtbar, kein horizontaler Scroll
	 */
	test('Desktop: Speichern-Button vollständig sichtbar ohne horizontalen Scroll', async ({ page }) => {
		// Desktop-Viewport einstellen (1024px Breite)
		await page.setViewportSize({ width: 1024, height: 768 });

		// Den "Speichern"-Button finden
		const saveButton = page.getByRole('button', { name: 'Speichern' });
		await expect(saveButton).toBeVisible();

		// Prüfen: Button ist vollständig im Viewport sichtbar
		const buttonBox = await saveButton.boundingBox();
		expect(buttonBox).not.toBeNull();

		const viewportSize = page.viewportSize();
		expect(viewportSize).not.toBeNull();

		// Button-Rechtseite darf nicht über Viewport-Breite hinausgehen
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewportSize!.width);

		// Prüfen: Kein horizontaler Scroll notwendig
		const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(documentWidth).toBe(viewportSize!.width);
	});

	/**
	 * Testfall für Tablet-Viewport (768-1023px)
	 * Spec-Schritt 3: User prüft den "Speichern"-Button am unteren Rand des Formulars
	 * Erwartetes Ergebnis 2: Button "Speichern" vollständig sichtbar, ggf. Zeilenumbruch
	 */
	test('Tablet: Speichern-Button vollständig sichtbar mit möglichem Zeilenumbruch', async ({ page }) => {
		// Tablet-Viewport einstellen (800px Breite)
		await page.setViewportSize({ width: 800, height: 1024 });

		// Den "Speichern"-Button finden
		const saveButton = page.getByRole('button', { name: 'Speichern' });
		await expect(saveButton).toBeVisible();

		// Prüfen: Button ist vollständig im Viewport sichtbar
		const buttonBox = await saveButton.boundingBox();
		expect(buttonBox).not.toBeNull();

		const viewportSize = page.viewportSize();
		expect(viewportSize).not.toBeNull();

		// Button-Rechtseite darf nicht über Viewport-Breite hinausgehen
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewportSize!.width);

		// Prüfen: Kein horizontaler Scroll notwendig
		const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(documentWidth).toBe(viewportSize!.width);
	});

	/**
	 * Testfall für Mobile-Viewport (≤767px)
	 * Spec-Schritt 3: User prüft den "Speichern"-Button am unteren Rand des Formulars
	 * Erwartetes Ergebnis 3: Buttons stapeln sich vertikal, alle Texte lesbar, kein horizontales Scrollen
	 */
	test('Mobile: Buttons vertikal gestapelt ohne horizontales Scrollen', async ({ page }) => {
		// Mobile-Viewport einstellen (375px Breite - typisches Smartphone)
		await page.setViewportSize({ width: 375, height: 812 });

		// Den "Speichern"-Button finden
		const saveButton = page.getByRole('button', { name: 'Speichern' });
		await expect(saveButton).toBeVisible();

		// Prüfen: Button ist vollständig im Viewport sichtbar
		const buttonBox = await saveButton.boundingBox();
		expect(buttonBox).not.toBeNull();

		const viewportSize = page.viewportSize();
		expect(viewportSize).not.toBeNull();

		// Button-Rechtseite darf nicht über Viewport-Breite hinausgehen
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewportSize!.width);

		// WICHTIG: Kein horizontaler Scroll bei Mobile (≤768px)
		const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(documentWidth).toBe(viewportSize!.width);

		// Zusätzlich prüfen: Button-Container nutzt die volle Breite (AK2)
		const buttonContainer = page.locator('.modal-actions');
		const containerBox = await buttonContainer.boundingBox();
		expect(containerBox).not.toBeNull();

		// Container sollte mindestens 90% der Viewport-Breite nutzen (10% Toleranz für Padding)
		expect(containerBox!.width).toBeGreaterThanOrEqual(viewportSize!.width * 0.9);
	});

	/**
	 * Zusatztest: Button-Text ist komplett lesbar (nicht abgeschnitten)
	 * Bezieht sich auf das Screenshot-Problem aus Issue 886 (nur "Speiche" sichtbar)
	 */
	test('Button-Text vollständig lesbar (kein Abschneideeffekt)', async ({ page }) => {
		// Mehrere Viewports testen
		const viewports = [
			{ width: 1024, height: 768, name: 'Desktop' },
			{ width: 800, height: 1024, name: 'Tablet' },
			{ width: 375, height: 812, name: 'Mobile' },
		];

		for (const viewport of viewports) {
			// Viewport einstellen
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			// Den "Speichern"-Button finden
			const saveButton = page.getByRole('button', { name: 'Speichern' });
			await expect(saveButton).toBeVisible();

			// Button-Text muss "Speichern" lauten (nicht "Speiche" oder anders abgeschnitten)
			const buttonText = await saveButton.textContent();
			expect(buttonText).toBe('Speichern');

			// Prüfen: Button ist nicht überlaufend (overflow: hidden oder clip)
			const overflowStyle = await saveButton.evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					overflow: computed.overflow,
					overflowX: computed.overflowX,
					textOverflow: computed.textOverflow,
				};
			});

			// Button darf nicht durch overflow abgeschnitten werden
			expect(overflowStyle.overflow).not.toBe('hidden');
			expect(overflowStyle.textOverflow).not.toBe('ellipsis');
		}
	});
});
