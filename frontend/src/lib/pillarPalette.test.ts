import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Spec-Tests #1273 — Säulen-Rampe auf 7 paarweise unterscheidbare Neon-Farben
 * (docs/spec/issue-1273.md). Prüft statisch, was sonst nur „geschaut" würde:
 * Token-Anzahl, Paarweise-Distanz unter CVD, Neon-Schranken und die
 * Rampen-Konstante in beiden Herz-Renderern.
 *
 * Einlesen von app.css im Muster von desktopViewport.test.ts (readFileSync).
 */

const dir = fileURLToPath(new URL('.', import.meta.url));
const appCss = readFileSync(`${dir}../app.css`, 'utf8');

type Theme = 'light' | 'dark';
const PILLAR_COUNT = 7;

/** Alle `--pp-pillar-N: #rrggbb`-Deklarationen mit Position in der Datei. */
const pillarTokenMatches = [...appCss.matchAll(/--pp-pillar-(\d+):\s*(#[0-9a-fA-F]{6})/g)];

/** Start des Dark-Blocks — Tokens davor gehören zu `:root` (Light), danach zum Dark-Theme.
 * Zeilenanker, damit der Selektor-Erwähnung-Kommentar am Dateikopf nicht matcht. */
const darkBlockStart = appCss.search(/^:root\[data-theme='dark'\]/m);

const inTheme = (theme: Theme, match: RegExpMatchArray): boolean =>
	theme === 'light' ? (match.index ?? 0) < darkBlockStart : (match.index ?? 0) > darkBlockStart;

/** Tokens je Theme, zugeordnet über die Position relativ zum Dark-Block. */
const pillarTokens: Record<Theme, string[]> = {
	light: pillarTokenMatches.filter((m) => inTheme('light', m)).map((m) => m[2]),
	dark: pillarTokenMatches.filter((m) => inTheme('dark', m)).map((m) => m[2]),
};

// ── Farb-Mathematik (sRGB → Lab, CVD-Simulation nach Viénot et al., CIEDE2000) ──────────────

type Rgb = readonly [number, number, number];

const hexToRgb = (hex: string): Rgb => {
	const value = Number.parseInt(hex.slice(1), 16);
	return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
};

/** sRGB (0–1, gamma-kodiert) → lineares RGB. */
const linearize = (channel: number): number =>
	channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Lineares RGB → sRGB (0–1, gamma-kodiert). */
const delinearize = (channel: number): number =>
	channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

/** Lineares RGB (D65) → XYZ. */
const rgbToXyz = (rgb: Rgb): Rgb => {
	const [r, g, b] = rgb.map(linearize);
	return [
		0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
		0.2126729 * r + 0.7151522 * g + 0.072175 * b,
		0.0193339 * r + 0.119192 * g + 0.9503041 * b,
	];
};

/** XYZ → CIELAB mit D65-Weißpunkt. */
const xyzToLab = (xyz: Rgb): Rgb => {
	const white: Rgb = [0.95047, 1.0, 1.08883];
	const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
	const [fx, fy, fz] = [f(xyz[0] / white[0]), f(xyz[1] / white[1]), f(xyz[2] / white[2])];
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const deg = (rad: number): number => (rad * 180) / Math.PI;

/** CIEDE2000 (Sharma et al. 2005-Formelsatz). */
const ciede2000 = (lab1: Rgb, lab2: Rgb): number => {
	const [l1, a1, b1] = lab1;
	const [l2, a2, b2] = lab2;
	const c1 = Math.hypot(a1, b1);
	const c2 = Math.hypot(a2, b2);
	const cBar = (c1 + c2) / 2;
	const cBar7 = cBar ** 7;
	const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
	const a1p = a1 * (1 + g);
	const a2p = a2 * (1 + g);
	const c1p = Math.hypot(a1p, b1);
	const c2p = Math.hypot(a2p, b2);
	const h1p = c1p === 0 ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
	const h2p = c2p === 0 ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;
	const dLp = l2 - l1;
	const dCp = c2p - c1p;
	const dhp =
		c1p === 0 || c2p === 0 ? 0 : h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p < -180 ? h2p - h1p + 360 : h2p - h1p;
	const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);
	const lBarP = (l1 + l2) / 2;
	const cBarP = (c1p + c2p) / 2;
	const hBarP =
		c1p === 0 || c2p === 0
			? h1p + h2p
			: Math.abs(h1p - h2p) > 180
				? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2
				: (h1p + h2p) / 2;
	const t =
		1 -
		0.17 * Math.cos(((hBarP - 30) * Math.PI) / 180) +
		0.24 * Math.cos((2 * hBarP * Math.PI) / 180) +
		0.32 * Math.cos(((3 * hBarP + 6) * Math.PI) / 180) -
		0.2 * Math.cos(((4 * hBarP - 63) * Math.PI) / 180);
	const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
	const cBarP7 = cBarP ** 7;
	const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));
	const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
	const sc = 1 + 0.045 * cBarP;
	const sh = 1 + 0.015 * cBarP * t;
	const rT = -Math.sin((2 * dTheta * Math.PI) / 180) * rC;
	return Math.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rT * (dCp / sc) * (dHp / sh));
};

/**
 * CVD-Simulation nach Viénot, Brettel & Mollon (1999): Projektion im LMS-Raum auf linearisiertem
 * RGB, bei der die fehlende Zapfenachse durch eine Kombination der verbleibenden ersetzt wird
 * (Weiß wird erhalten). Die Simulation läuft auf LINEAREM RGB — auf gamma-kodierten Werten
 * kollabiert die Rücktransformation in die Gamut-Ecken.
 */
const RGB_TO_LMS: Rgb[] = [
	[17.8824, 43.5161, 2.1209],
	[3.4557, 27.1554, 3.867],
	[0.02996, 0.18431, 1.467],
];
const LMS_TO_RGB: Rgb[] = [
	[0.0808858684178949, -0.1311714291296067, 0.2288269107816468],
	[-0.01024124079608647, 0.0541040015313461, -0.12781153804859957],
	[-0.00036521985458311794, -0.004118617931506055, 0.6930479143358687],
];
type CvdCondition = 'normal' | 'protan' | 'deuter' | 'tritan';
const CVD_SEVERANCE: Record<CvdCondition, [number, number, number] | null> = {
	// Ersatzzeile für die fehlende Zapfenachse (L, M bzw. S) als Kombination der anderen.
	normal: null,
	protan: [0, 1.05118294, -0.05116099],
	deuter: [0.9513092, 0, 0.04866992],
	tritan: [-0.86744736, 1.86727089, 0],
};
const cvdConditions: CvdCondition[] = ['normal', 'protan', 'deuter', 'tritan'];

const mul3 = (matrix: Rgb[], v: Rgb): Rgb => [
	matrix[0][0] * v[0] + matrix[0][1] * v[1] + matrix[0][2] * v[2],
	matrix[1][0] * v[0] + matrix[1][1] * v[1] + matrix[1][2] * v[2],
	matrix[2][0] * v[0] + matrix[2][1] * v[1] + matrix[2][2] * v[2],
];

const simulateCvd = (rgb: Rgb, condition: CvdCondition): Rgb => {
	if (condition === 'normal') return rgb;
	const replacement = CVD_SEVERANCE[condition];
	if (!replacement) return rgb;
	const lms = mul3(RGB_TO_LMS, [linearize(rgb[0]), linearize(rgb[1]), linearize(rgb[2])]);
	const severed = replacement[0] * lms[0] + replacement[1] * lms[1] + replacement[2] * lms[2];
	const simulated: Rgb =
		condition === 'protan'
			? [severed, lms[1], lms[2]]
			: condition === 'deuter'
				? [lms[0], severed, lms[2]]
				: [lms[0], lms[1], severed];
	const [r, g, b] = mul3(LMS_TO_RGB, simulated);
	const clamp = (channel: number): number => delinearize(Math.min(1, Math.max(0, channel)));
	return [clamp(r), clamp(g), clamp(b)];
};

/** RGB (0–1) → HSL (h in Grad 0–360, s/l in 0–1). */
const rgbToHsl = (rgb: Rgb): [number, number, number] => {
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [(h * 60) % 360, s, l];
};

/** Zirkularer Hue-Abstand in Grad (0–180). */
const hueDistance = (h1: number, h2: number): number => {
	const raw = Math.abs(h1 - h2) % 360;
	return Math.min(raw, 360 - raw);
};

const themes: Theme[] = ['light', 'dark'];

describe('pillarPalette — AK1: Rampe hat je Theme genau 7 Ränge (Spec #1273)', () => {
	it.each(themes)('definiert im %s-Theme genau --pp-pillar-1 … --pp-pillar-7', (theme) => {
		const ranks = pillarTokenMatches.filter((m) => inTheme(theme, m)).map((m) => Number(m[1]));
		expect(ranks, `${theme}: Ränge 1–${PILLAR_COUNT} in Reihenfolge erwartet`).toEqual(
			Array.from({ length: PILLAR_COUNT }, (_, i) => i + 1),
		);
	});

	it('app.css enthält die Zeichenkette "pp-pillar-8" nicht mehr (Token, .vessel-water--8, .vessel-legend-dot--8)', () => {
		expect(appCss.match(/pp-pillar-8/g) ?? []).toHaveLength(0);
	});

	it('PILLAR_RAMP_SIZE ist in VesselBalance.tsx und VesselGlass.tsx jeweils 7', () => {
		for (const component of ['VesselBalance.tsx', 'VesselGlass.tsx']) {
			const source = readFileSync(`${dir}../components/${component}`, 'utf8');
			const match = source.match(/PILLAR_RAMP_SIZE\s*=\s*(\d+)/);
			expect(match, `${component} muss PILLAR_RAMP_SIZE deklarieren`).not.toBeNull();
			expect(Number(match?.[1]), `${component}: Rampe muss 7 Ränge haben`).toBe(PILLAR_COUNT);
		}
	});
});

describe('pillarPalette — AK2: je zwei der 7 Farben sind paarweise unterscheidbar (ΔE ≥ 7, auch unter CVD)', () => {
	const pairsOf = (hexes: string[]): Array<[string, string]> => {
		const pairs: Array<[string, string]> = [];
		for (let i = 0; i < hexes.length; i++) {
			for (let j = i + 1; j < hexes.length; j++) pairs.push([hexes[i], hexes[j]]);
		}
		return pairs;
	};
	const DELTA_E_MIN = 7;

	it.each(themes)('%s: alle 21 Paare erreichen ΔE(CIEDE2000) ≥ 7 unter Normalsicht und CVD', (theme) => {
		// Exakte Token-Anzahl und Rangfolge prüft AK1 — hier zählt die Paarweise-Distanz der
		// Rampenwerte, deshalb werden die ersten 7 geparssten Werte bewertet.
		const hexes = pillarTokens[theme].slice(0, PILLAR_COUNT);
		expect(hexes, `${theme}: mindestens ${PILLAR_COUNT} Hexwerte nötig`).toHaveLength(PILLAR_COUNT);
		const failures: string[] = [];
		let worst = { delta: Number.POSITIVE_INFINITY, label: '' };
		for (const [hexA, hexB] of pairsOf(hexes)) {
			for (const condition of cvdConditions) {
				const labA = xyzToLab(rgbToXyz(simulateCvd(hexToRgb(hexA), condition)));
				const labB = xyzToLab(rgbToXyz(simulateCvd(hexToRgb(hexB), condition)));
				const delta = ciede2000(labA, labB);
				if (delta < worst.delta) worst = { delta, label: `${hexA}/${hexB} (${condition})` };
				if (delta < DELTA_E_MIN) failures.push(`${hexA}/${hexB} ${condition}: ΔE ${delta.toFixed(2)}`);
			}
		}
		expect(
			failures,
			`${theme}: Paare unter ΔE ${DELTA_E_MIN} (schlechtestes: ${worst.label} mit ΔE ${worst.delta.toFixed(2)})`,
		).toEqual([]);
	});
});

describe('pillarPalette — AK3: Neon-Charakter bewahrt (Spec #1273)', () => {
	it('Dark: jede Farbe mit HSL-Sättigung ≥ 0.7 und Lightness ≥ 0.5 (volle Leuchtkraft)', () => {
		const failures = pillarTokens.dark
			.map((hex) => ({ hex, hsl: rgbToHsl(hexToRgb(hex)) }))
			.filter(({ hsl }) => hsl[1] < 0.7 || hsl[2] < 0.5)
			.map(({ hex, hsl }) => `${hex}: S ${hsl[1].toFixed(2)}, L ${hsl[2].toFixed(2)}`);
		expect(failures, `Dark-Farben ohne volle Neon-Leuchtkraft: ${failures.join(', ')}`).toEqual([]);
	});

	it('Light: jede Farbe hält den Hue des Dark-Gegenstücks (± 15°, zirkular)', () => {
		const failures = pillarTokens.light
			.map((hex, index) => ({
				hex,
				distance: hueDistance(rgbToHsl(hexToRgb(hex))[0], rgbToHsl(hexToRgb(pillarTokens.dark[index]))[0]),
			}))
			.filter(({ distance }) => distance > 15)
			.map(({ hex, distance }) => `${hex}: ${distance.toFixed(1)}° vom Dark-Gegenstück`);
		expect(failures, `Light-Farben mit verlorenem Hue: ${failures.join(', ')}`).toEqual([]);
	});
});
