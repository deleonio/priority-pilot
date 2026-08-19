/**
 * ROTE Spec-Tests für #865 „User Full Name entfernen (Avatar behalten)"
 *
 * Ziel: Nur User Full Name wird aus dem Header entfernt, Avatar bleibt bestehen, ohne Layout-Integrität zu beeinträchtigen.
 * Spec: docs/spec/issue-865.md
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('#865 User Full Name entfernen (Avatar behalten)', () => {
	/**
	 * Hilfsfunktion — Liest Header-Elemente und prüft Layout-Integrität
	 */
	async function readHeaderState(page: Page) {
		const header = page.locator('header').first();
		await expect(header).toBeVisible();

		const avatar = header.locator('kol-avatar').first();
		// Der Klartextname ist seit der #865-Korrektur ganz entfernt — eine `.user-display-name`-Klasse
		// existiert im Light-DOM nicht mehr, ein Klassen-Locator wäre tote Diagnose (matcht nie).
		// Geprüft wird deshalb auf den Namen als Text (`fixtures.ts`: displayName 'Test User'): Käme der
		// Full Name mit anderem Markup zurück, fiele dieser Check rot. Der Name lebt bewusst weiter als
		// `_label`/Accessible Name des Avatars (kein Text-Knoten).
		const displayName = header.getByText('Test User', { exact: true });
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
	 * AK1 — Avatar-Element ist sichtbar (wiederhergestellt per Korrektur)
	 * Spec-Referenz: docs/spec/issue-865.md → Schritt 2
	 */
	test('AK1: Avatar ist sichtbar (Desktop)', async ({ page }) => {
		await page.goto('/');

		const { avatar, header } = await readHeaderState(page);

		await expect(avatar).toBeVisible();
		await expect(header.locator('kol-avatar')).toHaveCount(1);
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
	 * AK3 — Keine Leerräume im Layout mit Avatar (Desktop)
	 * Spec-Referenz: docs/spec/issue-865.md → Schritt 4
	 */
	test('AK3: Keine Leerräume im Layout mit Avatar (Desktop 1440px)', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 800 });
		await page.goto('/');

		const { header, toolbar, logo, avatar } = await readHeaderState(page);

		// Header ist einzeilig (kein Umbruch trotz Avatar)
		const headerBox = await header.boundingBox();
		expect(headerBox).not.toBeNull();

		const logoBox = await logo.boundingBox();
		const toolbarBox = await toolbar.boundingBox();

		expect(headerBox!.height).toBeLessThan(logoBox!.height + toolbarBox!.height);

		// Avatar ist sichtbar
		await expect(avatar).toBeVisible();

		// Toolbar-Aktionen sind weiterhin sichtbar und ≥44px
		await expect(toolbar).toBeVisible();
		const firstButton = toolbar.locator('button').first();
		const buttonBox = await firstButton.boundingBox();
		expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
	});

	/**
	 * AK4 — Avatar ist auf Mobile sichtbar (375px)
	 * Spec-Referenz: docs/spec/issue-865.md → Randfälle
	 */
	test('AK4: Avatar ist auf Mobile sichtbar (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		const { avatar, header } = await readHeaderState(page);

		await expect(avatar).toBeVisible();
		await expect(header.locator('kol-avatar')).toHaveCount(1);
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
				const text = msg.text();
				// Filter: Nur relevante Errors für Avatar-Entfernung (keine Backend-Probleme)
				if (!text.includes('Modell-Status')) {
					errors.push(text);
				}
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
