import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2074 — Säulen-Rangfolge-Treppe (Spec: docs/spec/issue-2074.md).
 *
 * - AK1: Antippen von Hauptsäule und drei Nebensäulen in Reihenfolge zeigt die Treppe
 *   50/20/15/10/5; Rang und Anteil stehen als Text an jeder Säule.
 * - AK5: bei 375 px ohne horizontales Scrollen bedienbar, Touch-Ziele mindestens 44 px,
 *   Rang als Text (nicht nur Farbe).
 *
 * Bewusst im Standardmodus (keine Experten-Präferenz): die Rangfolge-Tap-UI ersetzt die
 * Hauptsäulen-Auswahl und ist ohne Expertenmodus bedienbar. Rot, bis die Umsetzung die
 * Tap-Flächen liefert. Bounding-Box-Assertions statt scrollWidth — die App-Shell clippt
 * overflow-x.
 */

/** Öffnet den Anlege-Dialog bis zum eigentlichen Formular (Modus-Auswahl überspringen). */
const openNewTaskForm = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
};

/** Tap-Fläche einer Säule — das Label trägt Name, Rang und Anteil. */
const pillarTap = (page: Page, name: string | RegExp): ReturnType<Page['getByRole']> =>
	page.locator('kol-dialog').getByRole('button', { name });

/** Misst die Bounding-Box mit kurzer Retry-Schleife — ein Re-Render im Messmoment liefert null. */
const measureBox = async (
	page: Page,
	locator: ReturnType<Page['getByRole']>,
): Promise<{ x: number; y: number; width: number; height: number }> => {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const box = await locator.boundingBox();
		if (box !== null) {
			return box;
		}
		await page.waitForTimeout(100);
	}
	throw new Error('Bounding-Box nach 3 s nicht messbar');
};

test.describe('#2074 — Säulen-Rangfolge-Treppe', () => {
	test('AK1 — Tipp-Reihenfolge zeigt Treppe 50/20/15/10/5 mit Rang- und Anteilstext', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openNewTaskForm(page);

		await pillarTap(page, /^Körper/).click();
		await pillarTap(page, /Mentale Gesundheit/).click();
		await pillarTap(page, /Beziehungen/).click();
		await pillarTap(page, /Wirksamkeit/).click();

		await expect(pillarTap(page, /Rang 1 von 5: Körper — 50 %/)).toBeVisible();
		await expect(pillarTap(page, /Rang 2 von 5: Mentale Gesundheit — 20 %/)).toBeVisible();
		await expect(pillarTap(page, /Rang 3 von 5: Beziehungen — 15 %/)).toBeVisible();
		await expect(pillarTap(page, /Rang 4 von 5: Wirksamkeit — 10 %/)).toBeVisible();
		await expect(pillarTap(page, /^Sinn — 5 %$/)).toBeVisible();
	});

	test('AK5 — 375 px: Zeilen ohne horizontales Scrollen, Touch-Ziele mindestens 44 px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openNewTaskForm(page);

		await pillarTap(page, /^Körper/).click();
		await pillarTap(page, /Mentale Gesundheit/).click();
		await pillarTap(page, /Beziehungen/).click();
		await pillarTap(page, /Wirksamkeit/).click();

		for (const name of [/Körper/, /Mentale Gesundheit/, /Beziehungen/, /Wirksamkeit/, /Sinn/]) {
			const box = await measureBox(page, pillarTap(page, name));
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
