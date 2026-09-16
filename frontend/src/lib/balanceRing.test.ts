import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ringTicks, TICK_COUNT } from './balanceFigure';

/**
 * Die Farbrampe des Zifferblatts, statisch geprüft.
 *
 * Der Ring trägt eine Bewertung: dunkelrot bei 0 %, dunkelgrün bei 100 %. Beide Eigenschaften, die
 * das leisten, sind rechenbar und werden deshalb gerechnet statt geschaut (ux-design.md §2,
 * Regel 1) — im Muster von `pillarPalette.test.ts`, das app.css direkt einliest:
 *
 * 1. **Jede der 100 leuchtenden Strichfarben hält ≥ 3:1 gegen die Karte**, in beiden Themes. Die
 *    Striche sind ein bedeutungstragendes Grafikelement (WCAG 1.4.11).
 * 2. **Der Farbton läuft monoton von Rot nach Grün.** Ein Rückwärtssprung im Hue macht aus der
 *    Skala ein Muster — dann ließe sich „weiter im Uhrzeigersinn" nicht mehr als „besser" lesen.
 *
 * Geprüft werden nicht die fünf Stützstellen, sondern alle 100 gemischten Striche: Zwischen zwei
 * Farben, die beide bestehen, kann sehr wohl eine liegen, die es nicht tut.
 */

const dir = fileURLToPath(new URL('.', import.meta.url));
const appCss = readFileSync(`${dir}../app.css`, 'utf8');

type Theme = 'light' | 'dark';
type Rgb = readonly [number, number, number];

/** Start des Dark-Blocks — Tokens davor gehören zu `:root` (Light), danach zum Dark-Theme. */
const darkBlockStart = appCss.search(/^:root\[data-theme='dark'\]/m);

/** Liest ein `--pp-*`-Token im jeweiligen Theme-Block. */
const token = (theme: Theme, name: string): string => {
	const matches = [...appCss.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))];
	const match = matches.find((entry) =>
		theme === 'light' ? (entry.index ?? 0) < darkBlockStart : (entry.index ?? 0) > darkBlockStart,
	);
	if (!match) throw new Error(`Token --${name} fehlt im ${theme}-Block von app.css`);
	return match[1];
};

const hexToRgb = (hex: string): Rgb => {
	const value = Number.parseInt(hex.slice(1), 16);
	return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
};

const linearize = (channel: number): number =>
	channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Relative Leuchtdichte nach WCAG 2.x. */
const luminance = (rgb: Rgb): number =>
	0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);

const contrast = (a: Rgb, b: Rgb): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** Farbton in Grad (0 = rot, 120 = grün) — dieselbe Definition wie HSL. */
const hue = ([r, g, b]: Rgb): number => {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const span = max - min;
	if (span === 0) return 0;
	const raw = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
	return (raw * 60 + 360) % 360;
};

/**
 * Die 100 Strichfarben eines Themes — exakt die Mischung, die `tickStroke` als `color-mix(in srgb,
 * …)` an den Browser gibt und der Shader aus `u_ring_stops` rechnet: komponentenweise linear im
 * gamma-kodierten sRGB.
 */
const tickColors = (theme: Theme): Rgb[] => {
	const stops = [0, 25, 50, 75, 100].map((stop) => hexToRgb(token(theme, `pp-balance-ring-${stop}`)));
	return ringTicks(1).map((tick): Rgb => {
		const from = stops[tick.stop / 25];
		const to = stops[tick.stop / 25 + 1];
		return [0, 1, 2].map((channel) => from[channel] + (to[channel] - from[channel]) * tick.mix) as unknown as Rgb;
	});
};

describe('Zifferblatt — Farbrampe', () => {
	for (const theme of ['light', 'dark'] as const) {
		it(`${theme}: jede der 100 Strichfarben hält ≥ 3:1 gegen die Karte`, () => {
			const surface = hexToRgb(token(theme, 'pp-surface-1'));
			const colors = tickColors(theme);
			expect(colors).toHaveLength(TICK_COUNT);

			colors.forEach((color, index) => {
				expect(contrast(color, surface), `${theme}: Strich ${index}`).toBeGreaterThanOrEqual(3);
			});
		});

		it(`${theme}: der Farbton läuft ohne Rückwärtssprung von Rot nach Grün`, () => {
			const hues = tickColors(theme).map(hue);

			expect(hues[0]).toBeLessThan(20);
			expect(hues[TICK_COUNT - 1]).toBeGreaterThan(120);
			hues.forEach((value, index) => {
				if (index === 0) return;
				expect(value, `${theme}: Strich ${index} springt zurück`).toBeGreaterThanOrEqual(hues[index - 1] - 1e-9);
			});
		});
	}
});
