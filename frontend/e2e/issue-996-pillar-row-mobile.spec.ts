import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #996 — „Mobile: Säulen-Verteilung im Task-Formular, Slider volle Breite".
 *
 * TEST-PFLEGE #1596: Eine Säulen-Zeile führt nur noch **einen** Regler; Konfidenz-Regler und
 * Entfernen-Knopf sind entfallen (die fünf Säulen stehen fest, hinzugefügt oder entfernt wird
 * nichts). Die beiden AKs, die das Slider-Paar und den ✕-Knopf vermessen haben (AK2/AK3), sind
 * damit gegenstandslos. Es bleiben:
 *  - AK1: Bei 375 px füllt der Regler ≥ 90 % der Zeilen-Innenbreite.
 *  - AK4: Bei 320 px läuft kein `.pillar-row`-Kind horizontal aus dem Viewport.
 *
 * Messgrundlage ist der Light-DOM-Host (`boundingBox()` = Border-Box); die „Zeilen-Innenbreite"
 * wird per `clientWidth − Padding` am Row-Element ermittelt. Der 320er-Overflow-Check misst
 * Bounding-Boxes statt `scrollWidth`, weil die App-Shell mit `overflow-x: hidden` clippt und ein
 * stiller Overflow sonst unsichtbar bliebe (#934, gleiche Begründung).
 */
test.describe('#996 Säulen-Verteilung im TaskForm (Mobile-Layout)', () => {
	/** Toleranz für Sub-Pixel-Rundungen der Layout-Engine. */
	const TOLERANCE_PX = 1;

	/**
	 * Legt einen Task an und öffnet den TaskForm-Bearbeiten-Dialog (Navigationsmuster:
	 * issue-934.spec.ts). Die Säulen-Verteilung steht seit #1596 in den Basisangaben und ist
	 * ohne Aufklappen sichtbar. Liefert die erste `.pillar-row` und die Task-Id (Aufrufer löscht
	 * im `finally`).
	 */
	const openTaskFormWithPillarRow = async (page: Page): Promise<{ row: Locator; taskId: number }> => {
		// Erste verfügbare Säule aus dem Backend holen (Muster: series.spec.ts) — weder Existenz
		// noch Id einer Säule ist garantiert (DB_SEED=false erhält nur Stammdaten, keine festen Ids).
		const pillarsResponse = await page.request.get('/api/v1/pillars');
		expect(pillarsResponse.ok(), 'Säulen-Liste muss abrufbar sein').toBe(true);
		const pillars = (await pillarsResponse.json()) as Array<{ id: number }>;
		expect(pillars.length, 'Es muss mindestens eine Säule existieren').toBeGreaterThan(0);

		// `share`-Summe muss 100 ergeben (validatePillars), sonst lehnt das Backend mit 400 ab.
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title: 'e2e #996 Säulen-Mobil',
				priority: 3,
				estimatedEffort: 0.5,
				pillars: [{ pillarId: pillars[0].id, share: 100, confidence: 80 }],
			},
		});
		expect(response.ok(), 'Task-Anlage mit Säulen-Beitrag muss gelingen').toBe(true);
		const task = (await response.json()) as { id: number };

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();

		const row = page.locator('.pillar-row').first();
		await expect(row).toBeVisible();
		// Guard: Die Zeile muss tatsächlich einen Regler führen (leere Menge = dauerhaft grün).
		await expect(row.locator('kol-input-range')).toHaveCount(1);

		return { row, taskId: task.id };
	};

	/** Innenbreite einer `.pillar-row` (clientWidth − horizontales Padding) — Spec-Maß für AK1. */
	const rowInnerWidth = async (row: Locator): Promise<number> => {
		return row.evaluate((el) => {
			const styles = getComputedStyle(el);
			return el.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
		});
	};

	/** AK1 (Mobile 375 px) — der Regler füllt die Zeile aus, statt in einer Halbspalte zu kleben. */
	test('AK1: Regler bei 375 px über ≥ 90 % der Zeilenbreite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const { row, taskId } = await openTaskFormWithPillarRow(page);

		try {
			const shareBox = await row.locator('kol-input-range').first().boundingBox();
			expect(shareBox, 'Anteil-Regler muss messbar sein').not.toBeNull();

			const innerWidth = await rowInnerWidth(row);
			expect(innerWidth, 'Zeilen-Innenbreite muss positiv sein').toBeGreaterThan(0);
			expect(
				shareBox!.width,
				`Anteil-Regler (${shareBox!.width}px) muss ≥ 90 % von ${innerWidth}px betragen`,
			).toBeGreaterThanOrEqual(0.9 * innerWidth - TOLERANCE_PX);
		} finally {
			await page.request.delete(`/api/v1/tasks/${taskId}`);
		}
	});

	/**
	 * AK4 (320 px) — kein `.pillar-row`-Kind läuft horizontal aus dem Viewport.
	 * Bounding-Box statt `scrollWidth`, weil die App-Shell mit `overflow-x: hidden` clippt und
	 * Überlauf sonst still abgeschnitten würde (Spec, Ziel 4). All-Quantor mit Guard über der
	 * Zeilen-Anzahl, damit eine leere Menge nicht dauerhaft grün testet.
	 */
	test('AK4: keine Säulen-Zeile läuft bei 320 px aus dem Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 812 });
		const { taskId } = await openTaskFormWithPillarRow(page);

		try {
			const rows = page.locator('.pillar-row');
			const rowCount = await rows.count();
			expect(rowCount, 'Es muss mindestens eine Säulen-Zeile vorhanden sein').toBeGreaterThan(0);

			for (let r = 0; r < rowCount; r++) {
				const children = rows.nth(r).locator('kol-input-range');
				const childCount = await children.count();
				expect(childCount, `Zeile ${r} muss einen Regler führen`).toBeGreaterThan(0);

				for (let i = 0; i < childCount; i++) {
					const box = await children.nth(i).boundingBox();
					expect(box, `Zeile ${r}, Kind ${i} muss messbar sein`).not.toBeNull();
					expect(
						box!.x + box!.width,
						`Zeile ${r}, Kind ${i} endet bei x=${box!.x + box!.width}px und muss im 320-px-Viewport liegen`,
					).toBeLessThanOrEqual(320 + TOLERANCE_PX);
				}
			}
		} finally {
			await page.request.delete(`/api/v1/tasks/${taskId}`);
		}
	});
});
