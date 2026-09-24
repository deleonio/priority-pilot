import type { Locator } from '@playwright/test';
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

/** Referenz-Viewport der Projekt-Konventionen (.ai-knowledge/project.md → Mobile-First). */
const MOBILE = { width: 375, height: 812 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

/** Die Kopf-Aktionen, die auf jeder Breite erreichbar bleiben müssen (#1335: „Säulen-Berater" entfällt
 * als eigener Button; der Home-Schalter ist seither als erster Button in die Toolbar gewandert). */
const HEADER_ACTIONS = ['Zum Dashboard', 'Neuen Task anlegen', 'Einstellungen', 'Hilfe', 'Abmelden'] as const;

const gotoApp = async (page: Page, viewport: { width: number; height: number }): Promise<void> => {
	await page.setViewportSize(viewport);
	await page.goto('/app/');
	await waitForStableView(page);
};

/** localStorage-Schlüssel der Kopfzeilen-Position (#1428) — steuert den Modus Oben/Unten. */
const HEADER_POSITION_KEY = 'pp-header-position';

/** Kurze Pause fürs boundingBox-Nachmessen (100ms, ohne zusätzlichen Import). */
const pageDelay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100));

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

	/**
	 * #1274: Die Tab-Leiste der Hauptansichten („Dashboard | Aufgaben | Serien | Wald") muss bei
	 * 375px einzeilig bleiben — bricht sie um, steht ein einsames Label („Wald") linksbündig in
	 * Zeile 2 und wird als Abschnitts-Überschrift misslesbar. Vertrag wie oben über *gemessene*
	 * Größen: alle vier Tab-Buttons auf derselben y-Position (gemeinsame Grundlinie), unabhängig
	 * davon, wie das Gap im Stylesheet erreicht wird. Das CSS-seitige Gap-Wächter-Wissen (12px-Registrierung, Sollbruchstellen) steht in `app.css` (#1274-Kommentar).
	 */
	test('375×812: Tab-Leiste der Hauptansichten bleibt einzeilig', async ({ page }) => {
		await gotoApp(page, MOBILE);

		// Playwright pierct offene Shadow-DOMs, daher erreicht getByRole('tab') den Button in
		// kol-button-wc. Sichtbarkeit abwarten, damit das Layout (und ein Umbruch) schon steht.
		const tabTops: number[] = [];
		for (const label of ['Dashboard', 'Aufgaben', 'Serien', 'Graph'] as const) {
			const tab = page.getByRole('tab', { name: label });
			await expect(tab).toBeVisible();
			const box = await tab.boundingBox();
			expect(box, `Tab „${label}" muss messbar sein`).not.toBeNull();
			if (box === null) return;
			tabTops.push(box.y);
		}

		expect(
			new Set(tabTops).size,
			`Alle vier Hauptansicht-Tabs müssen auf gemeinsamer Grundlinie stehen (y: ${tabTops.join(', ')})`,
		).toBe(1);
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

	/**
	 * Randbündige Kopfzeile + Abstandsschild (Nutzerauftrag 2026-09-22): Die Kopfzeile hängt in
	 * BEIDEN Positionen fest an ihrer Viewport-Kante und schließt dort BÜNDIG ab — die sichtbare
	 * Leiste selbst berührt die Kante, nicht nur der Header-Rahmen. Der unsichtbare Schild
	 * (`.app-header`-Padding in Seitenfarbe) liegt auf der Inhaltsseite und lässt den Inhalt mit
	 * --pp-header-gap Abstand hinter der Leiste verschwinden. Ohne `position: fixed` oder ohne
	 * Schild liefe die Suite weiter grün — deshalb hier gemessen statt nur gesichtet (Review
	 * #1575, F2):
	 *  - Modus „Oben": nach dem Scrollen liegt die Leiste bei y = 0; direkt unter ihr liegt noch
	 *    Header-Fläche (der Schild übermalt den Inhalt), unterhalb des Schildes beginnt der Inhalt.
	 *  - Modus „Unten": Leisten-Unterkante bei y = 812, Schild oberhalb der Leiste.
	 *
	 * Für einen scrollbaren Körper sorgt eine echte Aufgabenliste über die API (Muster
	 * `issue-1258-tasks-mobile.spec.ts`); `afterEach` räumt auf.
	 */
	test.describe('Randbündige Kopfzeile mit Abstandsschild', () => {
		const createTasksViaApi = async (page: Page, count: number): Promise<void> => {
			for (let i = 0; i < count; i += 1) {
				const response = await page.request.post('/api/v1/tasks', {
					data: { title: `E2E Mobile-Shell Sticky ${i}`, priority: 3 },
				});
				expect(response.ok()).toBeTruthy();
			}
		};

		const deleteAllTasks = async (page: Page): Promise<void> => {
			for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
				await page.request.delete(`/api/v1/tasks/${task.id}`);
			}
		};

		test.afterEach(async ({ page }) => {
			await deleteAllTasks(page);
		});

		/** Macht die Seite scrollbar (Liste länger als der Viewport) und scrollt 600px herunter. */
		const scrollDown = async (page: Page): Promise<void> => {
			await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight + 100, undefined, {
				timeout: 10_000,
			});
			await page.evaluate(() => window.scrollTo(0, 600));
		};

		/** boundingBox in Kurzloop nachmessen — CI-Runner rendern zwischendurch um (helpers.ts-Muster). */
		const stableBox = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
			let box = await locator.boundingBox();
			for (let attempt = 0; attempt < 10 && box !== null; attempt += 1) {
				const recheck = await locator.boundingBox();
				if (recheck !== null && recheck.y === box.y && recheck.height === box.height) break;
				box = recheck;
				await pageDelay();
			}
			expect(box, 'Element muss messbar sein').not.toBeNull();
			return box!;
		};

		/** Ob der Punkt (in einer offenen Shadow-DOM-Komponente) beim Header landet. */
		const pointInHeader = async (page: Page, x: number, y: number): Promise<boolean> => {
			return page.evaluate(
				({ x, y }) => {
					const hit = document.elementFromPoint(x, y);
					if (hit === null) return false;
					return hit.closest('.app-header') !== null || document.querySelector('.app-header')?.contains(hit) === true;
				},
				{ x, y },
			);
		};

		test('Modus Oben: Leiste schließt bei y=0 bündig ab, Schild hält 8px Abstand zum Inhalt', async ({ page }) => {
			await page.setViewportSize(MOBILE);
			await createTasksViaApi(page, 14);
			await page.goto('/app/');
			await waitForStableView(page);
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await waitForStableView(page);
			await scrollDown(page);

			const headerBox = await stableBox(page.locator('.app-header'));
			expect(headerBox.y, 'Kopfzeile hängt beim Scrollen an der Viewport-Oberkante').toBe(0);

			const barBox = await stableBox(page.locator('.app-header__bar'));
			expect(barBox.y, 'Leiste schließt randbündig mit der Viewport-Oberkante ab').toBe(0);

			// Direkt unter der Leiste liegt der untere Schild: Header-Fläche übermalt den Inhalt
			// (genau dieser fehlende Pixelabstand war der Nutzerauftrag).
			expect(
				await pointInHeader(page, 187, barBox.y + barBox.height + 4),
				'Schild unter der Leiste gehört zur Kopfzeile',
			).toBe(true);
			expect(
				await pointInHeader(page, 187, headerBox.y + headerBox.height + 2),
				'unterhalb des Schildes beginnt der Inhalt',
			).toBe(false);
		});

		test('Modus Unten: Leiste schließt an der Unterkante bündig ab, Schild oberhalb der Leiste', async ({ page }) => {
			await page.setViewportSize(MOBILE);
			await page.addInitScript((key) => localStorage.setItem(key, 'bottom'), HEADER_POSITION_KEY);
			await createTasksViaApi(page, 14);
			await page.goto('/app/');
			await waitForStableView(page);
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await waitForStableView(page);
			await scrollDown(page);

			const headerBox = await stableBox(page.locator('.app-header'));
			expect(
				Math.round(headerBox.y + headerBox.height),
				'Kopfzeile hängt beim Scrollen an der Viewport-Unterkante',
			).toBe(812);

			const barBox = await stableBox(page.locator('.app-header__bar'));
			expect(Math.round(barBox.y + barBox.height), 'Leiste schließt randbündig mit der Viewport-Unterkante ab').toBe(
				812,
			);

			expect(await pointInHeader(page, 187, barBox.y - 4), 'Schild über der Leiste gehört zur Kopfzeile').toBe(true);
			expect(await pointInHeader(page, 187, headerBox.y - 2), 'oberhalb des Schildes liegt Inhalt').toBe(false);
		});
	});
});
