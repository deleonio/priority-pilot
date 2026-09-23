import { expect, test, type Locator, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * E2E-Vertrag für die sichtbare Fokus-Outline der äußeren Header-Buttons (#1622,
 * Spec `docs/spec/issue-1622.md`).
 *
 * Seit #1587 hängt `.app-header` `fixed` an der Viewport-Kante; mobil (< 48rem) ist
 * `--pp-bar-pad-block: 0px` (`app.css:303`) — der Fokus-Ring des äußeren Buttons (Hilfe)
 * liegt dadurch außerhalb der Button-Box und fällt hinter die Viewport-Kante. Kein
 * Vorfahr clippt, der Bildschirmrand selbst schneidet ab.
 *
 *  - AK1: 375px, Kopfzeile Oben — Ring-Oberkante bleibt im Viewport.
 *  - AK2: 375px, Kopfzeile Unten — Ring-Unterkante bleibt im Viewport.
 *  - AK3: Ring bleibt auch inline (links/rechts) im Viewport.
 *  - AK4/AK5: Bestandsverträge (Randbündigkeit, Höhendeckel) bleiben unberührt —
 *    dort keine neuen Tests, siehe issue-1587-header-fullwidth.spec.ts und
 *    mobile-shell.spec.ts.
 *  - AK6: Bei 1024px (>= 48rem) gelten AK1-AK3 ebenfalls.
 *
 * Ringgeometrie-Messung analog issue-1336-tabs-focus-outline.spec.ts, Box-Nachmessung
 * (CI-Umrender) analog stableBox() aus issue-1587-header-fullwidth.spec.ts.
 */

/** localStorage-Schlüssel der Kopfzeilen-Position (#1428), Muster mobile-shell.spec.ts. */
const HEADER_POSITION_KEY = 'pp-header-position';

const gotoApp = async (page: Page, viewport: { width: number; height: number }, position?: 'bottom'): Promise<void> => {
	await page.setViewportSize(viewport);
	if (position === 'bottom') {
		await page.addInitScript((key) => localStorage.setItem(key, 'bottom'), HEADER_POSITION_KEY);
	}
	await page.goto('/app/');
	await waitForStableView(page);
};

/** boundingBox kurz nachmessen — CI-Runner rendern zwischendurch um (helpers.ts-Muster). */
const stableBox = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
	await expect(locator).toBeVisible();
	let box = await locator.boundingBox();
	for (let attempt = 0; attempt < 10 && box !== null; attempt += 1) {
		const recheck = await locator.boundingBox();
		if (recheck !== null && recheck.x === box.x && recheck.y === box.y) break;
		box = recheck;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	expect(box, 'Button muss messbar sein').not.toBeNull();
	return box!;
};

const outlineGeometry = async (button: Locator): Promise<{ width: number; offset: number }> =>
	button.evaluate((el) => {
		const styles = window.getComputedStyle(el);
		return { width: parseFloat(styles.outlineWidth), offset: parseFloat(styles.outlineOffset) };
	});

test.describe('Balamentum — Fokus-Outline der äußeren Header-Buttons bleibt im Viewport (#1622)', () => {
	const cases: Array<{
		label: string;
		viewport: { width: number; height: number };
		position?: 'bottom';
	}> = [
		{ label: '375px, Kopfzeile Oben', viewport: { width: 375, height: 812 } },
		{ label: '375px, Kopfzeile Unten', viewport: { width: 375, height: 812 }, position: 'bottom' },
		{ label: '1024px, Kopfzeile Oben', viewport: { width: 1024, height: 800 } },
	];

	for (const { label, viewport, position } of cases) {
		test(`AK1/AK2/AK3/AK6: Ring des Hilfe-Buttons bleibt vollständig im Viewport (${label})`, async ({ page }) => {
			await gotoApp(page, viewport, position);

			const button = await headerAction(page, 'Hilfe');
			await button.focus();
			await expect(button).toBeFocused();

			const box = await stableBox(button);
			const { width: outlineWidth, offset: outlineOffset } = await outlineGeometry(button);
			const ring = outlineWidth + outlineOffset;

			if (position === 'bottom') {
				expect(
					box.y + box.height + ring,
					'AK2: Ring-Unterkante darf nicht unter die Viewport-Kante fallen',
				).toBeLessThanOrEqual(viewport.height);
			} else {
				expect(box.y - ring, 'AK1: Ring-Oberkante darf nicht über die Viewport-Kante ragen').toBeGreaterThanOrEqual(0);
			}

			expect(box.x - ring, 'AK3: Ring-Linke darf nicht über die Viewport-Kante ragen').toBeGreaterThanOrEqual(0);
			expect(box.x + box.width + ring, 'AK3: Ring-Rechte darf nicht über die Viewport-Kante ragen').toBeLessThanOrEqual(
				viewport.width,
			);
		});
	}
});
