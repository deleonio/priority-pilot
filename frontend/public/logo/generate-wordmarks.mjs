#!/usr/bin/env node
/**
 * Erzeugt die Wortmarken-Assets aus logo.png + Schriftzug "Balamentum" (#1741):
 * - logo-with-name.vertical.png / .horizontal.png (Raster, transparent, AK1)
 * - logo-with-name.vertical.svg (Vektor-Text mit currentColor für Dark-Mode-taugliche
 *   Einbindung über <img>, AK2; Marke als eingebettetes, verkleinertes Raster-PNG)
 * - proofs/wordmark-light.png + -dark.png (Kontrast-Nachweis AK2 auf beiden surface-0)
 *
 * Die Marke wird wie in icons/generate-icons-linux.mjs per Chroma-Key von ihrer
 * Creme-Fläche befreit (PNG-Helfer von dort kopiert, das Skript läuft dort beim
 * Import los); Text rendert Chromium (Playwright-Cache), da sharp/rsvg hier fehlen.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const WORD = 'Balamentum';
const INK = '#12161d'; // --pp-ink (Light); SVG nutzt currentColor und erbt beide Themes

// ── PNG-Helfer (Kopie aus ../icons/generate-icons-linux.mjs) ─────────────────

function paethPredictor(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a),
		pb = Math.abs(p - b),
		pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function readPng(filePath) {
	const buf = readFileSync(filePath);
	let offset = 8,
		width = 0,
		height = 0,
		colorType = 0;
	const idatChunks = [];
	while (offset < buf.length - 4) {
		const len = buf.readUInt32BE(offset);
		const type = buf.toString('ascii', offset + 4, offset + 8);
		const data = buf.subarray(offset + 8, offset + 8 + len);
		offset += 12 + len;
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			colorType = data[9];
		} else if (type === 'IDAT') idatChunks.push(Buffer.from(data));
		else if (type === 'IEND') break;
	}
	const channels = colorType === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idatChunks));
	const stride = 1 + width * channels;
	const pixels = Buffer.alloc(width * height * channels, 0);
	for (let y = 0; y < height; y++) {
		const ft = raw[y * stride];
		for (let x = 0; x < width; x++) {
			for (let c = 0; c < channels; c++) {
				const rb = raw[y * stride + 1 + x * channels + c];
				const di = (y * width + x) * channels + c;
				const l = x > 0 ? pixels[di - channels] : 0;
				const u = y > 0 ? pixels[di - width * channels] : 0;
				const ul = x > 0 && y > 0 ? pixels[di - width * channels - channels] : 0;
				let v;
				switch (ft) {
					case 0:
						v = rb;
						break;
					case 1:
						v = (rb + l) & 0xff;
						break;
					case 2:
						v = (rb + u) & 0xff;
						break;
					case 3:
						v = (rb + Math.floor((l + u) / 2)) & 0xff;
						break;
					case 4:
						v = (rb + paethPredictor(l, u, ul)) & 0xff;
						break;
					default:
						throw new Error(`Unknown PNG filter type ${ft}`);
				}
				pixels[di] = v;
			}
		}
	}
	return { width, height, channels, pixels };
}

function crc32(buf) {
	let c = ~0;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

function makeChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeB = Buffer.from(type, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
	return Buffer.concat([len, typeB, data, crc]);
}

function writePng(pixels, width, height, hasAlpha) {
	const channels = hasAlpha ? 4 : 3;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = hasAlpha ? 6 : 2;
	const rawData = Buffer.alloc(height * (1 + width * channels));
	for (let y = 0; y < height; y++) {
		rawData[y * (1 + width * channels)] = 0;
		for (let x = 0; x < width; x++) {
			const si = (y * width + x) * channels;
			const di = y * (1 + width * channels) + 1 + x * channels;
			for (let c = 0; c < channels; c++) rawData[di + c] = pixels[si + c];
		}
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		makeChunk('IHDR', ihdr),
		makeChunk('IDAT', deflateSync(rawData, { level: 6 })),
		makeChunk('IEND', Buffer.alloc(0)),
	]);
}

/** Cream threshold wie icons/generate-icons-linux.mjs: sehr helle, nahezu neutrale Pixel → transparent. */
function toRgbaWithChromaKey(src, srcChannels) {
	const n = src.length / srcChannels;
	const out = Buffer.alloc(n * 4);
	for (let i = 0; i < n; i++) {
		const r = src[i * srcChannels];
		const g = src[i * srcChannels + 1];
		const b = src[i * srcChannels + 2];
		const a = srcChannels === 4 ? src[i * srcChannels + 3] : 255;
		const isCream = r >= 230 && g >= 226 && b >= 222;
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = isCream ? 0 : a;
	}
	return out;
}

// ── Marke chroma-keyen (Creme → transparent), Ratio für <img>-höhen merken ────

const logo = readPng(resolve(__dirname, 'logo.png'));
const markPng = writePng(toRgbaWithChromaKey(logo.pixels, logo.channels), logo.width, logo.height, true);
const MARK_DATA_URI = `data:image/png;base64,${markPng.toString('base64')}`;
const MARK_RATIO = logo.width / logo.height; // 1698/1659 ≈ 1,024 (breiter als hoch)

/** SVG-Wortmarke: verkleinerte Marke (als eingebettetes Raster) über Schriftzug in currentColor. */
function wordmarkSvg(markDataUri) {
	// ViewBox 720×250: Marke 190px breit, Schrift 76px bold.
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 250" role="img">
	<image href="${markDataUri}" x="265" y="8" width="190" height="${Math.round(190 / MARK_RATIO)}"/>
	<text x="360" y="235" text-anchor="middle" fill="currentColor" font-family="Archivo, system-ui, sans-serif" font-weight="700" font-size="76" letter-spacing="1">${WORD}</text>
</svg>`;
}

/** HTML-Gerüst für die Raster-Wordmarks (transparent, Chromium rendert Anti-Alias-Alpha). */
function wordmarkHtml({ vertical }) {
	const layout = vertical
		? 'flex-direction: column; gap: 28px;'
		: 'flex-direction: row; align-items: center; gap: 40px;';
	const markSize = vertical ? 520 : 380;
	const fontSize = vertical ? 190 : 150;
	return `<!doctype html><html><body style="margin:0;background:transparent">
		<div id="wordmark" style="display:inline-flex;${layout}padding:24px;font-family:Archivo,system-ui,sans-serif">
			<img src="${MARK_DATA_URI}" width="${markSize}" height="${Math.round(markSize / MARK_RATIO)}"/>
			<span style="font-weight:700;font-size:${fontSize}px;letter-spacing:2px;color:${INK};line-height:1">${WORD}</span>
		</div>
	</body></html>`;
}

// ── Generierung ──────────────────────────────────────────────────────────────

const browser = await chromium.launch();
try {
	for (const vertical of [true, false]) {
		const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 2400, height: 1200 } });
		await page.setContent(wordmarkHtml({ vertical }));
		await page.locator('#wordmark').screenshot({
			omitBackground: true,
			path: resolve(__dirname, `logo-with-name.${vertical ? 'vertical' : 'horizontal'}.png`),
		});
		await page.close();
	}

	// Eingebettete Marke fürs SVG auf 420px Breite verkleinern (Buffer-Screenshot), sonst ~2,7 MB
	const markPage = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 600, height: 600 } });
	await markPage.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
		<img src="${MARK_DATA_URI}" width="420"/>
	</body></html>`);
	const markBuffer = await markPage.locator('img').screenshot({ omitBackground: true });
	await markPage.close();

	writeFileSync(
		resolve(__dirname, 'logo-with-name.vertical.svg'),
		wordmarkSvg(`data:image/png;base64,${markBuffer.toString('base64')}`),
	);

	// AK2-Nachweis: SVG (als <img>, wie LoginPage) auf surface-0 beider Themes
	mkdirSync(resolve(__dirname, 'proofs'), { recursive: true });
	for (const [name, bg, fg] of [
		['light', '#f7f8fa', '#12161d'],
		['dark', '#12161c', '#e6eaf0'],
	]) {
		const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
		await page.setContent(`<!doctype html><html><body style="margin:0;background:${bg};display:flex;justify-content:center;padding:24px">
			<img src="logo-with-name.vertical.svg" style="width:216px;color:${fg}"/>
		</body></html>`);
		await page.screenshot({ path: resolve(__dirname, 'proofs', `wordmark-${name}.png`) });
		await page.close();
	}
} finally {
	await browser.close();
}
console.log('Wortmarken erzeugt: 2× PNG, 1× SVG, 2× AK2-Proof');
