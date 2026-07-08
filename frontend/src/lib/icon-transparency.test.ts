// @vitest-environment node
/**
 * Rote Spec-Tests (#400): App-Icons mit transparentem Hintergrund.
 *
 * AK1 — any-Icons + Favicons: Eckpixel haben alpha ≈ 0 (transparent).
 * AK2 — Maskable + Apple-Touch: Eckpixel sind vollständig deckend (alpha=255)
 *        und weiß (RGB≈255,255,255), NICHT creme (#FEFAF6 = 254,250,246).
 *
 * Rot bis generate-icons.sh angepasst + Icons neu erzeugt + committed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../public');

// ---------------------------------------------------------------------------
// Minimal PNG pixel reader — uses only node built-ins
// ---------------------------------------------------------------------------

interface PngImage {
	width: number;
	height: number;
	getPixel(x: number, y: number): { r: number; g: number; b: number; a: number };
}

function paethPredictor(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

function readPng(filePath: string): PngImage {
	const buf = readFileSync(filePath);

	const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	for (let i = 0; i < 8; i++) {
		if (buf[i] !== SIG[i]) throw new Error(`Not a valid PNG: ${filePath}`);
	}

	let offset = 8;
	let width = 0;
	let height = 0;
	let colorType = 0;
	const idatChunks: Buffer[] = [];

	while (offset < buf.length - 4) {
		const len = buf.readUInt32BE(offset);
		const type = buf.toString('ascii', offset + 4, offset + 8);
		const data = buf.subarray(offset + 8, offset + 8 + len);
		offset += 12 + len;

		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			// bitDepth = data[8] — assumed to be 8
			colorType = data[9];
		} else if (type === 'IDAT') {
			idatChunks.push(Buffer.from(data));
		} else if (type === 'IEND') {
			break;
		}
	}

	// Only colorType 6 (RGBA) and 2 (RGB) are needed here
	if (colorType !== 6 && colorType !== 2) {
		throw new Error(`Unsupported PNG color type ${colorType} in ${filePath}`);
	}
	const channels = colorType === 6 ? 4 : 3;
	const hasAlpha = colorType === 6;

	const raw = inflateSync(Buffer.concat(idatChunks));
	const stride = 1 + width * channels;
	const pixels = Buffer.alloc(width * height * channels, 0);

	for (let y = 0; y < height; y++) {
		const filterType = raw[y * stride];
		for (let x = 0; x < width; x++) {
			for (let c = 0; c < channels; c++) {
				const rawByte = raw[y * stride + 1 + x * channels + c];
				const dstIdx = (y * width + x) * channels + c;
				const left = x > 0 ? pixels[dstIdx - channels] : 0;
				const up = y > 0 ? pixels[dstIdx - width * channels] : 0;
				const upLeft = x > 0 && y > 0 ? pixels[dstIdx - width * channels - channels] : 0;

				let val: number;
				switch (filterType) {
					case 0:
						val = rawByte;
						break;
					case 1:
						val = (rawByte + left) & 0xff;
						break;
					case 2:
						val = (rawByte + up) & 0xff;
						break;
					case 3:
						val = (rawByte + Math.floor((left + up) / 2)) & 0xff;
						break;
					case 4:
						val = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
						break;
					default:
						throw new Error(`Unknown PNG filter type ${filterType}`);
				}
				pixels[dstIdx] = val;
			}
		}
	}

	return {
		width,
		height,
		getPixel(x: number, y: number) {
			const idx = (y * width + x) * channels;
			return {
				r: pixels[idx],
				g: pixels[idx + 1],
				b: pixels[idx + 2],
				a: hasAlpha ? pixels[idx + 3] : 255,
			};
		},
	};
}

// Checks multiple corner pixels of an image
function cornerPixels(img: PngImage) {
	return [
		img.getPixel(0, 0), // top-left
		img.getPixel(img.width - 1, 0), // top-right
		img.getPixel(0, img.height - 1), // bottom-left
		img.getPixel(img.width - 1, img.height - 1), // bottom-right
	];
}

// ---------------------------------------------------------------------------
// AK1 — any-Icons + Favicons: Eckpixel müssen transparent sein (alpha ≈ 0)
// ---------------------------------------------------------------------------

const ANY_ICONS = [
	{ label: 'icon-192x192.png', path: resolve(PUBLIC_DIR, 'icons/icon-192x192.png') },
	{ label: 'icon-512x512.png', path: resolve(PUBLIC_DIR, 'icons/icon-512x512.png') },
	{ label: 'favicon-16x16.png', path: resolve(PUBLIC_DIR, 'favicon-16x16.png') },
	{ label: 'favicon-32x32.png', path: resolve(PUBLIC_DIR, 'favicon-32x32.png') },
];

describe('AK1 — any-Icons + Favicons: transparenter Hintergrund', () => {
	for (const { label, path } of ANY_ICONS) {
		it(`${label}: Eckpixel haben alpha ≈ 0 (transparent)`, () => {
			const img = readPng(path);
			const corners = cornerPixels(img);
			for (const px of corners) {
				expect(px.a, `Eckpixel in ${label} soll transparent sein (alpha≈0), ist aber ${px.a}`).toBeLessThanOrEqual(10);
			}
		});
	}
});

// ---------------------------------------------------------------------------
// AK2 — Maskable + Apple-Touch: deckend weiß (alpha=255, RGB≈255,255,255)
// ---------------------------------------------------------------------------

const OPAQUE_ICONS = [
	{ label: 'icon-192x192-maskable.png', path: resolve(PUBLIC_DIR, 'icons/icon-192x192-maskable.png') },
	{ label: 'icon-512x512-maskable.png', path: resolve(PUBLIC_DIR, 'icons/icon-512x512-maskable.png') },
	{ label: 'apple-touch-icon.png', path: resolve(PUBLIC_DIR, 'apple-touch-icon.png') },
];

const WHITE_TOLERANCE = 5; // erlaubte Abweichung pro Kanal

describe('AK2 — Maskable + Apple-Touch: deckend weiß statt creme', () => {
	for (const { label, path } of OPAQUE_ICONS) {
		it(`${label}: Eckpixel sind vollständig deckend (alpha=255)`, () => {
			const img = readPng(path);
			const corners = cornerPixels(img);
			for (const px of corners) {
				expect(px.a, `${label}: alpha soll 255 sein, ist ${px.a}`).toBe(255);
			}
		});

		it(`${label}: Eckpixel sind weiß (RGB≈255) — nicht creme (#FEFAF6=254,250,246)`, () => {
			const img = readPng(path);
			const corners = cornerPixels(img);
			for (const px of corners) {
				expect(px.r, `${label}: R soll ≈255 sein, ist ${px.r}`).toBeGreaterThanOrEqual(255 - WHITE_TOLERANCE);
				expect(px.g, `${label}: G soll ≈255 sein, ist ${px.g}`).toBeGreaterThanOrEqual(255 - WHITE_TOLERANCE);
				expect(px.b, `${label}: B soll ≈255 sein, ist ${px.b}`).toBeGreaterThanOrEqual(255 - WHITE_TOLERANCE);
			}
		});
	}
});
