import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openAccordionSection, waitForStableBox, waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #1159 „Layout-Optimierung Aufgaben-Formular" + #1285
 * „TaskForm-Sektionen als Accordion-Behälter ohne Kartenfläche".
 *
 * Contract: docs/spec/issue-1159.md (AK4-Fluchtung, AK5-Gruppenabstand),
 * docs/spec/issue-1285.md (AK1–AK5).
 *
 * Gemessen wird über Bounding-Boxes und getComputedStyle — nicht per `scrollWidth`,
 * da die App-Shell mit `overflow-x: hidden` clippt (Präzedenz issue-1072/1061).
 *
 * Rot-Zustand (#1285): „Basisangaben" ist noch KolHeading + Karte (`.form-section--primary`
 * mit Surface) — die Akkordeon-Trigger- und Transparent-Assertions scheitern zunächst
 * schnell mit klarem Locator.
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
	}));

/** Vertikaler Abstand zwischen zwei Boxen (Lücke = next.y - prev.y - prev.height). */
const verticalGap = (prev: { y: number; height: number }, next: { y: number }): number => next.y - prev.y - prev.height;

test.describe('#1285 TaskForm-Sektionen als Accordions', () => {
	// AK1: Je ein KolAccordion pro Sektion, keine Kartenfläche (background/border entfernt).
	test('AK1 — drei Akkordeon-Behälter, keine Surface auf primary/secondary', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		for (const section of [primary(page), secondary(page), optional(page)]) {
			await expect(section.locator('kol-accordion')).toHaveCount(1);
		}

		for (const selector of ['.form-section--primary', '.form-section--secondary']) {
			const surface = await surfaceOf(page, selector);
			expect(surface.backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(surface.borderTopWidth).toBe('0px');
		}
	});

	// AK2: Basisangaben dauerhaft offen, Trigger deaktiviert — Inhalt ohne Klick sichtbar,
	// per Tastatur (Enter auf dem Trigger) nicht zuklappbar.
	test('AK2 — Basisangaben: ohne Klick sichtbar, Trigger-Klick und Tastatur klappen nicht zu', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const trigger = page.getByRole('button', { name: 'Basisangaben', exact: true });
		await expect(trigger).toHaveCount(1);
		// Inhalt ohne Interaktion sichtbar (AK2: `_open={true}`).
		await expect(page.locator('[data-testid="task-title"]')).toBeVisible();

		// `_disabled`: Trigger ist nicht fokussierbar und ignoriert alle Events — Enter auf dem
		// Trigger (bei fehlendem `_disabled` würde der Klick das Akkordeon zuklappen) ändert nichts.
		await trigger.press('Enter');
		await expect(page.locator('[data-testid="task-title"]')).toBeVisible();
	});

	// AK3/AK4: Termin & Ort und Optional starten zugeklappt (auch im Bearbeiten — Unit-Ebene,
	// s. TaskForm.test.tsx) und sind per Trigger auf-/einklappbar.
	test('AK3/AK4 — Opt-in-Sektionen: zu beim Start, per Trigger auf- und wieder zu', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		await expect(page.locator('[data-testid="deadline-group"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="task-description"]')).not.toBeVisible();

		await openAccordionSection(page, 'Termin & Ort');
		await expect(page.locator('[data-testid="deadline-group"]')).toBeVisible();

		await openAccordionSection(page, 'Optional');
		await expect(page.locator('[data-testid="task-description"]')).toBeVisible();

		// AK4: erneuter Klick klappt wieder zu.
		for (const label of ['Termin & Ort', 'Optional']) {
			const trigger = page.getByRole('button', { name: label, exact: true });
			await trigger.click();
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		}
		await expect(page.locator('[data-testid="deadline-group"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="task-description"]')).not.toBeVisible();
	});

	// #1159 AK4 (unverändert gültig): 1280px — die benachbarten Felder der Primärgruppe
	// (Priorität | Aufwand) fluchten auf derselben Top-Kante (≤ 2px Versatz).
	test('#1159 AK4 — 1280px: Top-Kanten innerhalb der Primärgruppe fluchten (≤ 2px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openForm(page);

		const priorityRange = page.locator('.form-section--primary kol-input-range').first();
		const effortRange = page.locator('.form-section--primary kol-input-range').nth(1);
		await waitForStableBox(page, priorityRange);
		await waitForStableBox(page, effortRange);

		const priorityBox = await priorityRange.boundingBox();
		const effortBox = await effortRange.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();
		expect(Math.abs(priorityBox!.y - effortBox!.y)).toBeLessThanOrEqual(2);
	});

	// #1159 AK5 (unverändert gültig): exakt 768px — Abstand zwischen Primär- und
	// Sekundärgruppe größer als der maximale Abstand innerhalb einer Gruppe.
	test('#1159 AK5 — 768px: Gruppenabstand > maximaler In-Gruppen-Abstand', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 900 });
		// Deterministischer Zustand: Gruppen-Leaks aus früheren Specs entfernen — rendert die
		// Empfängerauswahl (#1213) zwischen Titel und range-inputs-row, verschiebt sie die
		// title→row-Messung um die Höhe des Selekts und bricht den Gruppenabstands-Vertrag.
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
		await openForm(page);
		// beide Opt-in-Sektionen starten zugeklappt — für die Box-Messung öffnen.
		await openAccordionSection(page, 'Termin & Ort');
		await openAccordionSection(page, 'Optional');

		const primaryBox = await primary(page).boundingBox();
		const secondaryBox = await secondary(page).boundingBox();
		expect(primaryBox).not.toBeNull();
		expect(secondaryBox).not.toBeNull();

		// In-Gruppen-Abstände: Titel→range-inputs-row (Gruppe 1),
		// deadline-group→Adresse (Gruppe 2).
		const titleBox = await page.locator('[data-testid="task-title"]').boundingBox();
		const rowBox = await page.locator('.range-inputs-row').boundingBox();
		const deadlineBox = await page.locator('[data-testid="deadline-group"]').boundingBox();
		// Like-for-like: Combobox-Container (Feld inkl. Label) statt des blanken Inputs — dessen
		// Box läge sonst UNTER dem sichtbaren Label und würde dessen Höhe fälschlich in den
		// gemessenen Abstand addieren (die übrigen gemessenen Felder schließen ihr Label ein).
		const addressBox = await page.locator('.form-section--secondary div[role="combobox"]').boundingBox();
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

	// AK5 (#1285): 375px — die drei Accordions stehen untereinander in voller Breite,
	// kein horizontaler Overflow (Bounding-Box-Check, da overflow-x:hidden der App-Shell
	// scrollWidth unbrauchbar macht).
	test('AK5 — 375px: Accordions untereinander in voller Breite, kein Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openForm(page);
		await openAccordionSection(page, 'Termin & Ort');
		await openAccordionSection(page, 'Optional');

		const boxes: ({ x: number; y: number; width: number; height: number } | null)[] = [];
		for (const section of [primary(page), secondary(page), optional(page)]) {
			await expect(section).toBeVisible();
			boxes.push(await section.boundingBox());
		}
		for (const box of boxes) {
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
			// Volle Breite des Formular-Body (minus Modal-Padding), keine eingezogene Karte.
			expect(box!.width).toBeGreaterThan(300);
		}
		// Untereinander: jede Sektion beginnt unterhalb der vorherigen (keine Überlappung).
		for (let i = 1; i < boxes.length; i++) {
			expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
		}

		// Alle Felder nach dem Aufklappen nutzbar (übernimmt den ehemaligen #1159-AK6-Check).
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

	// Design-Lauf (Akkordeon-Rhythmus): Der Inhalt jedes Akkordeons sitzt symmetrisch
	// (0.5rem beidseits, obwohl das KoliBri-DEFAULT-Theme .kol-accordion__content links mit
	// 2.25em einzieht — kompensiert über .accordion-body in app.css) und die drei
	// Sektionsabstände sind einheitlich --pp-space-5 (24px). Guard gegen Theme-Updates, die
	// den Kompensationswert entgleiten lassen, und gegen Rückfälle in die gestapelten
	// Außenmargins (vorher gemessen 80px/48px/32px).
	test('Design-Lauf — Akkordeon-Inhalt symmetrisch, Sektionsabstände einheitlich (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openForm(page);
		await openAccordionSection(page, 'Termin & Ort');
		await openAccordionSection(page, 'Optional');
		await waitForStableBox(page, primary(page));
		await waitForStableBox(page, optional(page));

		// Links-/Rechtseinrückung des Inhalts gegenüber dem Akkordeon-Host: symmetrisch (±2px).
		const insets = await page.evaluate(() => {
			const host = document.querySelector('.form-section--primary kol-accordion');
			const body = document.querySelector('.form-section--primary .accordion-body');
			if (host === null || body === null) return null;
			const a = host.getBoundingClientRect();
			const b = body.getBoundingClientRect();
			return { left: b.x - a.x, right: a.right - b.right };
		});
		expect(insets).not.toBeNull();
		expect(Math.abs(insets!.left - insets!.right)).toBeLessThanOrEqual(2);

		// Sektionsabstände einheitlich 24px (±2px Toleranz für Sub-Pixel-Rounding).
		const primaryBox = await primary(page).boundingBox();
		const secondaryBox = await secondary(page).boundingBox();
		const optionalBox = await optional(page).boundingBox();
		expect(primaryBox).not.toBeNull();
		expect(secondaryBox).not.toBeNull();
		expect(optionalBox).not.toBeNull();
		expect(verticalGap(primaryBox!, secondaryBox!)).toBeGreaterThanOrEqual(22);
		expect(verticalGap(primaryBox!, secondaryBox!)).toBeLessThanOrEqual(26);
		expect(verticalGap(secondaryBox!, optionalBox!)).toBeGreaterThanOrEqual(22);
		expect(verticalGap(secondaryBox!, optionalBox!)).toBeLessThanOrEqual(26);
	});
});
