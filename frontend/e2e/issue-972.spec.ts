import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #972 „UI: LLM-Einstellungen — Layout vereinheitlichen & X-Icon im
 * Key-löschen-Button" (Spec-Phase: ausführbarer Vertrag aus docs/spec/issue-972.md).
 *
 * Ziel: Einheitliches Layout des LLM-Tabs auf Mobile und Desktop ohne horizontalen Overflow
 * (AK1/AK2) sowie ein sichtbares X-Icon mit erhaltenem 44×44px-Touch-Target (AK3/AK4).
 * Muster: issue-788.spec.ts (LLM-Tab-Anwahl, X-Button-Selektor) und
 * issue-727-range-inputs-layout.spec.ts (Viewport-Stufen, Overflow-Prüfung).
 */
test.describe('#972 LLM-Tab-Layout & X-Icon', () => {
	/**
	 * E2 (AK2, Spec): Mobile 375×667 — kein horizontaler Overflow des LLM-Tabs,
	 * Key-Eingabegruppe und Modell-Select füllen die verfügbare Breite.
	 */
	test('E2 (Mobile 375×667): kein horizontaler Overflow, Felder füllen die Breite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');
		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		const settings = page.locator('.settings-page');
		await expect(settings).toBeVisible();

		// Kein horizontales Scrollen des Tabs (WCAG 1.4.10 Reflow, Mobile-UI-Regel 3).
		const overflow = await settings.evaluate((el) => el.scrollWidth - el.clientWidth);
		expect(overflow).toBeLessThanOrEqual(1);

		// Key-Eingabegruppe nutzt die verfügbare Breite (±10 % Toleranz für Container-Padding).
		const group = page.locator('.llm-key-input-group').first();
		await expect(group).toBeVisible();
		const groupBox = await group.boundingBox();
		const settingsBox = await settings.boundingBox();
		expect(groupBox).not.toBeNull();
		expect(settingsBox).not.toBeNull();
		expect(groupBox!.width).toBeGreaterThanOrEqual(settingsBox!.width * 0.9);
	});

	/**
	 * E3 (AK3/AK4, Spec): Desktop 1280×800 — X-Button sichtbar mit Icon und ≥44×44px
	 * Touch-Target; „Speichern" vollständig im Viewport.
	 */
	test('E3 (Desktop 1280×800): X-Button-Icon sichtbar, Touch-Target ≥44px, Speichern im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');
		await page.getByRole('tab', { name: 'LLM', exact: true }).click();

		// Key eingeben, damit der X-Button erscheint (Muster: issue-788 TC1).
		const passwordInput = page.locator('input[type="password"]').first();
		await passwordInput.fill('e2e-key-972');
		const xButton = page.locator('button[aria-label="API-Key löschen"]').first();
		await expect(xButton).toBeVisible();

		// AK3: Im Button existiert ein Icon-Element mit messbarer, sichtbarer Größe —
		// ein unsichtbares Unicode-Zeichen hätte kein eigenes Bounding-Box.
		const icon = xButton.locator('kol-icon, svg, i[class*="kolicon"]').first();
		await expect(icon).toBeVisible();
		const iconBox = await icon.boundingBox();
		expect(iconBox).not.toBeNull();
		expect(iconBox!.width).toBeGreaterThan(0);
		expect(iconBox!.height).toBeGreaterThan(0);

		// AK4: Touch-Target des X-Buttons bleibt ≥44×44px (WCAG 2.5.5).
		const box = await xButton.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);

		// AK2 (Desktop): „Speichern" liegt vollständig im Viewport.
		const save = page.getByRole('button', { name: /Speichern/ }).first();
		await expect(save).toBeVisible();
		const saveBox = await save.boundingBox();
		expect(saveBox).not.toBeNull();
		expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(1280);
	});
});
