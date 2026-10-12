import type { Page } from './fixtures';
import { expect, test } from './fixtures';
import { setTheme, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests (#1513, docs/spec/issue-1513.md) — Archivo als primäre Schriftart, inkl.
 * KoliBri-Theme-Patch.
 *
 * AK1 — App-Text (body) rendert mit Archivo, System-Stack bleibt als Fallback erhalten.
 * AK2 — KoliBri-Komponenten (Host-Element) übernehmen Archivo (Custom-Property-Vererbung
 *        über die Shadow-Grenze bzw. globale Host-Regel, frontend/DESIGN.md:145-158).
 * AK5 (e2e-Teil) — Basis-Schriftgröße bleibt 16px.
 * AK6 — AK1/AK2 gelten unverändert im Dark Mode.
 * AK7 — Mobile-First (375px): Archivo rendert, kein Element überragt den Viewport.
 *
 * Pattern: `waitForStableView` wartet bereits auf `document.fonts.ready` (helpers.ts) — die
 * Font-Assertions laufen daher nicht gegen einen noch ladenden Font-Stack.
 *
 * Kein Shadow-DOM-Piercing (Issue #824, eslint.config.mjs no-restricted-syntax auf
 * `.shadowRoot`): AK2 misst die berechnete `font-family` auf dem Custom-Element-Host selbst —
 * die öffentliche Schnittstelle. Da `font-family` eine vererbte CSS-Eigenschaft ist und über die
 * Shadow-Grenze in den internen Baum hineinwirkt (frontend/DESIGN.md:145-158), spiegelt der
 * Host-Wert exakt das, was auch der Shadow-Inhalt erbt.
 *
 * Root Cause AK2/AK6-Flackern (Review-Fund PR #1516): `waitForStableView` prüft die Hydration nur
 * über `kol-button.shadowRoot !== null` bzw. `:not(:defined)` (helpers.ts) — ein Custom Element
 * ist damit bereits als „hydriert" erkannt, sobald sein Konstruktor gelaufen ist, nicht erst wenn
 * Stencil die `hydrated`-Klasse setzt und seine Styles final aufgelöst hat. Reproduziert lokal
 * (Chromium, Vite-Dev-Server): `EmptyState`s `kol-button` („Ersten Task anlegen") liefert direkt
 * nach `waitForStableView` noch `getComputedStyle(host).fontFamily === '"Times New Roman"'` (UA-
 * Default vor Style-Auflösung) statt Archivo, obwohl `--pp-font-family` korrekt via
 * `kol-button { font-family: var(--pp-font-family) }` (app.css:213-240) gesetzt ist — derselbe
 * Host liefert wenige Frames später den korrekten Wert. Kein CSS-/Produktionsbug, sondern eine
 * reine Mess-Race: ein reiner Leerstring-Check auf `fontFamily` (frühere Fassung dieses Tests)
 * lässt sich davon täuschen, da der UA-Default-Wert bereits nicht-leer ist.
 *
 * Main-Rot (Verify 38263943560): `Dashboard` steht schon vor dem Laden der Tasks — danach
 * mountet der `EmptyState` eine frische `kol-card` VOR den Tabs, ihr `kol-button` ist bis zur
 * Slot-Zuweisung ohne berechnete `font-family` (""). Ein getrenntes Warten-dann-Messen ließ diesen
 * Wechsel dazwischen; `expectHostsArchivo` pollt deshalb die Messung selbst bis Archivo.
 *
 * HOST_SELECTORS deckt das komplette in app.css:213-240 abgesicherte Tag-Set ab (Review-Fund
 * #1513-Follow-up: die vorherige 5er-Teilmenge inkl. des toten `kol-table`-Selektors hätte eine
 * unvollständige Host-Regel nicht erkannt, da `present: false` fehlende Hosts stillschweigend
 * herausfiltert).
 */

const HOST_SELECTORS = [
	'kol-accordion',
	'kol-alert',
	'kol-avatar',
	'kol-badge',
	'kol-button',
	'kol-card',
	'kol-combobox',
	'kol-details',
	'kol-dialog',
	'kol-heading',
	'kol-input-checkbox',
	'kol-input-date',
	'kol-input-password',
	'kol-input-radio',
	'kol-input-range',
	'kol-input-text',
	'kol-meter',
	'kol-popover-button',
	'kol-progress',
	'kol-select',
	'kol-single-select',
	'kol-spin',
	'kol-table-stateful',
	'kol-tabs',
	'kol-textarea',
	'kol-toolbar',
];

const getBodyFontFamily = () => (document.body ? getComputedStyle(document.body).fontFamily : '');

const getHostFontFamilies = (selectors: string[]) =>
	selectors.map((selector) => {
		const host = document.querySelector(selector);
		if (host === null) {
			return { selector, present: false, fontFamily: '' };
		}
		return { selector, present: true, fontFamily: getComputedStyle(host).fontFamily };
	});

/** Pollt, bis jeder vorhandene Host Archivo als führenden Font trägt; Abweichungen stehen in der Fehlermeldung. */
const expectHostsArchivo = (page: Page) =>
	expect
		.poll(async () => {
			const present = (await page.evaluate(getHostFontFamilies, HOST_SELECTORS)).filter((r) => r.present);
			if (present.length === 0) {
				return ['keines der geprüften KoliBri-Elemente war im DOM vorhanden'];
			}
			return present
				.filter((r) => r.fontFamily.split(',')[0].trim().replace(/['"]/g, '') !== 'Archivo')
				.map((r) => `${r.selector}: Host-Element font-family war "${r.fontFamily}"`);
		})
		.toEqual([]);

test.describe('Issue #1513 — Archivo als primäre Schriftart', () => {
	test('AK1: body rendert mit Archivo als führendem Font, System-Stack bleibt Fallback', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const fontFamily = await page.evaluate(getBodyFontFamily);

		expect(fontFamily.split(',')[0].trim().replace(/['"]/g, ''), `body font-family war "${fontFamily}"`).toBe(
			'Archivo',
		);
		expect(fontFamily, `body font-family "${fontFamily}" enthält keinen system-ui-Fallback`).toContain('system-ui');
	});

	test('AK2: KoliBri-Komponenten übernehmen Archivo als Host-Font-Family', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);
		await expectHostsArchivo(page);
	});

	test('AK5: Basis-Schriftgröße bleibt 16px', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const fontSize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
		expect(fontSize).toBe('16px');
	});

	test('AK6: Archivo und Basisgröße gelten unverändert im Dark Mode', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);
		await setTheme(page, 'dark');

		const fontFamily = await page.evaluate(getBodyFontFamily);
		expect(fontFamily.split(',')[0].trim().replace(/['"]/g, ''), `dark mode body font-family war "${fontFamily}"`).toBe(
			'Archivo',
		);

		await expectHostsArchivo(page);
	});

	test('AK7: bei 375px rendert das Dashboard in Archivo ohne Viewport-Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const fontFamily = await page.evaluate(getBodyFontFamily);
		expect(fontFamily.split(',')[0].trim().replace(/['"]/g, '')).toBe('Archivo');

		const overflowCount = await page.evaluate(() => {
			const elements = Array.from(document.body.querySelectorAll('*'));
			return elements.filter((el) => {
				const box = el.getBoundingClientRect();
				return box.width > 0 && box.x + box.width > 375 + 1;
			}).length;
		});
		expect(overflowCount, `${overflowCount} sichtbare Elemente ragen bei 375px über den Viewport hinaus`).toBe(0);
	});
});
