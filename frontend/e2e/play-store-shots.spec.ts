import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { seedShowcase, shootShowcase } from './shots-seed';

/**
 * **Kein Prüf-Spec, sondern ein Bildmacher** (Muster: `landing-shots.spec.ts`) für den Google-Play-Eintrag
 * (`docs/marketing/play-store/`). Play verlangt exakt 9:16 bzw. 16:9, daher je Gerät ein eigener
 * Viewport; dazu die Vorstellungsgrafik (1024 × 500). Neu erzeugen nach sichtbaren UI-Änderungen:
 *
 * ```
 * SHOTS=1 pnpm exec playwright test e2e/play-store-shots.spec.ts
 * ```
 */

const OUT = '../docs/marketing/play-store';

/** CSS-Viewport × Faktor ergibt die Pixelmaße, die Play je Geräteklasse annimmt. */
const DEVICES = [
	{ id: 'phone', viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 }, // 1080 × 1920
	{ id: 'tablet-7', viewport: { width: 576, height: 1024 }, deviceScaleFactor: 2 }, // 1152 × 2048
	// Querformat für 10"-Tablet, Desktop und Android XR zugleich; 1920 CSS-Pixel machten die Schrift zu klein.
	{ id: 'landscape', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 }, // 1920 × 1080
];

test.describe('Play Store — Bilder des Store-Eintrags', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten (siehe Kopfkommentar).');

	for (const { id, viewport, deviceScaleFactor } of DEVICES) {
		test.describe(id, () => {
			test.use({ viewport, deviceScaleFactor });

			test('legt je Funktion einen Screenshot ab', async ({ page }) => {
				test.setTimeout(120_000);
				await seedShowcase(page, `play-store-${id}@example.com`);
				await shootShowcase(page, `${OUT}/${id}`);
			});
		});
	}

	test.describe('Vorstellungsgrafik', () => {
		test.use({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });

		test('legt die Vorstellungsgrafik ab', async ({ page }) => {
			const logo = readFileSync('public/logo/logo-with-name.horizontal.svg', 'utf8');
			const shot = readFileSync(`${OUT}/phone/dashboard.jpg`).toString('base64');
			await page.setContent(`
				<style>
					body { margin: 0; width: 1024px; height: 500px; display: flex; align-items: center; gap: 48px;
						padding: 0 64px; box-sizing: border-box; overflow: hidden; background: #f7f8fa;
						font-family: Archivo, system-ui, sans-serif; color: #12161d; }
					.text { flex: 1; } .text svg { width: 420px; height: auto; display: block; }
					h1 { font-size: 40px; line-height: 1.15; margin: 32px 0 0; color: #1b3a6b; }
					img { width: 260px; margin-top: 140px; border-radius: 24px; box-shadow: 0 12px 40px rgb(20 44 82 / 0.25); }
				</style>
				<div class="text">${logo}<h1>Woran solltest du als Nächstes arbeiten?</h1></div>
				<img src="data:image/jpeg;base64,${shot}" alt="">`);
			await page.waitForTimeout(500);
			await page.screenshot({ path: `${OUT}/feature-graphic.png` });
		});
	});
});
