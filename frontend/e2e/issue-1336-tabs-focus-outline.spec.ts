import { expect, test, type Locator, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für die sichtbare Fokus-Outline auf Tab-Buttons der `kol-tabs`-Navigation (#1336).
 *
 * Die Tab-Buttons liegen im offenen Shadow-DOM von `kol-tabs`
 * (`.kol-tabs__button-group`); laut KoliBri-Doku (4.4.0) bietet die Komponente
 * weder CSS-Parts noch Focus-Custom-Properties dafür.
 *
 * Vertrag (docs/spec/issue-1336.md):
 * - AK1: Fokussierter Tab-Button hat computed outline-style != none,
 *   outline-width >= 2px, outline-color = aufgelöster Wert von --pp-focus-ring,
 *   outline-offset = 2px.
 * - AK2: Kein Vorfahr bis einschließlich des `kol-tabs`-Hosts clippt (overflow
 *   auto/hidden/scroll/clip); Bounding-Box des Buttons inkl. Offset+Ring liegt
 *   vollständig innerhalb der Tab-Leiste/des Viewports.
 * - AK3: AK1+AK2 gelten für alle vier Haupt-Tabs (Dashboard/Aufgaben/Serien/Wald).
 * - AK4: AK1+AK2 gelten bei 375px/768px/1280px.
 * - AK5: Nach Mausklick keine Outline sichtbar (nur :focus-visible).
 * - AK7: Dieselben Regeln gelten für die Settings-Tabs (.settings-tabs).
 *
 * Stil-Assertions per getComputedStyle auf dem per Locator erreichten Element
 * (Playwright pierct offene Shadow Roots, Vorbild issue-930-transparent-backgrounds);
 * kein eigenes shadowRoot-Literal im Testcode (#824-ESLint-Guard). Clipping-Check
 * als Vorfahrenkette analog issue-1186-popover-focus-outline.spec.ts, hier bis zum
 * kol-tabs-Host. Kein Unit-Test: migration-check.test.ts verbietet
 * shadowRoot-Zugriffe in frontend/src-Tests — Effekt liegt im Shadow-DOM einer
 * Custom-Element-Komponente und ist in jsdom nicht messbar.
 */
test.describe('Priority Pilot — Fokus-Outline auf Tab-Buttons (#1336)', () => {
	/**
	 * Vorfahrenkette (inkl. verschachteltem Shadow-DOM) bis zum `kol-tabs`-Host:
	 * liefert den Klassennamen des ersten clippenden Knotens oder `null`.
	 */
	const clippingAncestorInTabs = (button: Locator) =>
		button.evaluate((el: HTMLElement): string | null => {
			const CLIPPING = ['auto', 'hidden', 'scroll', 'clip'];
			const describe = (n: Element) =>
				`${n.tagName.toLowerCase()}${n.className ? `.${String(n.className).split(' ')[0]}` : ''}`;
			let node: Element | null = el;
			while (node) {
				if (CLIPPING.includes(window.getComputedStyle(node).overflow)) {
					return describe(node);
				}
				if (node.tagName.toLowerCase() === 'kol-tabs') {
					return null; // Host erreicht — Ende des relevanten Scopes
				}
				let next: Element | null = node.parentElement;
				if (!next) {
					const root = node.getRootNode();
					if (root instanceof ShadowRoot && root.host) {
						next = root.host; // verschachteltes Shadow-DOM durchqueren
					} else {
						return null;
					}
				}
				node = next;
			}
			return null;
		});

	const focusRingColor = async (page: Page): Promise<string> =>
		page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--pp-focus-ring');
			document.body.appendChild(probe);
			const resolved = getComputedStyle(probe).color;
			probe.remove();
			return resolved;
		});

	const assertOutline = async (page: Page, button: Locator): Promise<void> => {
		await expect(button).toBeVisible();
		await button.focus();
		await expect(button).toBeFocused();

		const expectedColor = await focusRingColor(page);
		const outline = await button.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return {
				style: styles.outlineStyle,
				width: parseFloat(styles.outlineWidth),
				color: styles.outlineColor,
				offset: parseFloat(styles.outlineOffset),
			};
		});
		expect(outline.style, 'AK1: outline-style darf nicht none sein').not.toBe('none');
		expect(outline.width, 'AK1: outline-width muss mind. 2px sein').toBeGreaterThanOrEqual(2);
		expect(outline.color, 'AK1: outline-color muss --pp-focus-ring entsprechen').toBe(expectedColor);
		expect(outline.offset, 'AK1: outline-offset muss 2px sein').toBe(2);

		const clipper = await clippingAncestorInTabs(button);
		expect(clipper, `AK2: Outline wird von ${clipper} geclippt`).toBeNull();

		const buttonBox = await button.boundingBox();
		expect(buttonBox).not.toBeNull();
		const hostBox = await button.evaluate((el) => {
			const host = (el.getRootNode() as ShadowRoot).host as HTMLElement;
			const r = host.getBoundingClientRect();
			return { x: r.x, width: r.width };
		});
		const ring = outline.width + outline.offset;
		expect(buttonBox!.x - ring, 'AK2: Ring darf links nicht aus der Tab-Leiste ragen').toBeGreaterThanOrEqual(
			hostBox.x - 1,
		);
		expect(
			buttonBox!.x + buttonBox!.width + ring,
			'AK2: Ring darf rechts nicht aus der Tab-Leiste ragen',
		).toBeLessThanOrEqual(hostBox.x + hostBox.width + 1);
	};

	const appTabNames = ['Dashboard', 'Aufgaben', 'Serien', 'Wald'] as const;
	const viewports = [
		{ width: 375, height: 812, label: '375px (mobile)' },
		{ width: 768, height: 1024, label: '768px (tablet)' },
		{ width: 1280, height: 800, label: '1280px (desktop)' },
	];

	for (const viewport of viewports) {
		test.describe(`Viewport ${viewport.label}`, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height } });

			for (const name of appTabNames) {
				test(`AK1/AK2/AK3/AK4: Tab „${name}" hat sichtbare, ungeclippte Outline`, async ({ page }) => {
					await page.goto('/');
					await waitForStableView(page);

					const button = page.getByRole('tab', { name, exact: true });
					await assertOutline(page, button);
				});
			}
		});
	}

	test('AK5: Nach Mausklick auf einen Tab-Button ist keine Outline sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const button = page.getByRole('tab', { name: 'Serien', exact: true });
		await button.click();
		await expect(button).toHaveAttribute('aria-selected', 'true');

		const outline = await button.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return { style: styles.outlineStyle, width: parseFloat(styles.outlineWidth) };
		});
		const noOutline = outline.style === 'none' || outline.width === 0;
		expect(noOutline, 'AK5: Nach Mausklick darf keine Outline sichtbar sein').toBe(true);
	});

	test('AK7: Settings-Tab „Allgemein" hat dieselbe sichtbare, ungeclippte Outline', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const button = page.getByRole('tab', { name: 'Allgemein', exact: true });
		await assertOutline(page, button);
	});
});
