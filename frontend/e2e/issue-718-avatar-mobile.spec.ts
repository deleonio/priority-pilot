import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #718 „Avatar im Header auf Mobile wiederherstellen (unter 48rem ausgeblendet)".
 *
 * Ziel: Der Avatar (`kol-avatar`) ist über alle Bildschirmgrößen sichtbar — auch auf schmalen Viewports
 * (< 768px / 48rem). Mobil darf ggf. nur der Klartextname entfallen, der Avatar selbst soll erhalten bleiben.
 *
 * Diese Tests waren **rot**, solange `frontend/src/app.css` den `.user-info` Block mobil komplett
 * ausblendet — seit #718 bleibt der Block sichtbar; unter 48rem ist nur der Klartextname
 * (`.user-display-name`) ausgeblendet, der Avatar selbst nicht. #787 gruppiert Avatar und Name
 * wieder gemeinsam in `.user-info` (#406).
 *
 * Spec: docs/spec/issue-718.md
 *
 * ⚠️ Test-Pflege-Bedarf: `frontend/e2e/header-appearance.spec.ts` AK6 (Zeile 232) erwartet aktuell,
 * dass `.user-info` auf 375px HIDDEN ist. Dieser Test muss nach Umsetzung von #718 ENTFERNT werden,
 * da er das neue Verhalten widerspiegelt (siehe Spec).
 */
test.describe('#718 Avatar auf Mobile wiederherstellen', () => {
	/** Toleranz für Rundungen der Layout-Engine (Sub-Pixel). */
	const TOLERANCE_PX = 2;

	/**
	 * Hilfsfunktion — Liest die Boundingboxen von Logo, Toolbar-Button und Avatar.
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
	 * AK1 — Avatar ist auf Mobile (< 48rem / 768px) sichtbar.
	 * Rot wäre er, wenn `app.css` `.user-info` unter 48rem komplett ausblendete — seit #718 bleibt
	 * der Avatar sichtbar, nur der Klartextname ist mobil weg.
	 */
	test('AK1: Avatar ist auf Mobile (< 48rem) sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const avatar = page.locator('header kol-avatar').first();
		await expect(avatar).toBeVisible();
	});

	/**
	 * AK2 — Avatar ist auf Tablet (48rem–64rem / 768px–1024px) sichtbar.
	 */
	test('AK2: Avatar ist auf Tablet (48rem–64rem) sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		await waitForStableView(page);

		const avatar = page.locator('header kol-avatar').first();
		await expect(avatar).toBeVisible();
	});

	/**
	 * AK3 — Avatar ist auf Desktop (> 64rem / 1024px) sichtbar.
	 */
	test('AK3: Avatar ist auf Desktop (> 64rem) sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const avatar = page.locator('header kol-avatar').first();
		await expect(avatar).toBeVisible();
	});

	/**
	 * AK4 — Header bleibt mobil einzeilig (kein Umbruch) bei 375px.
	 * RED, solange durch Avatar-Sichtbarkeit ein Umbruch entsteht.
	 */
	test('AK4: Header bleibt mobil einzeilig (kein Umbruch) bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const { header, logo, avatar } = await readHeaderBoxes(page);

		expect(
			header.height,
			`Header (${header.height}px) muss einzeilig bleiben — bei Umbruch wäre er ≥ Logo (${logo.height}px) + Avatar (${avatar.height}px)`,
		).toBeLessThan(logo.height + avatar.height);
	});

	/**
	 * AK5 — Header bleibt einzeilig bei Tablet (768px).
	 */
	test('AK5: Header bleibt einzeilig bei 768px', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		await waitForStableView(page);

		const { header, logo, avatar } = await readHeaderBoxes(page);

		expect(
			header.height,
			`Header (${header.height}px) muss einzeilig bleiben — bei Umbruch wäre er ≥ Logo (${logo.height}px) + Avatar (${avatar.height}px)`,
		).toBeLessThan(logo.height + avatar.height);
	});

	/**
	 * AK6 — Avatar = 1,25 × Toolbar-Button-Höhe (aus #485 AK3) bei Desktop.
	 * Stellt sicher, dass die bestehenden Avatar-Maße aus #485 weiterhin erfüllt sind.
	 */
	test('AK6: Avatar-Höhe beträgt das 1,25-Fache der Toolbar-Button-Höhe (bei 1280px)', async ({ page }) => {
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
	 * AK7 — Logo, Toolbar-Button und Avatar teilen sich eine Mittellinie (aus #485 AK4) bei Desktop.
	 * Stellt sicher, dass die bestehende Header-Konsistenz aus #485 weiterhin erfüllt ist.
	 */
	test('AK7: Logo, Toolbar-Button und Avatar teilen sich eine Mittellinie (≥768px)', async ({ page }) => {
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
});
