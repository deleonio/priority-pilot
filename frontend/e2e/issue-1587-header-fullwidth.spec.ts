import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec zu #1587 (Spec `docs/spec/issue-1587.md`): Die Kopfleiste (.app-header__bar)
 * ist keine eingerückte Pille mehr, sondern läuft über die volle Shell-Breite und wird
 * zur Inhaltsseite durch eine durchgehende 1px-Kante abgegrenzt.
 *
 *  - AK1: Bounding-Box der Leiste horizontal identisch mit .app (x UND width) — bei
 *    375px und ≥48rem.
 *  - AK2: border-radius 0 plus messbare 1px-Kante auf der Inhaltsseite (Oben →
 *    Unterkante, Unten → Oberkante; border ODER inset-Schatten, Umsetzung offen).
 *
 * Sticky-Verhalten (AK3) und der 375px-Einzeiler ohne Overflow (AK4) sichern die
 * bestehenden Blöcke in mobile-shell.spec.ts — bewusst hier nicht dupliziert.
 */

const MOBILE = { width: 375, height: 812 } as const;
const DESKTOP = { width: 1024, height: 800 } as const;

/** localStorage-Schlüssel der Kopfzeilen-Position (#1428), Muster mobile-shell.spec.ts. */
const HEADER_POSITION_KEY = 'pp-header-position';

const gotoApp = async (page: Page, viewport: { width: number; height: number }, position?: 'bottom'): Promise<void> => {
	await page.setViewportSize(viewport);
	if (position === 'bottom') {
		await page.addInitScript((key) => localStorage.setItem(key, 'bottom'), HEADER_POSITION_KEY);
	}
	await page.goto('/');
	await waitForStableView(page);
};

/** boundingBox kurz nachmessen — CI-Runner rendern zwischendurch um (helpers.ts-Muster). */
const stableBox = async (
	page: Page,
	selector: string,
): Promise<{ x: number; y: number; width: number; height: number }> => {
	const locator = page.locator(selector);
	await expect(locator).toBeVisible();
	let box = await locator.boundingBox();
	for (let attempt = 0; attempt < 10 && box !== null; attempt += 1) {
		const recheck = await locator.boundingBox();
		if (recheck !== null && recheck.x === box.x && recheck.width === box.width) break;
		box = recheck;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	expect(box, `${selector} muss messbar sein`).not.toBeNull();
	return box!;
};

/** AK1: Leiste horizontal identisch mit der Shell .app (x UND width). */
const expectBarFullWidth = async (page: Page): Promise<void> => {
	const appBox = await stableBox(page, '.app');
	const barBox = await stableBox(page, '.app-header__bar');
	expect(barBox.x, 'Leiste beginnt wie .app am linken Rand (keine seitliche Einrückung)').toBe(appBox.x);
	expect(barBox.width, 'Leiste ist so breit wie .app (volle Shell-Breite)').toBe(appBox.width);
};

/** AK2: computed styles der Leiste — Radius sowie 1px-Kante auf einer Seite. */
const barEdge = async (
	page: Page,
): Promise<{ radius: string; borderTop: number; borderBottom: number; insetShadow: boolean }> => {
	return page.evaluate(() => {
		const bar = document.querySelector('.app-header__bar');
		if (bar === null) throw new Error('.app-header__bar fehlt im Markup');
		const cs = window.getComputedStyle(bar);
		const px = (value: string): number => parseFloat(value) || 0;
		return {
			radius: cs.borderRadius,
			borderTop: px(cs.borderTopWidth),
			borderBottom: px(cs.borderBottomWidth),
			insetShadow: cs.boxShadow.includes('inset') && /(?:^|\s)1px(?:\s|$)/.test(cs.boxShadow),
		};
	});
};

test.describe('#1587 — Kopfleiste über die volle Breite mit durchgehender Kante', () => {
	for (const [name, viewport] of [
		['375px', MOBILE],
		['1024px', DESKTOP],
	] as const) {
		test(`AK1: Leiste ohne seitliche Einrückung bei ${name}`, async ({ page }) => {
			await gotoApp(page, viewport);
			await expectBarFullWidth(page);
		});
	}

	test('AK2 (Oben): kein Radius, 1px-Kante an der Unterkante der Leiste', async ({ page }) => {
		await gotoApp(page, MOBILE);

		const edge = await barEdge(page);
		expect(edge.radius, 'Pillen-Radius entfällt (border-radius 0)').toBe('0px');
		expect(
			edge.borderBottom >= 1 || edge.insetShadow,
			'durchgehende 1px-Kante zur Inhaltsseite (Unterkante im Modus Oben)',
		).toBe(true);
	});

	test('AK2 (Unten): kein Radius, 1px-Kante an der Oberkante der Leiste', async ({ page }) => {
		await gotoApp(page, MOBILE, 'bottom');

		const edge = await barEdge(page);
		expect(edge.radius, 'Pillen-Radius entfällt (border-radius 0)').toBe('0px');
		expect(
			edge.borderTop >= 1 || edge.insetShadow,
			'durchgehende 1px-Kante zur Inhaltsseite (Oberkante im Modus Unten)',
		).toBe(true);
	});
});
