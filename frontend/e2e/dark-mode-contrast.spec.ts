import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme, waitForStableView } from './helpers';

/**
 * Dunkelmodus-Lesbarkeit — App-Flächen UND KoliBri-Komponenten.
 *
 * Warum diese Datei existiert (UX-Audit 2026-08, Finding P1-1): Die Panels „Nächste Aufgabe" und
 * „Was ist jetzt dran?" bekamen im Dunkelmodus einen `--pp-*`-Hintergrund, aber keine Textfarbe —
 * im KoliBri-Umfeld erbte der Text dort Schwarz. Gemessene **1.34:1** statt geforderter 4.5:1
 * (BITV/WCAG 1.4.3). Der Fehler war rein visuell: kein Test schlug an, die App „funktionierte".
 *
 * Dazu kam P1-2 („Dunkelmodus ist ein Flickenteppich"): `@public-ui/theme-default` kannte bis 4.4.0
 * nur eine Hell-Palette, die Komponenten blieben weiß, während die App-Fläche dunkel wurde. Seit
 * 4.4.1 löst das Theme jede Farbe über `light-dark()` gegen `color-scheme` auf und folgt damit dem
 * Schalter, den die App auf `<html>` setzt (`applyTheme()` in `src/lib/theme.ts`). Der letzte Test
 * hier nagelt genau diese Kopplung fest.
 *
 * Genau die Fälle, die die TDD-Strategie als „stillen Ausfall" zum Testen freigibt — deshalb wird
 * durchweg **gemessen** (Kontrast, Luminanz), nicht ein Farbwert festgeschrieben: eine
 * Palettenänderung darf den Test nicht rot machen, eine Regression der Lesbarkeit schon.
 *
 * Viewport 375×812 nach Mobile-First-Konvention (.ai-knowledge/project.md → Mobile-First).
 *
 * Pattern: public/docs/e2e-a11y-pattern.md — AxeBuilder mit KoliBri Shadow DOM
 */

test.describe('Dunkelmodus – Lesbarkeit der Dashboard-Panels', () => {
	test('Panels mit Token-Hintergrund halten 4.5:1 im Dunkelmodus (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		// Modus direkt am `<html>` erzwingen statt über localStorage/useTheme zu gehen — der Test
		// misst die Dunkel-Regeln unabhängig von der Nutzer-Präferenz. `setTheme` setzt dabei
		// `data-theme` UND `color-scheme`, sonst bliebe KoliBri hell (siehe helpers.ts).
		await setTheme(page, 'dark');

		// Das Panel rendert erst, wenn die Task-Daten da sind — sonst misst der Test einen leeren DOM.
		await expect(page.locator('.dashboard-next-task')).toBeVisible();

		// AxeBuilder-Scan für Kontrast-Verstöße (Pattern: public/docs/e2e-a11y-pattern.md).
		// Seit 4.4.1 sind die KoliBri-Flächen mit im Scan: `.dashboard-top-tasks` liegt in einer
		// KolCard, deren Fläche das Theme selbst malt — vorher war dort schwarz auf weiß und damit
		// strukturell grün, unabhängig vom Dunkelmodus.
		const results = await new AxeBuilder({ page })
			.include('.dashboard-next-task')
			.include('.dashboard-suggestions')
			.include('.dashboard-top-tasks')
			.withTags(['wcag2aa']) // WCAG AA (inkl. 1.4.3 Kontrast)
			.analyze();

		// Nur Kontrast-Verstöße melden (andere A11y-Themen werden separat getestet)
		const contrastViolations = results.violations.filter(
			(v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
		);
		expect(contrastViolations, 'Kontrast-Verstöße in Dashboard-Panels').toEqual([]);
	});

	/**
	 * P1-2 — Die KoliBri-Komponenten schalten mit.
	 *
	 * Gemessen wird am **Host** (`kol-card`), nicht im Shadow-DOM (#824-Guard): Das Theme setzt auf
	 * dem `:host` jeder Komponente `--kol-a11y-font-color: var(--color-ink)` und daraus `color` —
	 * und `--color-ink` ist seit 4.4.1 ein `light-dark(#000000, …)`. Die Textfarbe des Hosts ist
	 * damit von außen lesbar und zugleich der direkte Beleg, dass die `light-dark()`-Auflösung
	 * greift. Vor 4.4.1 stand dort in beiden Modi Schwarz — genau der Flickenteppich.
	 *
	 * Zugesichert wird eine Relation, kein Wert: hell und dunkel unterscheiden sich, und die
	 * Textfarbe ist im Dunkelmodus die hellere. Ein Paletten-Update im Theme hält den Test grün;
	 * fällt die `color-scheme`-Kette aus (Theme-Downgrade, verlorener Inline-Style), wird er rot.
	 */
	test('KoliBri-Komponenten folgen dem Farbschema (kol-card-Textfarbe hell vs. dunkel)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		const card = page.locator('kol-card').first();
		await expect(card).toBeVisible();

		/**
		 * Relative Luminanz (WCAG 2.x) der Textfarbe des Hosts. Bewusst schließungs-frei, damit
		 * Playwright die Funktion serialisieren kann.
		 */
		const readInkLuminance = async (): Promise<{ color: string; luminance: number }> =>
			card.evaluate((host) => {
				const color = window.getComputedStyle(host).color;
				const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
				const linear = channels.map((channel) => {
					const value = channel / 255;
					return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
				});
				return { color, luminance: 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] };
			});

		await setTheme(page, 'light');
		const light = await readInkLuminance();

		await setTheme(page, 'dark');
		const dark = await readInkLuminance();

		expect(
			dark.color,
			`kol-card-Textfarbe muss sich mit dem Farbschema ändern (hell ${light.color}, dunkel ${dark.color})`,
		).not.toBe(light.color);

		expect(
			dark.luminance,
			`kol-card-Textfarbe muss im Dunkelmodus die hellere sein (hell ${light.color} → L ${light.luminance}, dunkel ${dark.color} → L ${dark.luminance})`,
		).toBeGreaterThan(light.luminance);
	});
});
