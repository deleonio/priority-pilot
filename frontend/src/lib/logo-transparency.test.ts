// @vitest-environment node
/**
 * Rote Spec-Tests (#402): Wort-Bildmarken mit transparentem Hintergrund.
 *
 * AK1 — logo-with-name.horizontal.png und logo-with-name.vertical.png:
 *        Eckpixel haben alpha ≈ 0 (transparent) — kein deckender Vanille-Hintergrund (#FEFAF6).
 *
 * Rot, bis der Vanille-Hintergrund per Chroma-Key entfernt und die PNGs neu eingecheckt wurden.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOGO_DIR = resolve(__dirname, '../../public/logo');

// ---------------------------------------------------------------------------
// Minimal PNG pixel reader — uses only node built-ins (same approach as #400)
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

function cornerPixels(img: PngImage) {
	return [
		img.getPixel(0, 0),
		img.getPixel(img.width - 1, 0),
		img.getPixel(0, img.height - 1),
		img.getPixel(img.width - 1, img.height - 1),
	];
}

// ---------------------------------------------------------------------------
// AK1 — Wortmarken: Eckpixel müssen transparent sein (alpha ≈ 0)
// ---------------------------------------------------------------------------

const WORDMARK_ASSETS = [
	{
		label: 'logo-with-name.horizontal.png',
		path: resolve(LOGO_DIR, 'logo-with-name.horizontal.png'),
	},
	{
		label: 'logo-with-name.vertical.png',
		path: resolve(LOGO_DIR, 'logo-with-name.vertical.png'),
	},
];

describe('AK1 — Wort-Bildmarken: transparenter Hintergrund (#402)', () => {
	for (const { label, path } of WORDMARK_ASSETS) {
		it(`${label}: ist eine RGBA-PNG (hat Alpha-Kanal)`, () => {
			const buf = readFileSync(path);
			// Byte 25 in einem PNG-Datei ist colorType im IHDR-Chunk (Offset 8+4+4+1+1 = 25)
			// Wir lesen colorType aus dem IHDR-Chunk: Offset 8 (sig) + 4 (len) + 4 (type) + 8 (w+h) + 1 (bitDepth) = 25
			const colorType = buf[25];
			expect(colorType, `${label}: colorType soll 6 (RGBA) sein, ist ${colorType} — PNG muss Alpha-Kanal haben`).toBe(
				6,
			);
		});

		it(`${label}: Eckpixel haben alpha ≈ 0 (kein Vanille-Hintergrund #FEFAF6)`, () => {
			const img = readPng(path);
			const corners = cornerPixels(img);
			for (const px of corners) {
				expect(
					px.a,
					`Eckpixel in ${label} soll transparent sein (alpha≈0), ist aber alpha=${px.a} — Vanille-Hintergrund noch vorhanden`,
				).toBeLessThanOrEqual(10);
			}
		});

		it(`${label}: kein einziger Pixel mit exaktem Creme-Farbton #FEFAF6 (254,250,246) mehr vorhanden`, () => {
			const img = readPng(path);
			let creamePixelCount = 0;
			for (let y = 0; y < img.height; y++) {
				for (let x = 0; x < img.width; x++) {
					const px = img.getPixel(x, y);
					// Vanille-Schwelle analog generate-icons-linux.mjs: r≥230 && g≥226 && b≥222 && alpha voll deckend
					if (px.r >= 230 && px.g >= 226 && px.b >= 222 && px.a > 200) {
						creamePixelCount++;
					}
				}
			}
			expect(
				creamePixelCount,
				`${label}: ${creamePixelCount} creme-farbige deckende Pixel gefunden — Chroma-Key noch nicht angewendet`,
			).toBe(0);
		});
	}
});
