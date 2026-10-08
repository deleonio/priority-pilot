import { test } from '@playwright/test';
import { seedShowcase, shootShowcase } from './shots-seed';

/**
 * **Kein Prüf-Spec, sondern ein Bildmacher** (Muster: `zifferblatt-shots.spec.ts`). Er legt einen
 * Nutzer mit glaubwürdigen Beispieldaten an und fotografiert die Ansichten, die die Landingpage
 * zeigt, nach `website/public/shots/<id>.jpg` — die Dateinamen sind die Feature-Ids aus
 * `website/src/i18n/*.json`. Die Bilder werden eingecheckt; neu erzeugen nach sichtbaren UI-Änderungen:
 *
 * ```
 * SHOTS=1 pnpm exec playwright test e2e/landing-shots.spec.ts
 * ```
 *
 * Ohne `SHOTS` überspringt er sich (Begründung im Kopf von `zifferblatt-shots.spec.ts`).
 *
 * **Warum `POST /auth/register` vor dem Test-Login:** Nur die Registrierung legt die fünf Säulen des
 * Nutzers an; der Test-Login allein liefert einen Nutzer ohne Säulen und damit ein leeres Herz. Der
 * Test-Login danach macht ihn zum Admin, damit er sich selbst das größte Paket geben kann — sonst
 * zeigen die Bilder Paket-Sperren statt Funktionen.
 *
 * Nur deutsche Bilder: Die englische App ist noch nicht vollständig übersetzt, gemischte Screenshots
 * wirkten unfertiger als deutsche. Die englische Seite nutzt dieselben Bilder mit englischem Alt-Text.
 */

const OUT = '../website/public/shots';

test.describe('Landingpage — Bilder der Funktionen', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten (siehe Kopfkommentar).');
	test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });

	test('legt je Funktion einen Screenshot ab', async ({ page }) => {
		test.setTimeout(120_000);
		await seedShowcase(page, 'landing-shots@example.com');
		await shootShowcase(page, OUT);
	});
});
