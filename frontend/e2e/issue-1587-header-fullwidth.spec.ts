import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * E2E-Spec zur randbündigen Kopfleiste. Ausgangspunkt war #1587 (Spec `docs/spec/issue-1587.md`):
 * Die Leiste ist keine eingerückte Pille mehr, sondern läuft über die volle Breite und wird zur
 * Inhaltsseite durch eine durchgehende 1px-Kante abgegrenzt.
 *
 * Nutzerauftrag 2026-09-22 verschärft „volle Breite" von der SHELL-Breite auf die VIEWPORT-Breite:
 * Die Leiste schließt links und rechts mit den Seitenkanten ab und — je nach gewählter Position —
 * oben mit der Ober- oder unten mit der Unterkante. Die alte Fassung maß nur bei 375px und 1024px
 * gegen `.app`; beide liegen unterhalb der 80rem-Kappung der Shell, der Unterschied war dort nicht
 * sichtbar. Deshalb misst diese Fassung zusätzlich oberhalb der Kappung (1600px).
 *
 *  - AK1: Leiste beginnt bei x = 0 und endet an der Viewport-Breite — bei 375px, 1024px und 1600px.
 *  - AK1b: Der INHALT der Leiste steht trotzdem auf der Inhaltsspalte von `.app` (ab 48rem mit dem
 *    bewussten --pp-space-2-Aufschlag aus #485/#718).
 *  - AK2: border-radius 0 plus messbare 1px-Kante auf der Inhaltsseite (Oben → Unterkante,
 *    Unten → Oberkante; border ODER inset-Schatten, Umsetzung offen).
 *  - AK3: Die Leiste berührt die gewählte Viewport-Kante schon im Standzustand, ohne Scrollen.
 *
 * Das Verhalten beim Scrollen (Kleben an der Kante, Abstandsschild zum Inhalt) sichert
 * mobile-shell.spec.ts — bewusst hier nicht dupliziert.
 */

const MOBILE = { width: 375, height: 812 } as const;
const DESKTOP = { width: 1024, height: 800 } as const;
/** Oberhalb der 80rem-Kappung von `.app` (1280px): nur hier trennt sich Shell- von Viewport-Breite. */
const WIDE = { width: 1600, height: 900 } as const;

/** Der bewusste Inline-Aufschlag der Leiste gegenüber der Inhaltsspalte ab 48rem (--pp-space-2). */
const BAR_INLINE_OFFSET = 8;

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

/** Linke Kante des INHALTSKASTENS von `.app` — die Spalte, auf der die Seiteninhalte stehen. */
const contentColumnStart = async (page: Page): Promise<number> =>
	page.evaluate(() => {
		const app = document.querySelector('.app');
		if (app === null) throw new Error('.app fehlt im Markup');
		return app.getBoundingClientRect().left + parseFloat(window.getComputedStyle(app).paddingLeft);
	});

/** AK1: Leiste von Seitenkante zu Seitenkante. */
const expectBarEdgeToEdge = async (page: Page, viewportWidth: number): Promise<void> => {
	const barBox = await stableBox(page, '.app-header__bar');
	expect(barBox.x, 'Leiste beginnt an der linken Viewport-Kante').toBe(0);
	expect(barBox.x + barBox.width, 'Leiste endet an der rechten Viewport-Kante').toBe(viewportWidth);
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

test.describe('Kopfleiste randbündig mit durchgehender Kante', () => {
	for (const [name, viewport] of [
		['375px', MOBILE],
		['1024px', DESKTOP],
		['1600px', WIDE],
	] as const) {
		test(`AK1: Leiste schließt links und rechts mit dem Viewport ab bei ${name}`, async ({ page }) => {
			await gotoApp(page, viewport);
			await expectBarEdgeToEdge(page, viewport.width);
		});

		test(`AK1b: Inhalt der Leiste steht auf der Inhaltsspalte bei ${name}`, async ({ page }) => {
			await gotoApp(page, viewport);

			const brand = await stableBox(page, '.app-header__brand');
			const column = await contentColumnStart(page);
			// Ab 48rem steht der bewusste --pp-space-2-Aufschlag zwischen Spaltenkante und Logo.
			const expected = viewport.width >= 768 ? BAR_INLINE_OFFSET : 0;
			expect(Math.round(brand.x - column), 'Logo steht auf der Inhaltsspalte (ab 48rem plus --pp-space-2)').toBe(
				expected,
			);
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

	/**
	 * AK3 — Standzustand, ohne Scrollen: Vor dem Umbau schob das Stand-Padding der Shell die
	 * Kopfzeile ab 48rem um --pp-space-5 nach unten; die Leiste erreichte die Oberkante erst beim
	 * Scrollen. Deshalb hier auf der breiten Fläche gemessen.
	 */
	test('AK3 (Oben): Leiste berührt die Oberkante schon ohne Scrollen', async ({ page }) => {
		await gotoApp(page, WIDE);

		const barBox = await stableBox(page, '.app-header__bar');
		expect(barBox.y, 'Leiste schließt randbündig mit der Viewport-Oberkante ab').toBe(0);
	});

	test('AK3 (Unten): Leiste berührt die Unterkante schon ohne Scrollen', async ({ page }) => {
		await gotoApp(page, WIDE, 'bottom');

		const barBox = await stableBox(page, '.app-header__bar');
		expect(Math.round(barBox.y + barBox.height), 'Leiste schließt randbündig mit der Unterkante ab').toBe(WIDE.height);
	});

	/**
	 * AK4 — Reflow (WCAG 1.4.10 / 1.4.4): Die fixierte Kopfzeile steht außerhalb des Flusses, die
	 * Shell reserviert ihren Platz als Padding. Solange die Leiste einzeilig bleibt, trifft das
	 * rem-basierte Token die Höhe exakt. Bei 200 % Textvergrößerung passen Logo, sechs Kopf-Aktionen
	 * und Avatar aber nicht mehr in eine Zeile — die Leiste bricht um und wird höher als die
	 * Reservierung. Dann läge Inhalt UNTER der Leiste und wäre verloren.
	 *
	 * Gemessen wird der Vertrag direkt (reservierter Platz ≥ tatsächliche Höhe) statt an einem
	 * Inhalts-Element: So hängt der Test nicht davon ab, wie viele Aufgaben das Testkonto hat.
	 * 200 % Textvergrößerung wird über die verdoppelte Wurzel-Schriftgröße nachgestellt; alle
	 * Kopfzeilen-Maße sind rem-basiert und ziehen mit.
	 */
	const reserveVsHeight = async (page: Page): Promise<{ reserved: number; height: number }> =>
		page.evaluate(() => {
			const app = document.querySelector('.app');
			const header = document.querySelector('.app-header');
			if (app === null || header === null) throw new Error('App-Shell oder Kopfzeile fehlt im Markup');
			const style = window.getComputedStyle(app);
			const bottom = app.classList.contains('header-bottom');
			return {
				reserved: parseFloat(bottom ? style.paddingBottom : style.paddingTop),
				height: header.getBoundingClientRect().height,
			};
		});

	for (const [name, position] of [
		['Oben', undefined],
		['Unten', 'bottom'],
	] as const) {
		test(`AK4 (${name}): bei 200 % Textvergrößerung bleibt der Platz der Kopfzeile reserviert`, async ({ page }) => {
			await gotoApp(page, MOBILE, position);
			// Erst warten, bis die KoliBri-Toolbar ihre Buttons asynchron im Shadow-DOM aufgebaut hat:
			// Ohne die sechs 44px-Buttons bricht die Zeile gar nicht um und der Test wäre falsch grün
			// (Muster aus mobile-shell.spec.ts).
			await expect(await headerAction(page, 'Neuen Task anlegen')).toBeVisible();

			await page.addStyleTag({ content: 'html { font-size: 32px !important; }' });
			// Auf den Umbruch warten: einzeilig misst die Leiste bei 32px-Wurzel rund 105px,
			// mehrzeilig deutlich mehr.
			await expect
				.poll(async () => (await page.locator('.app-header').boundingBox())!.height, { timeout: 5000 })
				.toBeGreaterThan(150);

			// Pollend messen: Die Nachmessung läuft über einen ResizeObserver, ihr Ergebnis steht erst
			// nach dem nächsten Layout in der Shell. Eine Momentaufnahme direkt nach dem Umbruch wäre
			// ein Wettlauf. Bleibt die Reservierung zu klein, läuft der Poll in den Timeout — der
			// Fehlerfall ist also weiterhin rot.
			await expect
				.poll(
					async () => {
						const { reserved, height } = await reserveVsHeight(page);
						return reserved - Math.round(height);
					},
					{ timeout: 5000, message: 'Shell reserviert mindestens die tatsächliche Höhe der Kopfzeile' },
				)
				.toBeGreaterThanOrEqual(0);
		});
	}
});
