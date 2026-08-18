import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * E2E-Spec für die Mobile-Optimierung der App-Shell: Der Kopfbereich bleibt auf Handy-Breite
 * einzeilig (Logo + alle fünf Kopf-Aktionen direkt in der Toolbar, #691 — das frühere „⋮"-Menü ist
 * ersatzlos entfernt), die Seitenränder folgen der Mobile-First-Kaskade, und alle Kopf-Aktionen
 * bleiben erreichbar.
 *
 * Der Vertrag ist bewusst über *gemessene* Größen formuliert und nicht über CSS-Klassen: Was zählt,
 * ist die tatsächlich nutzbare Fläche auf 375px, nicht die Schreibweise im Stylesheet.
 */

/** Referenz-Viewport der Projekt-Konventionen (.ai-knowledge/conventions.md). */
const MOBILE = { width: 375, height: 812 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

/** Die fünf Kopf-Aktionen, die auf jeder Breite erreichbar bleiben müssen. */
const HEADER_ACTIONS = ['Neuen Task anlegen', 'Säulen-Berater', 'Einstellungen', 'Hilfe', 'Abmelden'] as const;

const gotoApp = async (page: Page, viewport: { width: number; height: number }): Promise<void> => {
	await page.setViewportSize(viewport);
	await page.goto('/');
	await waitForStableView(page);
};

test.describe('Mobile-Shell — Kopfbereich und Seitenränder', () => {
	test('375×812: Kopfbereich ist einzeilig', async ({ page }) => {
		await gotoApp(page, MOBILE);

		const header = page.locator('.app-header');
		await expect(header).toBeVisible();

		// Erst warten, bis die KoliBri-Toolbar ihre Buttons asynchron im Shadow-DOM aufgebaut hat:
		// Vor dem Layout ist der Header scheinbar 44px schmal (kol-toolbar 0×0) und die Messung
		// wäre falsch grün — ein Umbruch zeigt sich erst NACH dem Toolbar-Layout.
		await expect(
			header.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Neuen Task anlegen' }),
		).toBeVisible();

		const box = await header.boundingBox();
		expect(box).not.toBeNull();
		if (box === null) return;

		// Eine Zeile bedeutet: die Höhe bleibt im Rahmen eines einzelnen 44px-Touch-Targets plus
		// Zeilenabstand. Bricht der Header wieder um, liegt sie schlagartig bei ~100px und mehr.
		expect(box.height, 'Header darf auf 375px nicht mehr umbrechen').toBeLessThanOrEqual(64);
	});

	test('375×812: kein horizontaler Overflow', async ({ page }) => {
		await gotoApp(page, MOBILE);

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	test('375×812: Inhaltsbreite verschenkt keinen Rand', async ({ page }) => {
		await gotoApp(page, MOBILE);

		// Innenbreite von `.app` = Viewport minus linkem/rechtem Padding. Mit der Mobile-First-Kaskade
		// (1rem statt 1.5rem) müssen mindestens 340 der 375px als Inhalt nutzbar sein.
		const contentWidth = await page.evaluate(() => {
			const app = document.querySelector('.app');
			if (app === null) return 0;
			const style = window.getComputedStyle(app);
			return app.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		});
		expect(contentWidth).toBeGreaterThanOrEqual(340);
	});

	test('375×812: alle fünf Kopf-Aktionen bleiben erreichbar', async ({ page }) => {
		await gotoApp(page, MOBILE);

		for (const label of HEADER_ACTIONS) {
			const action = await headerAction(page, label);
			await expect(action, `Kopf-Aktion „${label}" muss auf 375px erreichbar sein`).toBeVisible();
		}
	});

	/**
	 * Das frühere „⋮"-Menü („Mein Konto") ist mit #691 ersatzlos entfernt — Menüstruktur auf allen
	 * Breiten identisch. Sein 44px-Touch-Target-Vertrag (bzw. die Gegenprobe auf Desktop, siehe
	 * unten) entfällt damit; die Touch-Target-Größe der verbleibenden Buttons sichert die
	 * KoliBri-`--a11y-min-size`-Kaskade (`app.css`, #485).
	 */

	test('375×812: die Kopf-Aktion Einstellungen wirkt (navigiert zu /settings/general)', async ({ page }) => {
		await gotoApp(page, MOBILE);

		const settings = await headerAction(page, 'Einstellungen');
		await settings.click();

		await expect(page).toHaveURL(/\/settings\/general/);
	});

	/**
	 * Gegenprobe: Auf Desktop-Breite bleibt der Kopfbereich unverändert — alle fünf Buttons stehen
	 * direkt in der Toolbar, es gibt kein „⋮"-Menü, und der Anzeigename steht im Klartext.
	 */
	test('1280×800: unveränderter Desktop-Kopfbereich ohne Menü', async ({ page }) => {
		await gotoApp(page, DESKTOP);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		for (const label of HEADER_ACTIONS) {
			await expect(toolbar.getByRole('button', { name: label })).toBeVisible();
		}

		await expect(page.getByRole('button', { name: 'Mein Konto' })).toHaveCount(0);
	});
});
