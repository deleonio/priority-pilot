import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Dunkelmodus-Lesbarkeit der Dashboard-Panels (UX-Audit 2026-08, Finding P1-1).
 *
 * Warum dieser Test existiert: Die Panels „Nächste Aufgabe" und „Was ist jetzt dran?" liegen im
 * Shadow-DOM-Umfeld von KoliBri (KolTabs/KolCard), das seine Textfarbe unabhängig vom
 * `data-theme`-Attribut auf Schwarz setzt. Wer nur den Hintergrund auf ein `--pp-*`-Token zieht,
 * bekommt im Dunkelmodus schwarz auf dunkelgrau — gemessene **1.34:1** statt geforderter 4.5:1
 * (BITV/WCAG 1.4.3). Der Fehler ist rein visuell: kein Test schlug an, die App „funktionierte".
 *
 * Genau der Fall, den die TDD-Strategie als „stiller Ausfall" zum Testen freigibt — deshalb wird
 * hier der **gemessene Kontrast** ausgewertet, nicht ein Farbwert festgeschrieben (eine
 * Palettenänderung darf den Test nicht rot machen, eine Regression der Lesbarkeit schon).
 *
 * Viewport 375×812 nach Mobile-First-Konvention (.ai-knowledge/conventions.md).
 */

/** localStorage-Schlüssel der Theme-Wahl — identisch zu STORAGE_KEY in `src/lib/theme.ts`. */
const THEME_STORAGE_KEY = 'pp-theme';

/** WCAG 1.4.3 (AA) für normalen Text. */
const MIN_CONTRAST = 4.5;

/**
 * Misst den Kontrast zwischen der Textfarbe eines Elements und der ersten nicht-transparenten
 * Hintergrundfläche darüber — also dem, was ein Mensch tatsächlich sieht.
 */
type ContrastSample = { ratio: number; color: string; background: string };

const measureContrast = (page: import('./fixtures').Page, selector: string): Promise<ContrastSample | null> =>
	page.evaluate((sel) => {
		const element = document.querySelector(sel);
		if (element === null) {
			return null;
		}
		const channels = (value: string): number[] => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
		const luminance = ([r, g, b]: number[]): number => {
			const linear = (channel: number): number => {
				const v = channel / 255;
				return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
		};

		// Erste deckende Hintergrundfläche in der Elternkette suchen (transparent = durchreichen).
		let node: Element | null = element;
		let background = 'rgb(255, 255, 255)';
		while (node !== null) {
			const candidate = window.getComputedStyle(node).backgroundColor;
			if (candidate !== '' && !candidate.startsWith('rgba(0, 0, 0, 0')) {
				background = candidate;
				break;
			}
			node = node.parentElement;
		}

		const color = window.getComputedStyle(element).color;
		const textLuminance = luminance(channels(color));
		const backgroundLuminance = luminance(channels(background));
		const lighter = Math.max(textLuminance, backgroundLuminance);
		const darker = Math.min(textLuminance, backgroundLuminance);
		return { ratio: (lighter + 0.05) / (darker + 0.05), color, background };
	}, selector);

test.describe('Dunkelmodus – Lesbarkeit der Dashboard-Panels', () => {
	test('Panels mit Token-Hintergrund halten 4.5:1 im Dunkelmodus (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), THEME_STORAGE_KEY);

		await page.goto('/');
		await waitForStableView(page);

		// Vorbedingung: der Dunkelmodus ist wirklich aktiv, sonst misst der Test den Hellmodus grün.
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// Das Panel rendert erst, wenn die Task-Daten da sind — sonst misst der Test einen leeren DOM.
		await expect(page.locator('.dashboard-next-task')).toBeVisible();

		for (const selector of [
			'.dashboard-next-task h3',
			'.dashboard-next-task p',
			'.dashboard-suggestions h3',
			'.dashboard-suggestions p',
		]) {
			const sample = await measureContrast(page, selector);
			expect(sample, `Element ${selector} nicht gefunden`).not.toBeNull();
			const { ratio, color, background } = sample as ContrastSample;
			expect(ratio, `Kontrast für ${selector} (${color} auf ${background})`).toBeGreaterThanOrEqual(MIN_CONTRAST);
		}
	});
});
