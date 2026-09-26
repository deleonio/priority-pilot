#!/usr/bin/env node
/**
 * Erzeugt die Wortmarken-Assets "balamentum" (#1741, Variante "Waage"): Marke, Schriftzug in
 * Archivo 600 und darunter ein Balken im Farbverlauf der Marke.
 * - logo-with-name.horizontal.svg / .horizontal.dark.svg: Schrift als eingebettete Archivo,
 *   Tinte je Theme fest (--pp-ink hell/dunkel). Ein SVG in <img> erbt weder currentColor noch
 *   Web-Fonts der Seite, daher zwei Varianten und eingebettete Schrift.
 * - logo-with-name.vertical.png / .horizontal.png (Raster, transparent, helle Tinte)
 * - proofs/wordmark-light.png + -dark.png (Kontrast-Nachweis AK2 auf beiden surface-0)
 *
 * Marke: icons/icon-512x512.png (bereits freigestellt). Rendern übernimmt Chromium (Playwright);
 * weicht dessen Version vom Cache ab: CHROMIUM_PATH=/pfad/zu/chrome setzen.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const dir = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const WORD = 'balamentum';
const INK = { light: '#12161d', dark: '#e6eaf0' }; // --pp-ink je Theme (app.css)
const SURFACE = { light: '#f7f8fa', dark: '#12161c' }; // --pp-surface-0 je Theme
// Farben der Marke von links nach rechts: blau, grün, gelb, orange, rot
const BEAM = ['#4a9bd6', '#5fb87a', '#f6c33b', '#ef7a4b', '#e8553a'];

const font = readFileSync(require.resolve('@fontsource/archivo/files/archivo-latin-600-normal.woff2'));
const FONT_URI = `data:font/woff2;base64,${font.toString('base64')}`;
const MARK_PATH = resolve(dir, '../icons/icon-512x512.png');
const MARK_URI = `data:image/png;base64,${readFileSync(MARK_PATH).toString('base64')}`;

/** Horizontale Wortmarke als SVG; Maße aus der im Browser geladenen Schrift gemessen. */
function buildSvg({ ink, markUri, markRatio, fontUri, word, beam }) {
	const MARK = 104; // Markenhöhe; Breite folgt dem Seitenverhältnis
	const MARK_W = Math.round(MARK * markRatio);
	const PAD = 4; // Luft für Glyphen-Überhang rechts
	const GAP = 28;
	const FS = 84;
	const TRACK = -1.25; // -0.015em
	const BEAM_GAP = 14;
	const BEAM_H = 8;
	const ctx = document.createElement('canvas').getContext('2d');
	ctx.font = `600 ${FS}px Wm`;
	const ascent = Math.ceil(ctx.measureText(word).actualBoundingBoxAscent);
	const ns = 'http://www.w3.org/2000/svg';
	const probe = document.createElementNS(ns, 'svg');
	probe.innerHTML = `<text font-family="Wm" font-weight="600" font-size="${FS}" letter-spacing="${TRACK}">${word}</text>`;
	document.body.append(probe);
	const textW = Math.ceil(probe.querySelector('text').getComputedTextLength());
	probe.remove();
	// Schriftblock (Oberlänge bis Balkenunterkante) vertikal zur Marke zentrieren
	const block = ascent + BEAM_GAP + BEAM_H;
	const baseline = Math.round((MARK - block) / 2 + ascent);
	const x = MARK_W + GAP;
	const stops = beam.map((c, i) => `<stop offset="${i / (beam.length - 1)}" stop-color="${c}"/>`).join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + textW + PAD} ${MARK}" role="img" aria-label="Balamentum">
	<defs><style>@font-face{font-family:Wm;font-weight:600;src:url(${fontUri}) format("woff2")}</style><linearGradient id="beam">${stops}</linearGradient></defs>
	<image href="${markUri}" width="${MARK_W}" height="${MARK}"/>
	<text x="${x}" y="${baseline}" fill="${ink}" font-family="Wm, Archivo, system-ui, sans-serif" font-weight="600" font-size="${FS}" letter-spacing="${TRACK}" textLength="${textW}" lengthAdjust="spacing">${word}</text>
	<rect x="${x}" y="${baseline + BEAM_GAP}" width="${textW}" height="${BEAM_H}" rx="${BEAM_H / 2}" fill="url(#beam)"/>
</svg>`;
}

/** HTML-Gerüst für die Raster-Wortmarken (transparent). */
function lockupHtml(vertical, markUri) {
	const s = vertical ? 2.4 : 2; // Pixel je SVG-Einheit der Maße oben / 2
	const layout = vertical ? 'flex-direction:column;align-items:center;gap:40px' : 'align-items:center;gap:56px';
	return `<!doctype html><style>@font-face{font-family:Wm;font-weight:600;src:url(${FONT_URI})}</style>
	<body style="margin:0;background:transparent">
		<div id="wm" style="display:inline-flex;${layout};padding:24px">
			<img src="${markUri}" style="height:${(vertical ? 128 : 104) * s}px">
			<span style="display:inline-flex;flex-direction:column;gap:${14 * s}px">
				<span style="font:600 ${84 * s}px/1 Wm;letter-spacing:-0.015em;color:${INK.light}">${WORD}</span>
				<span style="height:${8 * s}px;border-radius:${4 * s}px;background:linear-gradient(90deg,${BEAM.join(',')})"></span>
			</span>
		</div>
	</body>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
	const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } });
	const tmp = resolve(dir, '.wordmark.tmp.html');

	// file://-Seite, damit data:-Fonts und -Bilder sicher vor dem Rendern laden
	writeFileSync(tmp, `<!doctype html><style>@font-face{font-family:Wm;font-weight:600;src:url(${FONT_URI})}</style>`);
	await page.goto(pathToFileURL(tmp).href);
	await page.evaluate(() => document.fonts.load('600 84px Wm'));

	// Marke auf ihre deckenden Pixel zuschneiden (das Icon hat Innenrand) und fürs SVG
	// auf 2× der Markenhöhe als WebP verkleinern, sonst > 130 KB je Datei
	const mark = await page.evaluate(async (src) => {
		const img = new Image();
		img.src = src;
		await img.decode();
		const full = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
		const fctx = full.getContext('2d');
		fctx.drawImage(img, 0, 0);
		const { data } = fctx.getImageData(0, 0, img.width, img.height);
		let [x0, y0, x1, y1] = [img.width, img.height, 0, 0];
		for (let y = 0; y < img.height; y++)
			for (let x = 0; x < img.width; x++)
				if (data[(y * img.width + x) * 4 + 3] > 8) {
					[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
				}
		const [w, h] = [x1 - x0 + 1, y1 - y0 + 1];
		const crop = (height, type) => {
			const c = Object.assign(document.createElement('canvas'), { width: Math.round((height * w) / h), height });
			c.getContext('2d').drawImage(full, x0, y0, w, h, 0, 0, c.width, c.height);
			return c.toDataURL(type);
		};
		return { full: crop(h, 'image/png'), small: crop(208, 'image/webp'), ratio: w / h };
	}, MARK_URI);

	// Raster-Wortmarken
	for (const vertical of [true, false]) {
		writeFileSync(tmp, lockupHtml(vertical, mark.full));
		await page.goto(pathToFileURL(tmp).href);
		await page.evaluate(() => document.fonts.ready);
		await page.locator('#wm').screenshot({
			omitBackground: true,
			path: resolve(dir, `logo-with-name.${vertical ? 'vertical' : 'horizontal'}.png`),
		});
	}
	writeFileSync(tmp, `<!doctype html><style>@font-face{font-family:Wm;font-weight:600;src:url(${FONT_URI})}</style>`);
	await page.goto(pathToFileURL(tmp).href);
	await page.evaluate(() => document.fonts.load('600 84px Wm'));

	mkdirSync(resolve(dir, 'proofs'), { recursive: true });
	for (const theme of ['light', 'dark']) {
		const name = `logo-with-name.horizontal${theme === 'dark' ? '.dark' : ''}.svg`;
		const svg = await page.evaluate(buildSvg, {
			ink: INK[theme],
			markUri: mark.small,
			markRatio: mark.ratio,
			fontUri: FONT_URI,
			word: WORD,
			beam: BEAM,
		});
		writeFileSync(resolve(dir, name), svg);

		// AK2-Nachweis: SVG als <img> (wie LoginPage) auf surface-0 des Themes
		writeFileSync(
			tmp,
			`<!doctype html><body style="margin:0;background:${SURFACE[theme]};display:flex;align-items:center;justify-content:center;height:100vh"><img src="${name}" style="width:216px"></body>`,
		);
		await page.setViewportSize({ width: 360, height: 140 });
		await page.goto(pathToFileURL(tmp).href);
		await page.locator('img').evaluate((img) => img.decode());
		await page.screenshot({ path: resolve(dir, 'proofs', `wordmark-${theme}.png`) });
		await page.setViewportSize({ width: 2400, height: 1400 });
	}
	rmSync(tmp);
} finally {
	await browser.close();
}
console.log('Wortmarken erzeugt: 2× PNG, 2× SVG, 2× AK2-Proof');
