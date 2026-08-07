import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #222 „Gestalte den App-Header homogener".
 *
 * Reines Styling/Layout → visuelle Verifikation für AK2 (Avatar-Größe) und AK4 (Light/Dark-Mode)
 * ist im Browser nötig; automatisierte Tests decken nur den strukturell prüfbaren AK1 ab.
 *
 * Fixture (`./fixtures`) mockt `/auth/me` mit { name: 'Test User', email: 'test@example.com' }.
 *
 * AK2 (Avatar kleiner) und AK4 (Light/Dark konsistent) werden manuell visuell verifiziert;
 * ein Screenshot-Diff-Tool (z. B. Playwright visual comparisons) könnte später ergänzt werden.
 */
test.describe('#222 App-Header — Homogenität', () => {
	/**
	 * AK1: Die E-Mail-Adresse ist im App-Header nicht mehr sichtbar.
	 */
	test('AK1: E-Mail-Adresse ist im App-Header nicht sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Die gemockte E-Mail darf nicht mehr im DOM vorhanden sein (Element entfernt, nicht nur versteckt).
		await expect(page.getByText('test@example.com')).not.toBeAttached();
	});

	/**
	 * AK3 (Smoke): Der kol-avatar im Header hat das _label-Attribut mit dem Benutzernamen gesetzt.
	 * Bereits implementiert via `_label={user.name}` — bleibt als Regressions-Smoke grün.
	 */
	test('AK3 (Smoke): kol-avatar im Header hat _label mit Benutzernamen', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const avatar = page.locator('header kol-avatar').first();
		await expect(avatar).toBeVisible();
		await expect(avatar).toHaveAttribute('_label', 'Test User');
	});
});

// ---------------------------------------------------------------------------
// Rote Spec-Tests für #485 — Avatar-Größe, gemeinsame Ebene, kompakter Header
// ---------------------------------------------------------------------------

/**
 * ROTE Spec-Tests für #485 „Header-Optimierung: Icon-Only-Logo, kleinerer Avatar, alles auf eine
 * Ebene" — Teil Maße/Layout (AK3–AK6). AK1 (Icon-Logo) steht in `header-logo.spec.ts`.
 *
 * Ziel: Der Avatar misst das 1,25-Fache der Toolbar-Button-Höhe; Logo, Toolbar-Buttons und Avatar
 * liegen auf einer gemeinsamen Mittellinie in einer einzigen Header-Zeile; das Logo treibt die
 * Header-Höhe nicht mehr über den Avatar hinaus.
 *
 * Diese Tests sind **rot**, solange `app.css` den Avatar fix auf `2rem` und die Logo-Höhe auf
 * `clamp(2.5rem, 6vw, 4rem)` setzt.
 *
 * ⚠️ Test-Pflege-Bedarf: „#406 AK3" (`header-logo.spec.ts`, Zeile ~221) fordert eine mit dem
 * Viewport wachsende Logo-Höhe > 40px — das widerspricht AK5 (Logo-Höhe ≤ Avatar-Höhe). Der alte
 * Test bleibt bewusst unverändert (siehe PR-Body).
 */
test.describe('#485 Header — Avatar-Größe, gemeinsame Ebene, kompakte Höhe', () => {
	/** Toleranz für Rundungen der Layout-Engine (Sub-Pixel). */
	const TOLERANCE_PX = 2;

	/**
	 * Liest die Boundingboxen der drei Header-Bausteine: Logo-Bild, erster Toolbar-Button
	 * („Neuen Task anlegen") und Avatar.
	 */
	const readHeaderBoxes = async (page: Page) => {
		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const toolbarBtn = header.getByRole('toolbar', { name: /Kopf-Aktionen/i }).getByRole('button', {
			name: 'Neuen Task anlegen',
		});
		const avatar = header.locator('kol-avatar').first();

		await expect(logoImg).toBeVisible();
		await expect(toolbarBtn).toBeVisible();
		await expect(avatar).toBeVisible();

		const [headerBox, logoBox, buttonBox, avatarBox] = await Promise.all([
			header.boundingBox(),
			logoImg.boundingBox(),
			toolbarBtn.boundingBox(),
			avatar.boundingBox(),
		]);

		expect(headerBox, 'Header muss eine Boundingbox haben').not.toBeNull();
		expect(logoBox, 'Logo-Bild muss eine Boundingbox haben').not.toBeNull();
		expect(buttonBox, 'Toolbar-Button muss eine Boundingbox haben').not.toBeNull();
		expect(avatarBox, 'Avatar muss eine Boundingbox haben').not.toBeNull();

		return { header: headerBox!, logo: logoBox!, button: buttonBox!, avatar: avatarBox! };
	};

	/**
	 * AK3 — Avatar = 1,25 × Toolbar-Button-Höhe (Toleranz ±2px).
	 * RED, solange `--kol-avatar-size` fix auf 2rem (32px) steht.
	 */
	test('AK3: Avatar-Höhe beträgt das 1,25-Fache der Toolbar-Button-Höhe', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { button, avatar } = await readHeaderBoxes(page);

		const expected = button.height * 1.25;
		expect(
			Math.abs(avatar.height - expected),
			`Avatar (${avatar.height}px) soll 1,25 × Toolbar-Button-Höhe (${button.height}px → ${expected}px) sein`,
		).toBeLessThanOrEqual(TOLERANCE_PX);
	});

	/**
	 * AK3 (Ergänzung) — Der Avatar bleibt quadratisch: Breite und Höhe stimmen überein.
	 * Verhindert, dass die geforderte Höhe über ein Verzerren der Grafik erreicht wird.
	 */
	test('AK3: Avatar bleibt quadratisch (Breite = Höhe)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { avatar } = await readHeaderBoxes(page);

		expect(
			Math.abs(avatar.width - avatar.height),
			`Avatar soll quadratisch sein (${avatar.width}×${avatar.height})`,
		).toBeLessThanOrEqual(TOLERANCE_PX);
	});

	/**
	 * AK4 — Alles auf einer Ebene: Die vertikalen Mittelpunkte von Logo, Toolbar-Button und Avatar
	 * liegen bei ≥768px auf einer Linie (≤2px Abweichung).
	 */
	test('AK4: Logo, Toolbar-Button und Avatar teilen sich eine Mittellinie (≥768px)', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { logo, button, avatar } = await readHeaderBoxes(page);

		const centerOf = (box: { y: number; height: number }): number => box.y + box.height / 2;
		const centers = [centerOf(logo), centerOf(button), centerOf(avatar)];
		const spread = Math.max(...centers) - Math.min(...centers);

		expect(
			spread,
			`Mittelpunkte (Logo ${centers[0]}, Button ${centers[1]}, Avatar ${centers[2]}) dürfen höchstens ${TOLERANCE_PX}px auseinanderliegen`,
		).toBeLessThanOrEqual(TOLERANCE_PX);
	});

	/**
	 * AK4 — Header bleibt einzeilig: Die Header-Höhe unterschreitet die Summe zweier Zeilen
	 * (Logo + Avatar). Bei einem Umbruch (flex-wrap) wäre sie mindestens so hoch wie beide zusammen.
	 */
	test('AK4: Header bleibt einzeilig (kein Umbruch) bei 1024px', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { header, logo, avatar } = await readHeaderBoxes(page);

		expect(
			header.height,
			`Header (${header.height}px) muss einzeilig bleiben — bei Umbruch wäre er ≥ Logo (${logo.height}px) + Avatar (${avatar.height}px)`,
		).toBeLessThan(logo.height + avatar.height);
	});

	/**
	 * AK5 — Kompakter Header: Das Logo treibt die Header-Höhe nicht mehr über den Avatar hinaus.
	 * RED, solange die Logo-Höhe `clamp(2.5rem, 6vw, 4rem)` (bis 64px) den Avatar überragt.
	 */
	test('AK5: Logo-Höhe ist nicht größer als die Avatar-Höhe', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { logo, avatar } = await readHeaderBoxes(page);

		expect(
			logo.height,
			`Logo (${logo.height}px) darf den Avatar (${avatar.height}px) nicht überragen`,
		).toBeLessThanOrEqual(avatar.height + TOLERANCE_PX);
	});

	/**
	 * AK6 — Mobile-First (375px): Alle Header-Bausteine bleiben sichtbar und bedienbar; das
	 * Größenverhältnis Avatar/Toolbar-Button gilt auch hier.
	 *
	 * Hinweis: Die reine Overflow-Prüfung (`scrollWidth <= clientWidth`) ist bereits durch
	 * `header-logo.spec.ts` (#395 AK5 / #406 AK5) abgedeckt und wird hier nicht dupliziert.
	 */
	test('AK6: Header-Elemente bleiben bei 375px sichtbar und bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const { button, avatar } = await readHeaderBoxes(page);

		// Größenverhältnis gilt auch mobil.
		const expected = button.height * 1.25;
		expect(
			Math.abs(avatar.height - expected),
			`Avatar (${avatar.height}px) soll auch bei 375px 1,25 × Button-Höhe (${expected}px) sein`,
		).toBeLessThanOrEqual(TOLERANCE_PX);

		// Bedienbar: Der Logo-Button reagiert weiterhin auf einen Klick (Dashboard-Tab aktiv).
		await page
			.getByRole('banner')
			.getByRole('button', { name: /Zum Dashboard/i })
			.click();
		await expect(page.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute('aria-selected', 'true');
	});
});
