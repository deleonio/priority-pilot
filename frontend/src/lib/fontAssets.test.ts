// @vitest-environment node
/**
 * Rote Spec-Tests (#1513, docs/spec/issue-1513.md) — Archivo als primäre Schriftart.
 *
 * AK3 — kein externer Google-Fonts-Request, Archivo-Quelle liegt im eigenen Origin.
 * AK4 — Workbox-Precache schließt `woff2` explizit ein (sonst fehlt die Schrift offline).
 * AK5 — Typo-Skala (Basisgröße, Gewichte) bleibt unangetastet.
 *
 * Reine Text-/Konfigurationsguards ohne Browser — Muster wie
 * `frontend/src/components/UpdatePrompt.test.tsx` (Konfigurations-Guards 201-215).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, '../..');

const readSource = (relativePath: string): string => readFileSync(resolve(FRONTEND_ROOT, relativePath), 'utf-8');

describe('AK3 — Archivo selbst gehostet, kein Google-Fonts-CDN (#1513)', () => {
	it('app.css referenziert kein fonts.googleapis.com / fonts.gstatic.com', () => {
		const css = readSource('src/app.css');
		expect(css, 'app.css darf keinen Google-Fonts-Host referenzieren').not.toMatch(
			/fonts\.googleapis\.com|fonts\.gstatic\.com/,
		);
	});

	it('main.tsx referenziert kein fonts.googleapis.com / fonts.gstatic.com und keinen @import url(https…)', () => {
		const mainTsx = readSource('src/main.tsx');
		expect(mainTsx, 'main.tsx darf keinen Google-Fonts-Host referenzieren').not.toMatch(
			/fonts\.googleapis\.com|fonts\.gstatic\.com/,
		);
		expect(mainTsx, 'main.tsx darf keinen externen CSS-Import via https laden').not.toMatch(/@import\s+url\(https/);
	});

	it('Archivo wird aus einer lokalen Quelle geladen (npm-Paket-Import oder lokale @font-face-Datei)', () => {
		const mainTsx = readSource('src/main.tsx');
		const css = readSource('src/app.css');
		const hasFontsourceImport = /@fontsource\/archivo/.test(mainTsx);
		const hasLocalFontFace = /@font-face/.test(css) && /archivo/i.test(css) && !/https:\/\//.test(css);
		expect(
			hasFontsourceImport || hasLocalFontFace,
			'weder ein @fontsource/archivo-Import in main.tsx noch eine lokale @font-face-Regel für Archivo in app.css gefunden',
		).toBe(true);
	});
});

describe('AK4 — Workbox precacht woff2-Schriftdateien (#1513)', () => {
	it('vite.config.ts setzt workbox.globPatterns explizit inklusive woff2', () => {
		const viteConfig = readSource('vite.config.ts');
		const globPatternsMatch = viteConfig.match(/globPatterns:\s*\[([^\]]*)\]/);
		expect(globPatternsMatch, 'vite.config.ts muss workbox.globPatterns explizit setzen').not.toBeNull();
		const globPatternsSource = globPatternsMatch?.[1] ?? '';
		expect(globPatternsSource, 'workbox.globPatterns muss woff2 enthalten, sonst fehlt die Schrift offline').toMatch(
			/woff2/,
		);
	});
});

describe('AK5 — Typo-Skala bleibt unverändert (#1513)', () => {
	it('app.css behält --pp-font-size-base: 1rem, --pp-weight-regular: 400 und --pp-weight-bold: 600', () => {
		const css = readSource('src/app.css');
		expect(css, '--pp-font-size-base muss weiterhin 1rem sein').toMatch(/--pp-font-size-base:\s*1rem/);
		expect(css, '--pp-weight-regular muss weiterhin 400 sein').toMatch(/--pp-weight-regular:\s*400/);
		expect(css, '--pp-weight-bold muss weiterhin 600 sein').toMatch(/--pp-weight-bold:\s*600/);
	});
});
