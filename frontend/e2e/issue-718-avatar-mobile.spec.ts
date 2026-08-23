import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #718 „Avatar im Header auf Mobile wiederherstellen (unter 48rem ausgeblendet)".
 *
 * Ziel: Der Avatar (`kol-avatar`) ist über alle Bildschirmgrößen sichtbar — auch auf schmalen Viewports
 * (< 768px / 48rem).
 *
 * Historie: Diese Tests waren **rot**, solange der Avatar mobil per CSS ausgeblendet war — #718 hob
 * das auf, die #865-Korrektur hält den Avatar endgültig auf jeder Breite. Der Klartextname ist seit
 * der #865-Korrektur ganz entfernt (auf allen Breiten, nicht nur mobil): `KolAvatar` steht direkt im
 * Header (`App.tsx`), ein Gruppierungs-Wrapper wie das frühere `.user-info` existiert nicht mehr, und
 * der Name lebt nur noch als `_label`/Accessible Name des Avatars weiter.
 *
 * Spec: docs/spec/issue-718.md
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
	 * Rot wäre er, wenn `app.css` den Avatar unter 48rem ausblendete — mobil misst er seit #965
	 * 2rem (32px), ab 48rem 1,25 × Toolbar-Höhe (`--pp-avatar-size`), Details siehe AK6 in
	 * `header-appearance.spec.ts` und app.css/#965.
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
