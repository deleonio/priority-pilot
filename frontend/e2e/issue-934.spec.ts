import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-e2e für #934 — „InputRange-Mindestbreite 300 px + doppelte Säulen-Beschreibung entfernen".
 *
 * Vertrag (Spec: docs/spec/issue-934.md):
 *  - AK1: `kol-input-range` ist bei Desktop (1280 px) an allen Verwendungsstellen ≥ 300 px breit,
 *    sofern der Container das hergibt. Verprobt am Säulen-Tab und im TaskForm-Bearbeitungsdialog;
 *    das DependencyModal-Gewicht teilt sich dieselbe globale Host-Regel (Spec, Abgrenzungen).
 *  - AK2: Bei 375 px entsteht durch die Mindestbreite kein horizontaler Scrollbalken
 *    (Schutz-Test: heute grün, rot sobald ein min-width ohne `min(300px, 100%)`-Fallback landet).
 *
 * Messgrundlage ist der Light-DOM-Host `kol-input-range` (boundingBox = Border-Box) — die 300 px
 * beziehen sich auf das Host-Element, damit Slider und Zahlenfeld im Shadow-DOM nicht umbrechen.
 */
test.describe('#934 InputRange-Mindestbreite', () => {
	/** Toleranz für Sub-Pixel-Rundungen der Layout-Engine. */
	const TOLERANCE_PX = 1;
	const MIN_WIDTH_PX = 300;

	/** Navigiert auf den Säulen-Tab der Einstellungen (Quelle: issue-763.spec.ts). */
	const navigateToPillarWeights = async (page: Page) => {
		await page.goto('/');
		await waitForStableView(page);

		const settingsButton = page.getByRole('button', { name: /Einstellungen/i });
		await expect(settingsButton).toBeVisible();
		await settingsButton.click();
		await waitForStableView(page, 'Priority Pilot');

		const pillarsTab = page.getByRole('button', { name: /^Säulen$/ }).or(page.getByText('Säulen', { exact: true }));
		await expect(pillarsTab).toBeVisible();
		await pillarsTab.click();
		await waitForStableView(page, 'Säulen-Gewichtung');
	};

	/** Misst alle `kol-input-range`-Hosts und assertiert die Mindestbreite je Fund (AK1). */
	const expectAllRangesAtLeast300px = async (page: Page, context: string) => {
		const ranges = page.locator('kol-input-range');
		const count = await ranges.count();
		// All-Quantor-Guard: über einer leeren Menge wäre der Test dauerhaft grün.
		expect(count, `${context}: Es müssen Range-Felder vorhanden sein`).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const box = await ranges.nth(i).boundingBox();
			expect(box, `${context}: Range ${i} muss eine Boundingbox haben`).not.toBeNull();
			expect(
				box!.width,
				`${context}: Range ${i} muss ≥ ${MIN_WIDTH_PX} px breit sein (aktuell ${box!.width}px)`,
			).toBeGreaterThanOrEqual(MIN_WIDTH_PX - TOLERANCE_PX);
		}
	};

	/**
	 * AK1 — Säulen-Gewichtung bei 1280 px: jeder `kol-input-range` ≥ 300 px.
	 * Rot, solange die Cards (`minmax(240px, 1fr)` + Padding) die Slider auf ~250 px quetschen.
	 */
	test('AK1: kol-input-range auf dem Säulen-Tab mindestens 300 px breit (1280 px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await navigateToPillarWeights(page);
		await expectAllRangesAtLeast300px(page, 'Säulen-Tab');
	});

	/**
	 * AK1 (zweite Verwendungsstelle) — TaskForm: Priorität + Aufwand bei 1280 px jeweils ≥ 300 px.
	 * Der Dialog bietet das bei 1280-px-Viewport her (notfalls durch Umbruch der `.range-inputs-row`).
	 */
	test('AK1: TaskForm-Range-Felder (Priorität/Aufwand) mindestens 300 px breit (1280 px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		// Task anlegen, damit die Aufgaben-Tabelle einen Bearbeiten-Dialog bietet.
		const response = await page.request.post('/api/v1/tasks', {
			data: { title: 'e2e #934 Range-Breite', priority: 3, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };

		try {
			await page.reload();
			await waitForStableView(page);
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
			await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
			await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
			await waitForStableView(page);

			// Vorher verproben, dass es wirklich die TaskForm-Range-Felder sind (Priorität + Aufwand).
			await expect(page.locator('input[type="range"][min="1"][max="5"]')).toBeVisible();
			await expectAllRangesAtLeast300px(page, 'TaskForm');
		} finally {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	});

	/**
	 * AK2 — Mobile: kein horizontaler Überlauf durch die Mindestbreite.
	 * Die App-Shell clippt mit `overflow-x: hidden` (app.css) — ein `scrollWidth`-Check kann
	 * deshalb strukturell nie rot werden (stiller Overflow = abgeschnittene Slider). Gemessen
	 * wird daher die Bounding-Box: jedes `kol-input-range` muss vollständig im Viewport liegen.
	 * Bei 375 px schluckt das Card-Padding ~33 px Chrome, ein naives `min-width: 300px` fällt
	 * dort nicht auf; erst bei 320 px (Content < 300 px) clippt die naive Regel den Slider —
	 * deshalb wird zusätzlich zum Issue-Viewport 375 auch 320 geprüft (Mutations-Probe:
	 * `kol-input-range { min-width: 300px }` ohne `min(300px, 100%)`-Fallback → 320er-Lauf rot).
	 */
	test('AK2: Range-Felder bei Mobile vollständig sichtbar, nicht geclippt (375 px und 320 px)', async ({ page }) => {
		for (const viewportWidth of [375, 320]) {
			await page.setViewportSize({ width: viewportWidth, height: 812 });
			await navigateToPillarWeights(page);

			const ranges = page.locator('kol-input-range');
			const count = await ranges.count();
			expect(count, `viewportWidth=${viewportWidth}: Es müssen Range-Felder vorhanden sein`).toBeGreaterThan(0);

			for (let i = 0; i < count; i++) {
				const box = await ranges.nth(i).boundingBox();
				expect(box, `viewportWidth=${viewportWidth}: Range ${i} muss eine Boundingbox haben`).not.toBeNull();
				expect(box!.width, `viewportWidth=${viewportWidth}: Range ${i} darf nicht auf 0 kollabieren`).toBeGreaterThan(
					0,
				);
				expect(
					box!.x + box!.width,
					`viewportWidth=${viewportWidth}: Range ${i} endet bei x=${box!.x + box!.width}px und muss vollständig im Viewport liegen`,
				).toBeLessThanOrEqual(viewportWidth + TOLERANCE_PX);
			}
		}
	});
});
