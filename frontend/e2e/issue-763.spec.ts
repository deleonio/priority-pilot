import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #763 „Säulen-Gewichtung Layout-Optimierung".
 *
 * Ziel: Keine visuellen Überlagerungen im Säulen-Gewichtungs-Bereich, Range Slider klar positioniert,
 * responsives Layout funktioniert auf verschiedenen Viewports.
 *
 * Spec: docs/spec/issue-763.md
 *
 * Diese Tests sind **rot**, solange visuelle Überlagerungen im Säulen-Gewichtungs-Bereich bestehen.
 */
test.describe('#763 Säulen-Gewichtung Layout-Optimierung', () => {
	/** Toleranz für Rundungen der Layout-Engine (Sub-Pixel). */
	const TOLERANCE_PX = 2;

	/**
	 * Hilfsfunktion — Navigiert zur Säulen-Gewichtungsseite und wartet auf stabilen View.
	 */
	const navigateToPillarWeights = async (page: Page) => {
		await page.goto('/');
		await waitForStableView(page);

		// Navigiere zu den Einstellungen, dann zur Säulen-Gewichtung
		const settingsButton = page.getByRole('button', { name: /Einstellungen/i });
		await expect(settingsButton).toBeVisible();
		await settingsButton.click();
		await waitForStableView(page);

		// Säulen-Gewichtungs-Dialog öffnen
		const pillarWeightsButton = page
			.getByRole('button', { name: /Säulen.*Gewichtung/i })
			.or(page.getByRole('button', { name: /Gewichtung/i }));
		await expect(pillarWeightsButton).toBeVisible();
		await pillarWeightsButton.click();
		await waitForStableView(page);
	};

	/**
	 * Hilfsfunktion — Prüft, ob Range Slider-Elemente sichtbar sind.
	 */
	const expectSlidersVisible = async (page: Page) => {
		const sliders = page.locator('kol-slider').or(page.locator('[role="slider"]'));
		const count = await sliders.count();
		expect(count, 'Es müssen Range Slider vorhanden sein').toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			await expect(sliders.nth(i), `Slider ${i} muss sichtbar sein`).toBeVisible();
		}
	};

	/**
	 * AK1 — Keine visuellen Überlagerungen im Säulen-Gewichtungs-Bereich (Desktop).
	 * RED, solange Elemente sich überlappen.
	 */
	test('AK1: Keine visuellen Überlagerungen bei Desktop (1280px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await navigateToPillarWeights(page);

		const sliders = page.locator('kol-slider').or(page.locator('[role="slider"]'));
		const count = await sliders.count();
		expect(count, 'Es müssen Range Slider vorhanden sein').toBeGreaterThan(0);

		// Prüfe, dass alle Slider sichtbar sind und sich nicht überlappen
		for (let i = 0; i < count; i++) {
			const slider = sliders.nth(i);
			await expect(slider, `Slider ${i} muss sichtbar sein`).toBeVisible();

			const box = await slider.boundingBox();
			expect(box, `Slider ${i} muss eine Boundingbox haben`).not.toBeNull();

			// Prüfe Überlappung mit anderen Slidern
			for (let j = i + 1; j < count; j++) {
				const otherSlider = sliders.nth(j);
				const otherBox = await otherSlider.boundingBox();
				expect(otherBox, `Slider ${j} muss eine Boundingbox haben`).not.toBeNull();

				// Keine horizontale Überlappung
				const horizontalOverlap = !(box!.x + box!.width <= otherBox!.x || otherBox!.x + otherBox!.width <= box!.x);
				// Keine vertikale Überlappung
				const verticalOverlap = !(box!.y + box!.height <= otherBox!.y || otherBox!.y + otherBox!.height <= box!.y);

				expect(
					horizontalOverlap && verticalOverlap,
					`Slider ${i} (${JSON.stringify(box)}) und ${j} (${JSON.stringify(otherBox)}) dürfen sich nicht überlappen`,
				).toBe(false);
			}
		}
	});

	/**
	 * AK2 — Range Slider sind klar positioniert bei Tablet (768px).
	 */
	test('AK2: Range Slider klar positioniert bei Tablet (768px)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await navigateToPillarWeights(page);

		await expectSlidersVisible(page);
	});

	/**
	 * AK3 — Range Slider sind klar positioniert bei Mobile (375px).
	 */
	test('AK3: Range Slider klar positioniert bei Mobile (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await navigateToPillarWeights(page);

		await expectSlidersVisible(page);
	});

	/**
	 * AK4 — Beschreibungstexte sind sinnvoll platziert (keine Überlagerung mit Sliders).
	 * RED, solange Beschreibungstexte mit Range Sliders überlappen.
	 */
	test('AK4: Beschreibungstexte sinnvoll platziert (Desktop)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await navigateToPillarWeights(page);

		const sliders = page.locator('kol-slider').or(page.locator('[role="slider"]'));
		const descriptions = page.locator('.pillar-description').or(page.locator('[class*="description"]'));

		const sliderCount = await sliders.count();
		const descriptionCount = await descriptions.count();

		expect(sliderCount, 'Es müssen Range Slider vorhanden sein').toBeGreaterThan(0);
		expect(descriptionCount, 'Es müssen Beschreibungstexte vorhanden sein').toBeGreaterThan(0);

		// Prüfe, dass keine Beschreibung mit einem Slider überlappt
		for (let i = 0; i < descriptionCount; i++) {
			const description = descriptions.nth(i);
			const descBox = await description.boundingBox();
			expect(descBox, `Beschreibung ${i} muss eine Boundingbox haben`).not.toBeNull();

			for (let j = 0; j < sliderCount; j++) {
				const slider = sliders.nth(j);
				const sliderBox = await slider.boundingBox();
				expect(sliderBox, `Slider ${j} muss eine Boundingbox haben`).not.toBeNull();

				// Keine Überlappung
				const horizontalOverlap = !(
					descBox!.x + descBox!.width <= sliderBox!.x || sliderBox!.x + sliderBox!.width <= descBox!.x
				);
				const verticalOverlap = !(
					descBox!.y + descBox!.height <= sliderBox!.y || sliderBox!.y + sliderBox!.height <= descBox!.y
				);

				expect(
					horizontalOverlap && verticalOverlap,
					`Beschreibung ${i} (${JSON.stringify(descBox)}) und Slider ${j} (${JSON.stringify(sliderBox)}) dürfen sich nicht überlappen`,
				).toBe(false);
			}
		}
	});

	/**
	 * AK5 — Stack-Layout auf Mobile (<768px).
	 * RED, solange kein Stack-Layout vorhanden ist.
	 */
	test('AK5: Stack-Layout auf Mobile (<768px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await navigateToPillarWeights(page);

		// Prüfe, dass Säulen-Cards untereinander angeordnet sind (Stack-Layout)
		const pillarCards = page.locator('.pillar-card').or(page.locator('[class*="pillar"]')).or(page.locator('kol-card'));
		const count = await pillarCards.count();
		expect(count, 'Es müssen Säulen-Cards vorhanden sein').toBeGreaterThan(0);

		// Im Stack-Layout sollte jede Card unter der vorherigen beginnen (y-Position steigt)
		let previousY = -1;
		for (let i = 0; i < count; i++) {
			const card = pillarCards.nth(i);
			const box = await card.boundingBox();
			expect(box, `Card ${i} muss eine Boundingbox haben`).not.toBeNull();

			if (previousY >= 0) {
				expect(box!.y, `Card ${i} muss unter Card ${i - 1} liegen (y=${previousY} → y=${box!.y})`).toBeGreaterThan(
					previousY,
				);
			}
			previousY = box!.y;
		}
	});

	/**
	 * AK6 — Touch-Ziele mindestens 44px (Mobile-First).
	 * RED, solange Touch-Ziele kleiner als 44px sind.
	 */
	test('AK6: Touch-Ziele mindestens 44px bei Mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await navigateToPillarWeights(page);

		const sliders = page.locator('kol-slider').or(page.locator('[role="slider"]'));
		const count = await sliders.count();
		expect(count, 'Es müssen Range Slider vorhanden sein').toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const slider = sliders.nth(i);
			const box = await slider.boundingBox();
			expect(box, `Slider ${i} muss eine Boundingbox haben`).not.toBeNull();

			const minDimension = Math.min(box!.width, box!.height);
			expect(
				minDimension,
				`Slider ${i} muss mindestens 44px Touch-Ziel haben (aktuell: ${minDimension}px)`,
			).toBeGreaterThanOrEqual(44 - TOLERANCE_PX);
		}
	});
});
