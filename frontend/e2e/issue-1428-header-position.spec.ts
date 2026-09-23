import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #1428 „Kopfzeilen-Position (Oben/Unten)" — TF2/TF4.
 *
 * Der Allgemein-Tab (`/settings/general`) bekommt eine benannte Radiogruppe „Kopfzeile"
 * mit den Optionen Oben/Unten (Muster Darstellungs-Umschalter, #285). Die Wahl wird unter
 * `pp-header-position` persistiert (Muster `pp-theme`) und steuert rein per Layout, ob
 * `.app-header` ober- oder unterhalb des Inhalts steht (DOM-Reihenfolge bleibt unverändert).
 *
 * Rot-Zustand: Radiogruppe und Bottom-Modus existieren noch nicht — die Tests werden erst
 * mit der Impl-Phase grün.
 */

/** localStorage-Schlüssel für die Kopfzeilen-Position — wird von der Impl gelesen. */
const HEADER_POSITION_KEY = 'pp-header-position';

/** Findet die Radiogruppe „Kopfzeile" im Allgemein-Tab (rollenunabhängig, Muster #285). */
const headerPositionControl = (page: Page): Locator =>
	page
		.getByRole('radiogroup', { name: /Kopfzeile/i })
		.or(page.getByRole('group', { name: /Kopfzeile/i }))
		.or(page.getByRole('listbox', { name: /Kopfzeile/i }));

/** Findet die auswählbare Option Oben/Unten (radio/option/button-Fallback, Muster #285). */
const headerPositionOption = (page: Page, name: RegExp): Locator =>
	page.getByRole('radio', { name }).or(page.getByRole('option', { name })).or(page.getByRole('button', { name }));

test.describe('#1428 Einstellungen – Kopfzeilen-Position (Allgemein-Tab)', () => {
	/**
	 * AK1 — Bedienelement: Der Allgemein-Tab zeigt eine benannte Radiogruppe „Kopfzeile" mit
	 * den Optionen „Oben" und „Unten", interaktiv; ohne gespeicherte Wahl ist „Oben" gewählt.
	 */
	test('AK1: Allgemein-Tab zeigt Radiogruppe „Kopfzeile" mit Oben/Unten, Default Oben', async ({ page }) => {
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await expect(headerPositionControl(page)).toBeVisible();

		const oben = headerPositionOption(page, /Oben/i).first();
		const unten = headerPositionOption(page, /Unten/i).first();
		await expect(oben).toBeEnabled();
		await expect(unten).toBeEnabled();

		// Default ohne gespeicherte Wahl ist „Oben" (AK1, zweite Hälfte).
		await expect(oben).toBeChecked();
	});

	/**
	 * AK2 + AK3 — Wirkung und Persistenz: Wahl „Unten" rendert die Kopfzeile visuell unter dem
	 * Inhaltsbereich (Bounding-Box-Vergleich `.app-header` gegen den Inhalts-Container);
	 * `page.reload()` hält den Modus.
	 */
	test('AK2/AK3: Wahl „Unten" stellt die Kopfzeile unter den Inhalt und übersteht den Reload', async ({ page }) => {
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const header = page.locator('.app-header');
		// Inhalts-Container der Einstellungen-Seite (`.settings-page`, SettingsPage.tsx) — das
		// einzige `<main>` der App ist der `.app`-Container selbst, der Vergleich gegen das
		// eigene Elternelement wäre bedeutungslos (Locator-Feinschliff lt. Spec-Notiz).
		const content = page.locator('.settings-page');

		// Ausgangslage: Kopfzeile über dem Inhalt (heutiger Zustand, „Oben").
		expect((await header.boundingBox())!.y).toBeLessThan((await content.boundingBox())!.y);

		await headerPositionOption(page, /Unten/i).first().click();

		// AK2: Kopfzeile liegt jetzt visuell unter dem Inhaltsstart …
		expect((await header.boundingBox())!.y).toBeGreaterThan((await content.boundingBox())!.y);
		// … und die Wahl ist persistiert (localStorage-Spiegel, Muster pp-theme).
		expect(await page.evaluate((key) => localStorage.getItem(key), HEADER_POSITION_KEY)).toBe('bottom');

		// AK3: Reload hält den Modus.
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		expect((await header.boundingBox())!.y).toBeGreaterThan((await content.boundingBox())!.y);

		// Rückwahl „Oben" stellt den heutigen Zustand her (AK2, zweite Hälfte).
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Priority Pilot');
		await headerPositionOption(page, /Oben/i).first().click();
		expect((await header.boundingBox())!.y).toBeLessThan((await content.boundingBox())!.y);
	});

	/**
	 * AK5 — Mobile-first (375×812): Im Modus „Unten" bleibt die Kopf-Toolbar vollständig im
	 * Viewport — kein horizontaler Overflow (Bounding-Box-Messung statt scrollWidth, die
	 * App-Shell clippt overflow-x) und keine Verdeckung durch den Home-Indicator (Box-Unterkante
	 * innerhalb des Viewports, safe-area-inset-bottom ist im Padding enthalten).
	 */
	test('AK5: Bottom-Modus bei 375×812 ohne Overflow und ohne Home-Indicator-Verdeckung', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await headerPositionOption(page, /Unten/i).first().click();

		const box = (await page.locator('.app-header').boundingBox())!;
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(375);
		expect(box.y + box.height).toBeLessThanOrEqual(812);
	});
});
