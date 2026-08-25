import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-e2e für #996 — „Mobile: Säulen-Verteilung im Task-Formular — Slider volle Breite,
 * Entfernen gut klickbar".
 *
 * Vertrag (Spec: docs/spec/issue-996.md):
 *  - AK1: Bei ≤ 768 px liegt jeder `KolInputRange` der Säulen-Beiträge in eigener Zeile und
 *         füllt ≥ 90 % der Zeilen-Innenbreite.
 *  - AK2: Der ✕-Entfernen-Button ist auf Mobile ≥ 44×44 px (WCAG 2.5.8) und rechts erreichbar.
 *  - AK3: Bei > 768 px bleiben beide Slider nebeneinander, Button rechts (keine Desktop-Regression).
 *  - AK4: Bei 320 px läuft kein `.pillar-row`-Kind horizontal aus dem Viewport.
 *
 * Messgrundlage ist der Light-DOM-Host (`boundingBox()` = Border-Box); die „Zeilen-Innenbreite"
 * wird per `clientWidth − Padding` am Row-Element ermittelt (Spec, Erwartetes Ergebnis AK1).
 * Der 320er-Overflow-Check misst Bounding-Boxes statt `scrollWidth`, weil die App-Shell mit
 * `overflow-x: hidden` clippt und ein stiller Overflow sonst unsichtbar bliebe (#934, gleiche
 * Begründung).
 */
test.describe('#996 Säulen-Beiträge im TaskForm (Mobile-Layout)', () => {
	/** Toleranz für Sub-Pixel-Rundungen der Layout-Engine. */
	const TOLERANCE_PX = 1;
	/** WCAG 2.5.8: Mindest-Tap-Target. */
	const MIN_TARGET_PX = 44;
	/** Breite, die der ✕-Button maximal vor dem rechten Zeilenrand stehen darf (Padding + Gap). */
	const RIGHT_EDGE_TOLERANCE_PX = 40;

	/**
	 * Legt einen Task mit Säulen-Beitrag auf der ersten verfügbaren Säule an und öffnet den
	 * TaskForm-Bearbeiten-Dialog (Navigationsmuster: issue-934.spec.ts). Liefert die erste
	 * `.pillar-row` und die Task-Id (Aufrufer löscht im `finally`).
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

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();

		const row = page.locator('.pillar-row').first();
		await expect(row).toBeVisible();
		// Guard: Die Zeile muss tatsächlich Slider-Paar + Button führen (leere Menge = dauerhaft grün).
		await expect(row.locator('kol-input-range')).toHaveCount(2);
		await expect(row.locator('kol-button')).toHaveCount(1);

		return { row, taskId: task.id };
	};

	/** Innenbreite einer `.pillar-row` (clientWidth − horizontales Padding) — Spec-Maß für AK1. */
	const rowInnerWidth = async (row: Locator): Promise<number> => {
		return row.evaluate((el) => {
			const styles = getComputedStyle(el);
			return el.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
		});
	};

	/**
	 * AK1 (Mobile 375 px) — Slider untereinander UND je ≥ 90 % Zeilen-Innenbreite.
	 * Rot im Status-quo: `grid-template-columns: 1fr 1fr auto` teilt jedem Slider ≤ ~50 % zu
	 * und stellt beide nebeneinander (Mutations-Probe: die 90 %-Assertion kann bei zweispaltigem
	 * Grid konstruktiv nicht erfüllt sein).
	 */
	test('AK1: Slider bei 375 px jeweils eigene Zeile mit ≥ 90 % Zeilenbreite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const { row, taskId } = await openTaskFormWithPillarRow(page);

		try {
			const shareBox = await row.locator('kol-input-range').first().boundingBox();
			const confidenceBox = await row.locator('kol-input-range').nth(1).boundingBox();
			expect(shareBox, 'Anteil-Slider muss messbar sein').not.toBeNull();
			expect(confidenceBox, 'Konfidenz-Slider muss messbar sein').not.toBeNull();

			// Stapelung: Anteil liegt über Konfidenz statt nebeneinander gequetscht.
			expect(shareBox!.y, 'Anteil-Slider muss über dem Konfidenz-Slider liegen').toBeLessThan(confidenceBox!.y);

			// Volle Breite: jeder Slider füllt ≥ 90 % der Zeilen-Innenbreite.
			const innerWidth = await rowInnerWidth(row);
			expect(innerWidth, 'Zeilen-Innenbreite muss positiv sein').toBeGreaterThan(0);
			expect(
				shareBox!.width,
				`Anteil-Slider (${shareBox!.width}px) muss ≥ 90 % von ${innerWidth}px betragen`,
			).toBeGreaterThanOrEqual(0.9 * innerWidth - TOLERANCE_PX);
			expect(
				confidenceBox!.width,
				`Konfidenz-Slider (${confidenceBox!.width}px) muss ≥ 90 % von ${innerWidth}px betragen`,
			).toBeGreaterThanOrEqual(0.9 * innerWidth - TOLERANCE_PX);
		} finally {
			await page.request.delete(`/api/v1/tasks/${taskId}`);
		}
	});

	/**
	 * AK2 (Mobile 375 px) — ✕-Button ≥ 44×44 px und am rechten Zeilenrand.
	 * Schutz-Test (vgl. #934 AK2): KoliBri gibt dem Button bereits 44 px Mindestgröße — der Test
	 * ist heute vermutlich grün und wird rot, sobald das Mobile-Layout den Button-Host schrumpft
	 * oder er aus der Zeile fällt.
	 */
	test('AK2: Entfernen-Button bei 375 px ≥ 44×44 px und rechts erreichbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const { row, taskId } = await openTaskFormWithPillarRow(page);

		try {
			const button = row.locator('kol-button').first();
			const buttonBox = await button.boundingBox();
			const rowBox = await row.boundingBox();
			expect(buttonBox, 'Entfernen-Button muss messbar sein').not.toBeNull();
			expect(rowBox, 'Zeile muss messbar sein').not.toBeNull();

			expect(
				buttonBox!.width,
				`Button-Breite (${buttonBox!.width}px) muss ≥ ${MIN_TARGET_PX}px sein (WCAG 2.5.8)`,
			).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);
			expect(
				buttonBox!.height,
				`Button-Höhe (${buttonBox!.height}px) muss ≥ ${MIN_TARGET_PX}px sein (WCAG 2.5.8)`,
			).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);

			// Rechts erreichbar: Der Button endet nahe der rechten Zeilenkante (rechte Zeilenhälfte).
			const distanceToRightEdge = rowBox!.x + rowBox!.width - (buttonBox!.x + buttonBox!.width);
			expect(
				distanceToRightEdge,
				`Button muss rechts in der Zeile liegen (Abstand zur rechten Kante: ${distanceToRightEdge}px)`,
			).toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);
			expect(buttonBox!.x, 'Button muss in der rechten Zeilenhälfte liegen').toBeGreaterThan(
				rowBox!.x + rowBox!.width / 2,
			);
		} finally {
			await page.request.delete(`/api/v1/tasks/${taskId}`);
		}
	});

	/**
	 * AK3 (Desktop 1280 px) — beide Slider nebeneinander in einer Zeile, Button rechts dahinter.
	 * Schützt die Rückseite der Mobile-Media-Query: das Zweispalt-Layout > 768 px bleibt erhalten.
	 */
	test('AK3: Slider bei 1280 px nebeneinander, Entfernen rechts (Desktop unverändert)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const { row, taskId } = await openTaskFormWithPillarRow(page);

		try {
			const shareBox = await row.locator('kol-input-range').first().boundingBox();
			const confidenceBox = await row.locator('kol-input-range').nth(1).boundingBox();
			const buttonBox = await row.locator('kol-button').first().boundingBox();
			expect(shareBox).not.toBeNull();
			expect(confidenceBox).not.toBeNull();
			expect(buttonBox).not.toBeNull();

			// Nebeneinander: Anteil links von Konfidenz, gleiche Zeile (±10 px, Muster #727 AK3).
			expect(shareBox!.x, 'Anteil-Slider muss links vom Konfidenz-Slider liegen').toBeLessThan(confidenceBox!.x);
			expect(Math.abs(shareBox!.y - confidenceBox!.y), 'Beide Slider müssen in einer Zeile liegen').toBeLessThanOrEqual(
				10,
			);

			// Button rechts hinter beiden Slidern.
			expect(buttonBox!.x, 'Entfernen-Button muss rechts der Slider stehen').toBeGreaterThan(confidenceBox!.x);
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
				const children = rows.nth(r).locator('kol-input-range, kol-button');
				const childCount = await children.count();
				expect(childCount, `Zeile ${r} muss Slider/Button-Kinder haben`).toBeGreaterThan(0);

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
