#!/usr/bin/env node
/**
 * Icon generation for Linux/CI using only Node.js built-ins.
 * Replaces the macOS-only generate-icons.sh for CI environments.
 *
 * AK1: any-icons + favicons → transparent background (alpha=0 at corners)
 * AK2: maskable + apple-touch → opaque white background (alpha=255, RGB≈255)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ICONS_DIR = __dirname;
const PUBLIC_DIR = resolve(__dirname, '..');
const LOGO_PATH = resolve(PUBLIC_DIR, 'logo/logo.png');

// ── PNG reader ──────────────────────────────────────────────────────────────

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
		} else if (type === 'IDAT') {
			idatChunks.push(Buffer.from(data));
		} else if (type === 'IEND') break;
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
	return { width, height, channels, colorType, pixels };
}

// ── PNG writer ───────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[i] = c;
	}
	return t;
})();

function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
	const lenBuf = Buffer.alloc(4);
	lenBuf.writeUInt32BE(data.length);
	const typeBuf = Buffer.from(type, 'ascii');
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
	return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng(pixels, width, height, hasAlpha) {
	const channels = hasAlpha ? 4 : 3;
	const colorType = hasAlpha ? 6 : 2;

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = colorType;

	const rawData = Buffer.alloc(height * (1 + width * channels));
	for (let y = 0; y < height; y++) {
		rawData[y * (1 + width * channels)] = 0; // filter: None
		for (let x = 0; x < width; x++) {
			const si = (y * width + x) * channels;
			const di = y * (1 + width * channels) + 1 + x * channels;
			for (let c = 0; c < channels; c++) rawData[di + c] = pixels[si + c];
		}
	}

	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	return Buffer.concat([
		sig,
		makeChunk('IHDR', ihdr),
		makeChunk('IDAT', deflateSync(rawData, { level: 6 })),
		makeChunk('IEND', Buffer.alloc(0)),
	]);
}

// ── Image operations ─────────────────────────────────────────────────────────

/** Nearest-neighbor scale; input/output are RGBA (4 channels). */
function scale(pixels, srcW, srcH, dstW, dstH) {
	const out = Buffer.alloc(dstW * dstH * 4);
	for (let y = 0; y < dstH; y++) {
		for (let x = 0; x < dstW; x++) {
			const sx = Math.min(Math.floor((x * srcW) / dstW), srcW - 1);
			const sy = Math.min(Math.floor((y * srcH) / dstH), srcH - 1);
			const si = (sy * srcW + sx) * 4;
			const di = (y * dstW + x) * 4;
			out[di] = pixels[si];
			out[di + 1] = pixels[si + 1];
			out[di + 2] = pixels[si + 2];
			out[di + 3] = pixels[si + 3];
		}
	}
	return out;
}

/**
 * Convert source pixels to RGBA, applying chroma key on cream background.
 * Cream: R >= 230 AND G >= 228 AND B >= 226 (covers #FEFAF6 ≈ 254,250,246 and its
 * antialiasing variants) while preserving the colored motif (orange, red, etc.).
 */
function toRgbaWithChromaKey(src, srcChannels) {
	const n = src.length / srcChannels;
	const out = Buffer.alloc(n * 4);
	for (let i = 0; i < n; i++) {
		const r = src[i * srcChannels];
		const g = src[i * srcChannels + 1];
		const b = src[i * srcChannels + 2];
		const a = srcChannels === 4 ? src[i * srcChannels + 3] : 255;
		// Cream threshold: very light, nearly neutral pixels → transparent
		const isCream = r >= 230 && g >= 226 && b >= 222;
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = isCream ? 0 : a;
	}
	return out;
}

/** Composite RGBA pixels over opaque white background → RGBA fully opaque. */
function compositeOnWhite(pixels, n) {
	const out = Buffer.alloc(n * 4);
	for (let i = 0; i < n; i++) {
		const r = pixels[i * 4],
			g = pixels[i * 4 + 1],
			b = pixels[i * 4 + 2];
		const a = pixels[i * 4 + 3] / 255;
		out[i * 4] = Math.round(r * a + 255 * (1 - a));
		out[i * 4 + 1] = Math.round(g * a + 255 * (1 - a));
		out[i * 4 + 2] = Math.round(b * a + 255 * (1 - a));
		out[i * 4 + 3] = 255;
	}
	return out;
}

/** Center the `inner` image (innerW×innerH) on a white canvas of outerW×outerH. */
function padOnWhite(inner, innerW, innerH, outerW, outerH) {
	const out = Buffer.alloc(outerW * outerH * 4, 0);
	// Fill with white
	for (let i = 0; i < outerW * outerH; i++) {
		out[i * 4] = 255;
		out[i * 4 + 1] = 255;
		out[i * 4 + 2] = 255;
		out[i * 4 + 3] = 255;
	}
	const offX = Math.floor((outerW - innerW) / 2);
	const offY = Math.floor((outerH - innerH) / 2);
	for (let y = 0; y < innerH; y++) {
		for (let x = 0; x < innerW; x++) {
			const si = (y * innerW + x) * 4;
			const di = ((y + offY) * outerW + (x + offX)) * 4;
			// Composite inner pixel over white
			const a = inner[si + 3] / 255;
			out[di] = Math.round(inner[si] * a + 255 * (1 - a));
			out[di + 1] = Math.round(inner[si + 1] * a + 255 * (1 - a));
			out[di + 2] = Math.round(inner[si + 2] * a + 255 * (1 - a));
			out[di + 3] = 255;
		}
	}
	return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Reading logo.png …');
const logo = readPng(LOGO_PATH);

// Convert source to RGBA with cream chroma key → transparent background
const logoRgba = toRgbaWithChromaKey(logo.pixels, logo.channels);

// Center crop to 1400×1400 from 2048×2048
const CROP = 1400;
const offX = Math.floor((logo.width - CROP) / 2);
const offY = Math.floor((logo.height - CROP) / 2);
const cropped = Buffer.alloc(CROP * CROP * 4);
for (let y = 0; y < CROP; y++) {
	for (let x = 0; x < CROP; x++) {
		const si = ((y + offY) * logo.width + (x + offX)) * 4;
		const di = (y * CROP + x) * 4;
		cropped[di] = logoRgba[si];
		cropped[di + 1] = logoRgba[si + 1];
		cropped[di + 2] = logoRgba[si + 2];
		cropped[di + 3] = logoRgba[si + 3];
	}
}

// AK1 — any-purpose icons + favicons: transparent background
const anySpecs = [
	{ w: 512, h: 512, out: resolve(ICONS_DIR, 'icon-512x512.png') },
	{ w: 192, h: 192, out: resolve(ICONS_DIR, 'icon-192x192.png') },
	{ w: 32, h: 32, out: resolve(PUBLIC_DIR, 'favicon-32x32.png') },
	{ w: 16, h: 16, out: resolve(PUBLIC_DIR, 'favicon-16x16.png') },
];
for (const { w, h, out } of anySpecs) {
	const scaled = scale(cropped, CROP, CROP, w, h);
	writeFileSync(out, writePng(scaled, w, h, true));
	console.log(`  ✓ ${out.split('/').pop()} (${w}×${h}, transparent)`);
}

// AK2 — maskable icons + apple-touch: white background, motif at ≈70% (safe zone)
const maskableSpecs = [
	{ outer: 512, inner: Math.round(512 * 0.7), out: resolve(ICONS_DIR, 'icon-512x512-maskable.png') },
	{ outer: 192, inner: Math.round(192 * 0.7), out: resolve(ICONS_DIR, 'icon-192x192-maskable.png') },
	{ outer: 180, inner: Math.round(180 * 0.7), out: resolve(PUBLIC_DIR, 'apple-touch-icon.png') },
];
for (const { outer, inner, out } of maskableSpecs) {
	const motif = scale(cropped, CROP, CROP, inner, inner);
	const motifOnWhite = compositeOnWhite(motif, inner * inner);
	const padded = padOnWhite(motifOnWhite, inner, inner, outer, outer);
	writeFileSync(out, writePng(padded, outer, outer, true));
	console.log(`  ✓ ${out.split('/').pop()} (${outer}×${outer}, white bg, motif=${inner}px)`);
}

console.log('Done.');
