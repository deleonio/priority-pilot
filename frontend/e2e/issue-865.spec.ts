/**
 * ROTE Spec-Tests für #865 „Avatar und User Full Name entfernen"
 *
 * Ziel: Avatar und User Full Name werden aus dem Header entfernt, ohne Layout-Integrität zu beeinträchtigen.
 * Spec: docs/spec/issue-865.md
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('#865 Avatar und User Full Name entfernen', () => {
	/**
	 * Hilfsfunktion — Liest Header-Elemente und prüft Layout-Integrität
	 */
	async function readHeaderState(page: Page) {
		const header = page.locator('header').first();
		await expect(header).toBeVisible();

		const avatar = header.locator('kol-avatar').first();
		const displayName = header.locator('.user-display-name').first();
		const toolbar = header.locator('[role="toolbar"]').first();
		const logo = header.locator('img[alt*="Priority Pilot"], .logo').first();

		const [logoBox, buttonBox, toolbarBox] = await Promise.all([
			logo.boundingBox(),
			header.locator('button').first().boundingBox(),
			toolbar.boundingBox(),
		]);

		return {
			header,
			logoBox: logoBox!,
			buttonBox: buttonBox!,
			toolbarBox: toolbarBox!,
			avatar,
			displayName,
			toolbar,
			logo,
		};
	}

	/**
	 * AK1 — Avatar-Element ist nicht mehr im DOM vorhanden
	 * Spec-Referenz: docs/spec/issue-865.md → Schritt 2
	 */
	test('AK1: Avatar ist nicht mehr im DOM vorhanden (Desktop)', async ({ page }) => {
		await page.goto('/');

		const { avatar } = await readHeaderState(page);

		await expect(avatar).not.toBeVisible();
		await expect(avatar).toHaveCount(0);
	});

	/**
	 * AK2 — User Full Name ist nicht mehr im DOM vorhanden
	 * Spec-Referenz: docs/spec/issue-865.md → Schritt 3
	 */
	test('AK2: User Full Name ist nicht mehr im DOM vorhanden (Desktop)', async ({ page }) => {
		await page.goto('/');

		const { displayName } = await readHeaderState(page);

		await expect(displayName).not.toBeVisible();
		await expect(displayName).toHaveCount(0);
	});

	/**
	 * AK3 — Keine Leerräume im Layout nach Entfernung (Desktop)
	 * Spec-Referenz: docs/spec/issue-865.md → Schritt 4
	 */
	test('AK3: Keine Leerräume im Layout nach Entfernung (Desktop 1440px)', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 800 });
		await page.goto('/');

		const { header, toolbar, logo } = await readHeaderState(page);

		// Header ist einzeilig (kein Umbruch durch Avatar-Entfernung)
		const headerBox = await header.boundingBox();
		expect(headerBox).not.toBeNull();

		const logoBox = await logo.boundingBox();
		const toolbarBox = await toolbar.boundingBox();

		expect(headerBox!.height).toBeLessThan(logoBox!.height + toolbarBox!.height);

		// Toolbar-Aktionen sind weiterhin sichtbar und ≥44px
		await expect(toolbar).toBeVisible();
		const firstButton = toolbar.locator('button').first();
		const buttonBox = await firstButton.boundingBox();
		expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
	});

	/**
	 * AK4 — Avatar nicht auf Mobile vorhanden (375px)
	 * Spec-Referenz: docs/spec/issue-865.md → Randfälle
	 */
	test('AK4: Avatar ist nicht mehr auf Mobile vorhanden (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		const { avatar } = await readHeaderState(page);

		await expect(avatar).toHaveCount(0);
	});

	/**
	 * AK5 — Full Name nicht auf Tablet vorhanden (768px)
	 * Spec-Referenz: docs/spec/issue-865.md → Randfälle
	 */
	test('AK5: Full Name ist nicht mehr auf Tablet vorhanden (768px)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');

		const { displayName } = await readHeaderState(page);

		await expect(displayName).toHaveCount(0);
	});

	/**
	 * AK6 — Keine console.error nach Entfernung
	 * Spec-Referenz: docs/spec/issue-865.md → Erwartetes Ergebnis
	 */
	test('AK6: Keine console.error oder console.warning nach Entfernung', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error' || msg.type() === 'warning') {
				errors.push(msg.text());
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		expect(errors).toHaveLength(0);
	});

	/**
	 * AK7 — Toolbar-Aktionen bleiben über Tab-Fokus erreichbar
	 * Spec-Referenz: docs/spec/issue-865.md → UX-Referenz
	 */
	test('AK7: Toolbar-Aktionen bleiben über Tab-Fokus erreichbar (Screenreader)', async ({ page }) => {
		await page.goto('/');

		const toolbar = page.locator('[role="toolbar"]').first();
		await expect(toolbar).toBeVisible();

		// Tab-Taste drücken, um durch Toolbar zu navigieren
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		const focusedElement = page.locator(':focus');
		await expect(focusedElement).toBeVisible();
		expect(await focusedElement.evaluate((el) => el.tagName)).toBe('BUTTON');
	});
});
