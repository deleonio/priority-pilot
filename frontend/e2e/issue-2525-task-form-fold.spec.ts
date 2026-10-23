import { expect, test, type Locator, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView, MOBILE } from './helpers';

/**
 * Rote Spec-e2e für #2525 — Formular-Faltung im Sekundär-Abschnitt (Spec: docs/spec/issue-2525.md).
 *
 * - AK1: 375×812 — nach dem Öffnen von „Aufgabe anlegen" ist der Speichern-Knopf ohne Scrollen
 *   sichtbar (boundingBox innerhalb des Viewports; scrollWidth wäre wegen des App-Shell-Clippings
 *   aussageleer).
 * - AK2: Eine nur mit Titel gespeicherte Aufgabe wird angelegt (Payload-Vertrag in Unit getestet).
 * - AK3: Nach dem Aufklappen des Sekundär-Abschnitts lassen sich Rangfolge setzen und speichern.
 * - AK4: Im zugeklappten Zustand ist der Standardwerte-Hinweis sichtbar.
 * - AK6: Die Priorität bleibt ohne Aufklappen sichtbar.
 *
 * Rot sind AK1/AK3/AK4, solange es die Faltung (Hinweis) nicht gibt bzw.
 * der Speichern-Knopf unterhalb des 812-px-Folds liegt; AK2/AK6 sind grüne Regressionsspiegel,
 * die nach der Umsetzung grün bleiben müssen.
 */

/** Öffnet das Anlege-Formular bei 375×812 in eigener Session (Shard-Sicherheit). */
const openNewTaskForm = async (page: Page, session: string): Promise<void> => {
	await registerOwnSession(page, session);
	await page.setViewportSize(MOBILE);
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
};

/** Misst die Bounding-Box mit kurzer Retry-Schleife — ein Re-Render im Messmoment liefert null. */
const measureBox = async (
	page: Page,
	locator: Locator,
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

test.describe('#2525 — Faltung im Sekundär-Abschnitt', () => {
	test('AK1 — 375×812: Speichern-Knopf ohne Scrollen im Viewport', async ({ page }) => {
		await openNewTaskForm(page, 'fold-2525-ak1');

		const save = page.getByRole('button', { name: 'Anlegen', exact: true });
		await expect(save).toBeVisible();
		const box = await measureBox(page, save);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(MOBILE.height);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width);
	});

	test('AK2 — nur Titel speichern legt die Aufgabe an (Sektion bleibt zu)', async ({ page }) => {
		await openNewTaskForm(page, 'fold-2525-ak2');

		await page.getByRole('textbox', { name: 'Titel' }).fill('2525 nur Titel');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		// Dialog schließt ohne Validierungsfehler — die Standardwerte (Gleichverteilung + 0.5)
		// gelten laut Spec unverändert; der Payload-Vertrag ist in TaskForm.test.tsx (TF2) gespiegelt.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	});

	test('AK3 — aufklappen, Rang setzen, speichern', async ({ page }) => {
		await openNewTaskForm(page, 'fold-2525-ak3');

		await openAccordionSection(page, 'Termin & Ort');
		await page
			.locator('kol-dialog')
			.getByRole('button', { name: /^Körper/ })
			.click();
		await expect(page.locator('kol-dialog').getByRole('button', { name: /Rang 1 von 5: Körper — 50 %/ })).toBeVisible();

		await page.getByRole('textbox', { name: 'Titel' }).fill('2525 mit Rang');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	});

	test('AK4 — zugeklappt: Hinweis „Ohne Öffnen gelten die Standardwerte" sichtbar', async ({ page }) => {
		await openNewTaskForm(page, 'fold-2525-ak4');

		// Roter Vertrag per toBeVisible (nicht toBeHidden) — der Hinweis existiert vor der
		// Umsetzung nicht; er muss im zugeklappten Zustand lesbar sein (KI-UX: außerhalb des
		// Body-Slots, reiner Text).
		await expect(page.getByText(/Ohne Öffnen gelten die Standardwerte/)).toBeVisible();
	});

	test('AK6 — Priorität bleibt außerhalb der Sektion, ohne Aufklappen sichtbar', async ({ page }) => {
		await openNewTaskForm(page, 'fold-2525-ak6');

		// KoliBris KolInputRange exponiert KEIN role="slider"/aria-label (Muster crud.spec.ts) —
		// der Prioritäts-Slider ist eindeutig über min/max/step (1/5/1) adressierbar.
		await expect(page.locator('input[type="range"][min="1"][max="5"][step="1"]')).toBeVisible();
	});
});
