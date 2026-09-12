import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

// Spec-Referenz: docs/spec/issue-687.md
// Akzeptanzkriterien aus Issue 687:
// - Diff-Anzeige in einem Modal
// - Übernehmen-Schalter im Modal
// - Abbrechen-Schalter im Modal

const LEKTORAT_URL = '**/api/v1/lektorat';

/** Mockt einen erfolgreichen Lektorat-Call mit fester Antwort. */
const mockLektoratSuccess = async (page: Page, text: string): Promise<void> => {
	await page.route(LEKTORAT_URL, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ text }),
		});
	});
};

/**
 * Issue 720 („Fokus-Vertrag ohne Tab-Freiheit — Fokus-Gefängnis wird nicht gecatched"): Nach einem
 * Tab darf der Fokus weder beim Ausgangs-Button kleben (Gefängnis) noch ins Leere fallen — er muss
 * auf einem anderen, echten Bedienelement landen.
 *
 * Die ursprüngliche Fassung aus dem generierten Report (#720) prüfte `expect(button).toBeFocused()`
 * NACH dem Tab und behauptete damit wörtlich das Gefängnis, das sie ausschließen sollte. Grün war
 * sie nur, weil `.kol-button` bis `@public-ui/components` 4.4.0 selbst das fokussierbare Element war;
 * seit dem Skeleton-Umbau in 4.4.1 sitzt der Fokus auf dem `<button>` darin und wandert beim Tab
 * sichtbar weiter — also das gewünschte Verhalten. Geprüft wird deshalb jetzt die Absicht.
 *
 * `expectedNext` benennt das Ziel, wo es stabil benennbar ist (im Modal die zweite Schaltfläche).
 * Ohne Angabe bleibt die schwächere, aber tragfähige Aussage: der Fokus sitzt auf einem sichtbaren,
 * bedienbaren Element. Im Task-Formular ist der Nachbar ein `kol-input-range` mit generierter ID —
 * den zu benennen hieße, diesen Test an die Feldreihenfolge des Formulars zu koppeln.
 */
const expectFocusMovedOn = async (page: Page, from: Locator, expectedNext?: Locator): Promise<void> => {
	await expect(from).not.toBeFocused();

	if (expectedNext) {
		await expect(expectedNext).toBeFocused();
		return;
	}

	// Kein Piercing nötig (ESLint-Guard #824): liegt der Fokus in einem Shadow-Root, zeigt
	// `document.activeElement` auf dessen Host. Geprüft wird nicht nur „irgendein Element", sondern
	// dass es tatsächlich gerendert und bedienbar ist — auf <body>, einem ausgeblendeten Rest oder
	// einem deaktivierten Steuerelement wäre der Fokus verloren.
	// (`page.locator(':focus')` taugt dafür nicht: `:focus` matcht im Light-DOM nur das fokussierte
	// Element selbst, nicht den Host — bei KoliBri findet der Selektor deshalb nichts.)
	const landed = await page.evaluate(() => {
		const element = document.activeElement;
		if (element === null || element === document.body) return null;
		const box = element.getBoundingClientRect();
		return {
			tag: element.tagName,
			rendered: box.width > 0 && box.height > 0,
			disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
		};
	});

	expect(landed, 'Fokus darf beim Tab nicht ins Leere fallen (kein Element / <body>)').not.toBeNull();
	expect(landed?.rendered, `Fokus liegt auf einem unsichtbaren Element (${landed?.tag})`).toBe(true);
	expect(landed?.disabled, `Fokus liegt auf einem deaktivierten Element (${landed?.tag})`).toBe(false);
};

/**
 * Öffnet den „Neuen Task anlegen"-Dialog und überbrückt den Schnellerfassungs-Schritt via
 * „Überspringen", sodass das reguläre Formular sichtbar ist.
 */
const openTaskForm = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	// #1260: Beschreibung liegt im zugeklappten „Optional"-Akkordeon — erst öffnen.
	await openAccordionSection(page, 'Optional');
	const titleInput = page.getByRole('searchbox', { name: 'Titel' });
	await expect(titleInput).toBeVisible();
};

test.describe('Lektorat Diff-Modal', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		await page.goto('/');
	});

	test.describe('Journey 1: Titel lektorieren mit Diff-Modal', () => {
		test('Diff-Modal erscheint nach Lektorat-Aufruf', async ({ page }) => {
			// Spec Journey 1: Diff-Modal erscheint mit Original und lektoriertem Text
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Grosses projekt DRINGEND');

			await mockLektoratSuccess(page, 'Großes Projekt dringend');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Original-Text sollte sichtbar sein
			await expect(page.getByText('Grosses projekt DRINGEND')).toBeVisible();

			// Lektorierter Text sollte sichtbar sein
			await expect(page.getByText('Großes Projekt dringend')).toBeVisible();
		});

		test('Abbrechen im Modal behält Original-Text', async ({ page }) => {
			// Spec Journey 1: Abbrechen → KEINE Änderung am Titel-Feld
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Original Titel');

			await mockLektoratSuccess(page, 'Lektorierter Titel');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Abbrechen-Button klicken
			// Über die Modal-eigene Klasse scopen — das Task-Formular dahinter hat einen eigenen
			// Abbrechen-Button, und role=dialog-Scoping scheitert am Slot-Content (Light-DOM des
			// kol-dialog-Hosts, kein DOM-Nachfahre des nativen <dialog> im Shadow-DOM).
			const cancelButton = page.locator('.lektorat-diff-modal').getByRole('button', { name: 'Abbrechen' });
			await cancelButton.click();

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Original-Text sollte noch im Feld stehen
			await expect(titleInput).toHaveValue('Original Titel');
		});

		test('Übernehmen im Modal überschreibt Titel-Feld', async ({ page }) => {
			// Spec Journey 1: Übernehmen → Titel-Feld wird mit lektoriertem Text überschrieben
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Original Titel');

			await mockLektoratSuccess(page, 'Lektorierter Titel');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Übernehmen-Button klicken
			const confirmButton = page.getByRole('button', { name: 'Übernehmen' });
			await confirmButton.click();

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Lektorierter Text sollte im Feld stehen
			await expect(titleInput).toHaveValue('Lektorierter Titel');
		});

		test('Fokus-Management beim Modal-Öffnen', async ({ page }) => {
			// Spec Journey 1 + UX-Pattern: Striktes Fokus-Management beim Öffnen
			// Spec Issue 720: Tab-Prüfung gegen Fokus-Gefängnis
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Test Titel');

			await mockLektoratSuccess(page, 'Lektorierter Test');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Fokus liegt auf dem „Übernehmen"-Button (Spec + UX-Pattern; der Vergleich mit
			// document.activeElement reicht bei KoliBri nicht — das ist der Shadow-DOM-Host —
			// deshalb Shadow-DOM-tief über Playwrights toBeFocused).
			const confirmButton = page.getByRole('button', { name: 'Übernehmen' });
			await expect(confirmButton).toBeFocused();

			// Issue 720: kein Fokus-Gefängnis — die Tab-Taste muss den Fokus weitertragen. Im Modal ist
			// das Ziel stabil benennbar: „Abbrechen" ist die zweite und letzte Schaltfläche.
			await page.keyboard.press('Tab');
			await expectFocusMovedOn(
				page,
				confirmButton,
				page.locator('.lektorat-diff-modal').getByRole('button', { name: 'Abbrechen' }),
			);
		});

		test('Fokus-Management nach Abbrechen', async ({ page }) => {
			// Spec Journey 1 + UX-Pattern: Fokus kehrt zum auslösenden Element zurück
			// Spec Issue 720: Tab-Prüfung gegen Fokus-Gefängnis
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Test Titel');

			await mockLektoratSuccess(page, 'Lektorierter Test');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Abbrechen-Button klicken
			// Über die Modal-eigene Klasse scopen — das Task-Formular dahinter hat einen eigenen
			// Abbrechen-Button, und role=dialog-Scoping scheitert am Slot-Content (Light-DOM des
			// kol-dialog-Hosts, kein DOM-Nachfahre des nativen <dialog> im Shadow-DOM).
			const cancelButton = page.locator('.lektorat-diff-modal').getByRole('button', { name: 'Abbrechen' });
			await cancelButton.click();

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Fokus kehrt zum Lektorat-Button zurück (Shadow-DOM-tief via toBeFocused)
			await expect(lektoratButton).toBeFocused();

			// Issue 720: kein Fokus-Gefängnis — die Tab-Taste muss den Fokus weitertragen können.
			await page.keyboard.press('Tab');
			await expectFocusMovedOn(page, lektoratButton);
		});
	});

	test.describe('Journey 2: Beschreibung lektorieren mit Diff-Modal', () => {
		test('Diff-Modal erscheint nach Beschreibungs-Lektorat', async ({ page }) => {
			// Spec Journey 2: Diff-Modal erscheint mit Original und lektoriertem Text
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await descriptionTextarea.fill('Dies ist die beschreibung fuer die aufgabe');

			await mockLektoratSuccess(page, 'Dies ist die Beschreibung für die Aufgabe');

			const lektoratButton = page.getByRole('button', { name: 'Beschreibung lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Original-Text sollte sichtbar sein
			await expect(page.getByText('Dies ist die beschreibung fuer die aufgabe')).toBeVisible();

			// Lektorierter Text sollte sichtbar sein
			await expect(page.getByText('Dies ist die Beschreibung für die Aufgabe')).toBeVisible();
		});

		test('Abbrechen im Modal behält Beschreibungs-Text', async ({ page }) => {
			// Spec Journey 2: Abbrechen → KEINE Änderung am Beschreibungsfeld
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await descriptionTextarea.fill('Original Beschreibung');

			await mockLektoratSuccess(page, 'Lektorierte Beschreibung');

			const lektoratButton = page.getByRole('button', { name: 'Beschreibung lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Abbrechen-Button klicken
			// Über die Modal-eigene Klasse scopen — das Task-Formular dahinter hat einen eigenen
			// Abbrechen-Button, und role=dialog-Scoping scheitert am Slot-Content (Light-DOM des
			// kol-dialog-Hosts, kein DOM-Nachfahre des nativen <dialog> im Shadow-DOM).
			const cancelButton = page.locator('.lektorat-diff-modal').getByRole('button', { name: 'Abbrechen' });
			await cancelButton.click();

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Original-Text sollte noch im Feld stehen
			await expect(descriptionTextarea).toHaveValue('Original Beschreibung');
		});

		test('Übernehmen im Modal überschreibt Beschreibungsfeld', async ({ page }) => {
			// Spec Journey 2: Übernehmen → Beschreibungsfeld wird mit lektoriertem Text überschrieben
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await descriptionTextarea.fill('Original Beschreibung');

			await mockLektoratSuccess(page, 'Lektorierte Beschreibung');

			const lektoratButton = page.getByRole('button', { name: 'Beschreibung lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// Übernehmen-Button klicken
			const confirmButton = page.getByRole('button', { name: 'Übernehmen' });
			await confirmButton.click();

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Lektorierter Text sollte im Feld stehen
			await expect(descriptionTextarea).toHaveValue('Lektorierte Beschreibung');
		});
	});

	test.describe('Randfälle & Fehler', () => {
		test('ESC-Taste im Modal verhält sich wie Abbrechen', async ({ page }) => {
			// Spec Randfälle: ESC-Taste → verhält sich wie „Abbrechen"
			await openTaskForm(page);

			const titleInput = page.getByRole('searchbox', { name: 'Titel' });
			await titleInput.fill('Original Titel');

			await mockLektoratSuccess(page, 'Lektorierter Titel');

			const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });
			await lektoratButton.click();

			// Diff-Modal sollte erscheinen
			const modal = page.getByRole('dialog', { name: /Lektorat/ });
			await expect(modal).toBeVisible();

			// ESC-Taste drücken
			await page.keyboard.press('Escape');

			// Modal sollte geschlossen sein
			await expect(modal).not.toBeVisible();

			// Original-Text sollte noch im Feld stehen
			await expect(titleInput).toHaveValue('Original Titel');
		});
	});
});
