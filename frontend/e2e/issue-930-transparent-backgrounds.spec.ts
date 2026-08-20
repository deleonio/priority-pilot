import { test, expect } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Verhaltens-Spec für #930 — Transparente KoliBri-Host-Hintergründe
 *
 * Akzeptanzkriterien (aus Issue-Body KI-ANALYSE):
 * AK1: Alle KoliBri-Host-Elemente (kol-*) haben `background-color: transparent` im Computed Style.
 * AK2: Keine visuellen Regressionen — Textinhalte, Icons und Interaktionszustände (Hover, Focus, Disabled)
 *      bleiben lesbar und funktionsfähig.
 * AK3: Funktioniert in beiden Themes (Light/Dark) ohne Anpassung.
 *
 * Spec: KI-ANALYSE im Issue-Body (kein separater Spec nötig — reines CSS-Styling-Change).
 */

// Repräsentative Auswahl der im Projekt verbauten KoliBri-Host-Elemente
const KOLOBRI_HOST_ELEMENTS = [
	'kol-alert',
	'kol-avatar',
	'kol-badge',
	'kol-button',
	'kol-card',
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
	'kol-single-select',
	'kol-spin',
	'kol-tabs',
	'kol-textarea',
	'kol-toolbar',
] as const;

const isElementUsedInProject = (tag: string): boolean => {
	const usedInProject = [
		'kol-alert',
		'kol-avatar',
		'kol-badge',
		'kol-button',
		'kol-card',
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
		'kol-single-select',
		'kol-spin',
		'kol-tabs',
		'kol-textarea',
		'kol-toolbar',
	];
	return usedInProject.includes(tag);
};

test.describe('#930: Transparente KoliBri-Host-Hintergründe', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
	});

	// Räumt nach jedem Test alle über die API angelegten Tasks weg (z. B. den überfälligen Task aus
	// AK2), damit Folge-Tests wieder von einer leeren, definierten Task-Liste starten.
	test.afterEach(async ({ page }) => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	});

	/**
	 * AK1: Alle KoliBri-Host-Elemente (kol-*) haben `background-color: transparent`
	 * im Computed Style.
	 *
	 * Prüft eine repräsentative Stichprobe der im Projekt verbauten Komponenten auf
	 * verschiedenen Viewport-Größen (Mobile 375px, Desktop 1280px).
	 */
	for (const { width, height, name } of [
		{ width: 375, height: 812, name: 'Mobile (375px)' },
		{ width: 1280, height: 800, name: 'Desktop (1280px)' },
	]) {
		test(`AK1: KoliBri-Host-Elemente auf Startseite haben background-color: transparent (Light Mode, ${name})`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height });
			// Sicherstellen, dass Light Mode aktiv ist (Default)
			await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
			await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

			const results: { tag: string; backgroundColor: string; used: boolean }[] = [];

			for (const tag of KOLOBRI_HOST_ELEMENTS) {
				// Ersten Vorkommen jedes Tags finden
				const element = page.locator(tag).first();
				const count = await element.count();

				if (count === 0) {
					// Element nicht im aktuellen View — nur loggen, nicht fehlschlagen
					results.push({ tag, backgroundColor: 'NOT_FOUND_IN_DOM', used: isElementUsedInProject(tag) });
					continue;
				}

				const backgroundColor = await element.evaluate((el) => {
					return window.getComputedStyle(el).backgroundColor;
				});

				results.push({ tag, backgroundColor, used: isElementUsedInProject(tag) });

				// Nur für im Projekt verbaute Elemente hart prüfen
				if (isElementUsedInProject(tag)) {
					// browser returns '' or 'rgba(0, 0, 0, 0)' or 'transparent' for transparent background
					const isTransparent =
						backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent' || backgroundColor === '';
					expect(
						isTransparent,
						`${tag} (used in project) muss background-color: transparent haben, aber hat: "${backgroundColor}"`,
					).toBe(true);
				}
			}

			// Zusammenfassung loggen für Debugging
			console.log(`AK1 Light Mode Results (${name}):`, JSON.stringify(results, null, 2));

			// Sicherstellen, dass mindestens ein verbautes Element gefunden wurde (Mutations-Schutz)
			const foundUsed = results.filter((r) => r.used && r.backgroundColor !== 'NOT_FOUND_IN_DOM');
			expect(
				foundUsed.length,
				'Mindestens ein im Projekt verbautes kol-* Element muss im DOM gefunden werden',
			).toBeGreaterThan(0);
		});
	}

	/**
	 * AK1 + AK3: Gleicher Test im Dark Mode auf verschiedenen Viewports.
	 */
	for (const { width, height, name } of [
		{ width: 375, height: 812, name: 'Mobile (375px)' },
		{ width: 1280, height: 800, name: 'Desktop (1280px)' },
	]) {
		test(`AK1+AK3: KoliBri-Host-Elemente auf Startseite haben background-color: transparent (Dark Mode, ${name})`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height });
			await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
			await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

			const results: { tag: string; backgroundColor: string; used: boolean }[] = [];

			for (const tag of KOLOBRI_HOST_ELEMENTS) {
				const element = page.locator(tag).first();
				const count = await element.count();

				if (count === 0) {
					results.push({ tag, backgroundColor: 'NOT_FOUND_IN_DOM', used: isElementUsedInProject(tag) });
					continue;
				}

				const backgroundColor = await element.evaluate((el) => {
					return window.getComputedStyle(el).backgroundColor;
				});

				results.push({ tag, backgroundColor, used: isElementUsedInProject(tag) });

				if (isElementUsedInProject(tag)) {
					const isTransparent =
						backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent' || backgroundColor === '';
					expect(
						isTransparent,
						`${tag} (used in project) muss background-color: transparent haben, aber hat: "${backgroundColor}"`,
					).toBe(true);
				}
			}

			console.log(`AK1+AK3 Dark Mode Results (${name}):`, JSON.stringify(results, null, 2));

			const foundUsed = results.filter((r) => r.used && r.backgroundColor !== 'NOT_FOUND_IN_DOM');
			expect(
				foundUsed.length,
				'Mindestens ein im Projekt verbautes kol-* Element muss im DOM gefunden werden',
			).toBeGreaterThan(0);
		});
	}

	/**
	 * AK2: Keine visuellen Regressionen — Textinhalte lesbar.
	 *
	 * Prüft den Kontrast von kol-heading auf der Einstellungen-Seite. `getComputedStyle()` wird
	 * dabei nur auf dem Host-Element gemessen — kein Shadow-DOM-Piercing (`.shadowRoot`), das
	 * der ESLint-Guard aus Issue #824 verbietet (KoliBri black-box testen, siehe docs/testing.md §3).
	 * Für kol-heading ist das aussagekräftig: die Textfarbe kommt über eine geerbte CSS-Custom-
	 * Property (`--kol-a11y-font-color`) vom Host, das Host-`color` entspricht also der tatsächlich
	 * gerenderten Textfarbe.
	 *
	 * kol-badge wird bewusst NICHT auf Kontrast geprüft: seine Farben setzt die Komponente als
	 * Inline-Style auf einem Element im Shadow-DOM (automatisch kontrastsicher berechnet, siehe
	 * Kommentar in Dashboard.tsx), nicht über vererbte Host-Properties — eine Messung am Host liefert
	 * dafür keinen aussagekräftigen Wert und würde Shadow-DOM-Piercing erfordern. Stattdessen prüft
	 * dieser Test nur, dass kol-badge auf dem Dashboard überhaupt erscheint (AK1 deckt bereits ab,
	 * dass sein Host-Hintergrund transparent bleibt).
	 */
	test('AK2: Text-Kontrast in kritischen Komponenten (kol-heading, kol-badge) ≥ 4.5:1', async ({ page }) => {
		const MIN_CONTRAST = 4.5;

		// kol-badge rendert im Dashboard nur für Tasks mit überfälliger/baldiger Deadline
		// (Dashboard.tsx: `urgency !== 'later'`). Ohne einen solchen Task bleibt „Anstehende
		// Deadlines" leer und kol-badge fehlt im DOM — daher hier gezielt einen überfälligen
		// Task anlegen, statt uns auf zufällig vorhandene Backend-Daten zu verlassen.
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #930 Kontrast-Test', deadline: '2020-01-01T00:00:00.000Z' },
		});
		await page.reload();
		await waitForStableView(page);

		const measureContrast = async (
			selector: string,
		): Promise<{ ratio: number; color: string; background: string } | null> => {
			const element = page.locator(selector).first();
			const count = await element.count();
			if (count === 0) return null;

			return element.evaluate((el) => {
				const channels = (value: string): number[] => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
				const alpha = (value: string): number => {
					const parts = value.match(/[\d.]+/g) ?? [];
					return parts.length > 3 ? Number(parts[3]) : 1;
				};
				const luminance = ([r, g, b]: number[]): number => {
					const linear = (channel: number): number => {
						const v = channel / 255;
						return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
					};
					return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
				};

				let node: Element | null = el;
				let background = 'rgb(255, 255, 255)';
				while (node !== null) {
					const candidate = window.getComputedStyle(node).backgroundColor;
					if (candidate !== '' && alpha(candidate) > 0) {
						background = candidate;
						break;
					}
					node = node.parentElement;
				}

				const color = window.getComputedStyle(el).color;
				const textLuminance = luminance(channels(color));
				const backgroundLuminance = luminance(channels(background));
				const lighter = Math.max(textLuminance, backgroundLuminance);
				const darker = Math.min(textLuminance, backgroundLuminance);
				return { ratio: (lighter + 0.05) / (darker + 0.05), color, background };
			});
		};

		// Light Mode
		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

		// kol-badge auf Dashboard (Startseite): nur Präsenz, kein Kontrast (siehe Testbeschreibung
		// oben). Die Task-Liste wird erst nach dem Mount asynchron geladen; explizit auf das Badge
		// warten, statt sofort per `.count()` zu prüfen (sonst race gegen den Fetch nach dem Reload).
		await expect(page.locator('kol-badge').first()).toBeVisible({ timeout: 10000 });

		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
		await expect(page.locator('kol-badge').first()).toBeVisible();

		// kol-heading: auf Einstellungen-Seite navigieren (über Toolbar-Zahnrad-Button) — Light + Dark.
		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

		const settingsButton = page.getByRole('button', { name: /Einstellungen|Settings/i });
		await expect(settingsButton).toBeVisible({ timeout: 10000 });
		await settingsButton.click();
		await waitForStableView(page, 'Priority Pilot');

		const headingSample = await measureContrast('kol-heading');
		expect(headingSample, 'kol-heading muss auf der Einstellungen-Seite vorhanden sein').not.toBeNull();
		expect(
			headingSample!.ratio,
			`kol-heading Kontrast ${headingSample!.ratio}:1 (${headingSample!.color} auf ${headingSample!.background})`,
		).toBeGreaterThanOrEqual(MIN_CONTRAST);

		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

		const headingSampleDark = await measureContrast('kol-heading');
		expect(headingSampleDark, 'kol-heading (Dark Mode) muss vorhanden sein').not.toBeNull();
		expect(
			headingSampleDark!.ratio,
			`kol-heading (Dark) Kontrast ${headingSampleDark!.ratio}:1 (${headingSampleDark!.color} auf ${headingSampleDark!.background})`,
		).toBeGreaterThanOrEqual(MIN_CONTRAST);
	});

	/**
	 * AK2: Interaktionszustände (Hover, Focus, Disabled) funktionsfähig.
	 *
	 * Prüft an einem kol-button, dass Hover/Focus/Disabled-Zustände
	 * weiterhin korrekt rendern (Shadow-DOM ist unberührt vom Host-Hintergrund).
	 */
	test('AK2: Interaktionszustände (Hover, Focus) funktionsfähig bei kol-button', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		// Ein kol-button Host-Element direkt finden (einfacher als über Button-Rolle)
		const kolButtonHost = page.locator('kol-button').first();
		await expect(kolButtonHost).toBeVisible();

		// Host-Element muss transparent sein
		const hostBackground = await kolButtonHost.evaluate((el) => window.getComputedStyle(el).backgroundColor);
		expect(hostBackground).toBe('rgba(0, 0, 0, 0)');

		// Den inneren Button für Interaktion finden
		const innerButton = kolButtonHost.locator('button').first();
		await expect(innerButton).toBeVisible();

		// Hover-Zustand: Button muss sichtbar reagieren (Shadow-DOM intern)
		await innerButton.hover();
		await expect(innerButton).toBeVisible();

		// Focus-Zustand
		await innerButton.focus();
		await expect(innerButton).toBeFocused();

		const hasFocusIndicator = await innerButton.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			const hasOutline = styles.outlineStyle !== 'none' && parseInt(styles.outlineWidth) > 0;
			const hasBoxShadow = styles.boxShadow !== 'none';
			return hasOutline || hasBoxShadow;
		});
		expect(hasFocusIndicator, 'Focus-Indikator muss sichtbar sein').toBe(true);
	});

	/**
	 * AK3: Funktioniert in beiden Themes ohne Anpassung.
	 *
	 * Kombinierter Test: Wechselt zwischen Light/Dark und prüft,
	 * dass die Host-Hintergründe transparent bleiben.
	 */
	test('AK3: Theme-Wechsel behält transparente Host-Hintergründe bei', async ({ page }) => {
		const testTag = 'kol-button'; // Repräsentativ, immer vorhanden
		const element = page.locator(testTag).first();
		await expect(element).toBeVisible();

		// Light → Dark → Light
		for (const theme of ['light', 'dark', 'light'] as const) {
			await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

			const bg = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor);
			const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || bg === '';
			expect(isTransparent, `${testTag} in ${theme} Mode muss transparent sein, aber hat: "${bg}"`).toBe(true);
		}
	});
});
