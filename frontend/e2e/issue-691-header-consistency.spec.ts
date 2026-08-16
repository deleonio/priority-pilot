import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #691 „Header-Konsistenz über alle Viewports" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Das Header-Menü zeigt auf allen Bildschirmbreiten (Desktop, Tablet, Mobile) immer dieselbe
 * Menüstruktur. Das Bürgermenü wird ersatzlos entfernt – keine unterschiedliche Menüführung je nach
 * Viewport-Breite.
 *
 * Spezifikation: docs/spec/issue-691.md
 *
 * Diese Tests sind **rot**, bis das Bürgermenü aus dem Header-Menu entfernt ist und die Menüstruktur
 * über alle Viewports konsistent ist.
 */
test.describe('#691 Header-Konsistenz über alle Viewports', () => {
	/**
	 * AK1 (Desktop) — Bürgermenü nicht vorhanden bei Desktop-Breite (>1024px).
	 * RED, solange das Bürgermenü noch im Header existiert.
	 */
	test('AK1 (Desktop): Bürgermenü ist bei 1280×800 nicht vorhanden (Count 0)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Bürgermenü darf nirgends im Header existieren — Count muss 0 sein.
		await expect(header.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
	});

	/**
	 * AK2 (Tablet) — Bürgermenü nicht vorhanden bei Tablet-Breite (768–1024px).
	 * RED, solange das Bürgermenü noch im Header existiert.
	 */
	test('AK2 (Tablet): Bürgermenü ist bei 768×1024 nicht vorhanden (Count 0)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Bürgermenü darf nirgends im Header existieren — Count muss 0 sein.
		await expect(header.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
	});

	/**
	 * AK3 (Mobile) — Bürgermenü nicht vorhanden bei Mobile-Breite (<768px).
	 * RED, solange das Bürgermenü noch im Header existiert.
	 */
	test('AK3 (Mobile): Bürgermenü ist bei 375×812 nicht vorhanden (Count 0)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Bürgermenü darf nirgends im Header existieren — Count muss 0 sein.
		await expect(header.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Bürger/ })).toHaveCount(0);
	});

	/**
	 * AK4 — Menüstruktur-Konsistenz: Dieselben Toolbar-Buttons sind bei allen Viewports vorhanden.
	 * Prüft, dass keine unterschiedliche Menüstruktur je nach Viewport-Breite existiert.
	 * RED, solange Menüpunkte je nach Breite unterschiedlich sind (aktuell: Hilfe fehlt bei Mobile).
	 */
	test('AK4: Menüstruktur ist konsistent über alle Viewports', async ({ page }) => {
		const viewports = [
			{ width: 1280, height: 800, name: 'Desktop' },
			{ width: 768, height: 1024, name: 'Tablet' },
			{ width: 375, height: 812, name: 'Mobile' },
		];

		// Erwartete Buttons bei allen Viewports (ohne Bürgermenü)
		const expectedButtons = ['Neuen Task anlegen', 'Hilfe', 'Einstellungen', 'Abmelden'];

		const foundButtons: Map<string, number> = new Map();

		for (const viewport of viewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.goto('/');
			await waitForStableView(page);

			const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
			await expect(toolbar).toBeVisible();

			// Alle sichtbaren Buttons in der Toolbar zählen.
			const allButtons = await toolbar.getByRole('button').all();
			const visibleButtonLabels: string[] = [];

			for (const btn of allButtons) {
				if (await btn.isVisible()) {
					const label = await btn.getAttribute('aria-label');
					if (label) visibleButtonLabels.push(label);
				}
			}

			// Prüfen: Alle erwarteten Buttons sind irgendwo im Header erreichbar.
			const header = page.getByRole('banner');
			for (const buttonLabel of expectedButtons) {
				const buttonCount = await header.getByRole('button', { name: buttonLabel }).count();

				if (buttonCount === 0) {
					// Mutations-Probe: Wenn ein Button gar nicht existiert, schlägt der Test rot.
					expect(
						buttonCount,
						`${buttonLabel} muss bei ${viewport.name} irgendwo im Header erreichbar sein`,
					).toBeGreaterThan(0);
				}

				// Count für diesen Button merken.
				foundButtons.set(buttonLabel, (foundButtons.get(buttonLabel) || 0) + buttonCount);
			}

			// Prüfen: Bürgermenü ist bei diesem Viewport nicht vorhanden.
			await expect(
				toolbar.getByRole('button', { name: /Bürger/ }),
				`Bürgermenü darf bei ${viewport.name} nicht existieren`,
			).toHaveCount(0);
		}

		// All-Quantor-Test-Falle verhindern: Überprüfen, dass wir überhaupt Buttons gefunden haben.
		const totalButtons = Array.from(foundButtons.values()).reduce((sum, count) => sum + count, 0);
		expect(totalButtons, 'Es müssen überhaupt Buttons gefunden werden (All-Quantor-Falle)').toBeGreaterThan(0);

		// Zusatz-Check: Alle erwarteten Buttons wurden bei mindestens einem Viewport gefunden.
		for (const buttonLabel of expectedButtons) {
			const count = foundButtons.get(buttonLabel) || 0;
			expect(count, `${buttonLabel} muss bei mindestens einem Viewport gefunden worden sein`).toBeGreaterThan(0);
		}
	});

	/**
	 * AK5 (Regression) — Bestehende Header-Aktionen bleiben bei allen Viewports bedienbar.
	 * Prüft, dass das Entfernen des Bürgermenüs keine Regressionen verursacht.
	 */
	test('AK5 (Regression): Bestehende Header-Aktionen bleiben bei allen Viewports bedienbar', async ({ page }) => {
		const viewports = [
			{ width: 1280, height: 800 },
			{ width: 768, height: 1024 },
			{ width: 375, height: 812 },
		];

		for (const viewport of viewports) {
			await page.setViewportSize(viewport);
			await page.goto('/');
			await waitForStableView(page);

			const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
			await expect(toolbar).toBeVisible();

			// „Neuen Task anlegen" muss bei allen Viewports funktionieren.
			const createTaskBtn = toolbar.getByRole('button', { name: 'Neuen Task anlegen' });
			await expect(createTaskBtn).toBeVisible();
			await createTaskBtn.click();

			// Dialog öffnet sich.
			await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();

			// Dialog schließen für nächsten Testlauf.
			await page.keyboard.press('Escape');
		}
	});
});
