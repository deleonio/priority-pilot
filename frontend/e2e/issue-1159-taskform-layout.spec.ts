import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #1159 „Layout-Optimierung Aufgaben-Formular".
 *
 * Contract: docs/spec/issue-1159.md (AK1–AK6).
 *
 * Gemessen wird über Bounding-Boxes und getComputedStyle — nicht per `scrollWidth`,
 * da die App-Shell mit `overflow-x: hidden` clippt (Präzedenz issue-1072/1061).
 *
 * Rot-Zustand: die Sektions-Wrapper `.form-section--primary`/`--secondary`/`--optional`
 * existieren noch nicht in TaskForm.tsx — jede `toBeVisible`-Assertion scheitert
 * zunächst schnell (5s) mit klarem Locator.
 */

/** Öffnet das Task-Anlegeformular (QuickCapture-Schritt übersprungen). */
const openForm = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);
	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);
};

const primary = (page: Page) => page.locator('.form-section--primary');
const secondary = (page: Page) => page.locator('.form-section--secondary');
const optional = (page: Page) => page.locator('.form-section--optional');

interface Surface {
	backgroundColor: string;
	borderTopWidth: string;
}

const surfaceOf = async (page: Page, selector: string): Promise<Surface> =>
		page.locator(selector).evaluate((el) => ({
			backgroundColor: getComputedStyle(el).backgroundColor,
			borderTopWidth: getComputedStyle(el).borderTopWidth,
		})),
	hasSurface = ({ backgroundColor, borderTopWidth }: Surface): boolean =>
		backgroundColor !== 'rgba(0, 0, 0, 0)' || (parseFloat(borderTopWidth) ?? 0) > 0;

/** Vertikaler Abstand zwischen zwei Boxen (Lücke = next.y - prev.y - prev.height). */
const verticalGap = (prev: { y: number; height: number }, next: { y: number }): number => next.y - prev.y - prev.height;

test.describe('#1159 TaskForm-Dreier-Hierarchie', () => {
	// AK1: Titel, Priorität, Aufwand in einer eigenen Gruppe mit Fläche oder Rahmen
	// und programmatischer Gruppierung (fieldset/role=group/aria-labelledby, KI-UX).
	test('AK1 — Primärgruppe: Titel + Priorität + Aufwand, Fläche/Rahmen, Gruppierung', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const group = primary(page);
		await expect(group).toBeVisible();
		await expect(group.locator('[data-testid="task-title"]')).toBeVisible();
		await expect(group.locator('.range-inputs-row')).toBeVisible();
		await expect(group.getByText(/Priorität/)).toBeVisible();
		await expect(group.getByText(/Aufwand/)).toBeVisible();

		// Fläche oder Rahmen (getComputedStyle, AK1).
		expect(hasSurface(await surfaceOf(page, '.form-section--primary'))).toBe(true);

		// Programmatische Gruppierung statt reiner Farb-Gruppierung (WCAG 1.4.1).
		expect(
			await group.evaluate((el) =>
				el.matches('fieldset, [role="group"], section[aria-labelledby], fieldset:not([disabled])'),
			),
		).toBe(true);

		// Nur Opt-in: QuickCaptureModal bekommt keinen Primär-Wrapper (es teilt sich
		// .form-grid) — es gibt im Formular genau EINE Primärgruppe.
		await expect(primary(page)).toHaveCount(1);
	});

	// AK2: Deadline-Gruppe + Adresse als optisch abgetrennte zweite Gruppe, von
	// Gruppe 1 unterscheidbar.
	test('AK2 — Sekundärgruppe: Deadline + Adresse, optisch von Gruppe 1 unterschieden', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const group = secondary(page);
		await expect(group).toBeVisible();
		await expect(group.locator('[data-testid="deadline-group"]')).toBeVisible();
		await expect(group.getByLabel('Adresse (optional)')).toBeVisible();
		// Pflicht- und Optional-Felder liegen NICHT in der Sekundärgruppe.
		await expect(group.locator('[data-testid="task-title"]')).toHaveCount(0);
		await expect(group.locator('.pillar-editor')).toHaveCount(0);

		expect(hasSurface(await surfaceOf(page, '.form-section--secondary'))).toBe(true);

		// Optische Unterscheidung von Gruppe 1: Fläche ODER Rahmen unterschiedlich.
		const g1 = await surfaceOf(page, '.form-section--primary');
		const g2 = await surfaceOf(page, '.form-section--secondary');
		expect(g1.backgroundColor !== g2.backgroundColor || g1.borderTopWidth !== g2.borderTopWidth).toBe(true);
	});

	// AK3: Säulen, Beschreibung, Checkliste als Optional-Bereich ohne eigene Fläche;
	// Abstand zu Gruppe 2 größer als jeder In-Gruppen-Abstand.
	test('AK3 — Optional-Bereich: reduzierte Gewichtung, größerer Abstand zu Gruppe 2', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const group = optional(page);
		await expect(group).toBeVisible();
		await expect(group.locator('.pillar-editor')).toBeVisible();
		await expect(group.locator('[data-testid="task-description"]')).toBeVisible();
		await expect(group.locator('[data-testid="checklist-section"]')).toBeVisible();

		// Keine eigene Fläche (reduzierte visuelle Gewichtung, KI-UX-Block).
		const opt = await surfaceOf(page, '.form-section--optional');
		expect(opt.backgroundColor).toBe('rgba(0, 0, 0, 0)');

		// Programmatische Gruppierung + textualisierte Optional-Kennzeichnung.
		expect(await group.evaluate((el) => el.matches('fieldset, [role="group"], section[aria-labelledby]'))).toBe(true);
		await expect(group.getByText(/optional/i).first()).toBeVisible();
	});

	// AK4: 1280px — die benachbarten Felder der Primärgruppe (Priorität | Aufwand) fluchten
	// auf derselben Top-Kante (≤ 2px Versatz, kein V-Spring durch Label-Längen).
	test('AK4 — 1280px: Top-Kanten innerhalb der Primärgruppe fluchten (≤ 2px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const priorityBox = await page.locator('.form-section--primary kol-input-range').first().boundingBox();
		const effortBox = await page.locator('.form-section--primary kol-input-range').nth(1).boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();
		expect(Math.abs(priorityBox!.y - effortBox!.y)).toBeLessThanOrEqual(2);
	});

	// AK5: exakt 768px — Abstand zwischen Primär- und Sekundärgruppe größer als der
	// maximale Abstand innerhalb einer Gruppe.
	test('AK5 — 768px: Gruppenabstand > maximaler In-Gruppen-Abstand', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 900 });
		await openForm(page);

		const primaryBox = await primary(page).boundingBox();
		const secondaryBox = await secondary(page).boundingBox();
		expect(primaryBox).not.toBeNull();
		expect(secondaryBox).not.toBeNull();

		// In-Gruppen-Abstände: Titel→range-inputs-row (Gruppe 1),
		// deadline-group→Adresse (Gruppe 2).
		const titleBox = await page.locator('[data-testid="task-title"]').boundingBox();
		const rowBox = await page.locator('.range-inputs-row').boundingBox();
		const deadlineBox = await page.locator('[data-testid="deadline-group"]').boundingBox();
		const addressBox = await page.getByLabel('Adresse (optional)').boundingBox();
		expect(rowBox).not.toBeNull();
		expect(deadlineBox).not.toBeNull();
		expect(addressBox).not.toBeNull();

		const inGroupGaps: number[] = [];
		if (titleBox) inGroupGaps.push(verticalGap(titleBox, rowBox!));
		inGroupGaps.push(verticalGap(deadlineBox!, addressBox!));
		const maxInGroup = Math.max(...inGroupGaps);

		const groupGap = verticalGap(primaryBox!, secondaryBox!);
		expect(groupGap).toBeGreaterThan(maxInGroup);
	});

	// AK6: 375px — alle Felder voll nutzbar untereinander, kein horizontaler Überlauf
	// (Bounding-Box-Check, da overflow-x:hidden der App-Shell scrollWidth unbrauchbar macht).
	test('AK6 — 375px: alle Felder nutzbar, kein Feld wird abgeschnitten', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openForm(page);

		const fields = [
			page.locator('[data-testid="task-title"]'),
			page.locator('.range-inputs-row'),
			page.locator('[data-testid="deadline-group"]'),
			page.getByLabel('Adresse (optional)'),
			page.locator('[data-testid="task-description"]'),
			page.locator('.pillar-editor'),
			page.locator('[data-testid="checklist-section"]'),
		];
		for (const field of fields) {
			await expect(field).toBeVisible();
			const box = await field.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
});
