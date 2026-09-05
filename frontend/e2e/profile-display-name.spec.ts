import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1219 — Anzeigename selbst festlegen (Spec docs/spec/issue-1219.md).
 *
 * - AK7: Bei 375 px Breite ist das Feld „Anzeigename" in Einstellungen → Allgemein ohne
 *   horizontales Scrollen bedienbar (`scrollWidth <= window.innerWidth`).
 * - AK6 (Ende-zu-Ende-Hälfte): Nach dem Speichern zeigt die Kopfzeile neben dem Avatar den
 *   neuen Namen.
 *
 * Gegen das echte Backend im Dev-Pass-Through (Muster settings-tabs.spec.ts): dort bedient
 * `/profile` den gemeinsamen Entwicklungs-Nutzer, daher KEIN Login im Test.
 */

test.describe('Priority Pilot — #1219: Anzeigename', () => {
	test('AK7: 375px — Feld ohne horizontales Scrollen; nach dem Speichern trägt die Kopfzeile den neuen Namen', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Kein horizontales Scrollen auf Seitenebene (Messung nach vollständigem Aufbau):
		const geometry = await page.evaluate(() => ({
			scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
			innerWidth: window.innerWidth,
		}));
		expect(geometry.scrollWidth, 'Die Seite darf bei 375px nicht horizontal scrollen').toBeLessThanOrEqual(
			geometry.innerWidth,
		);

		// Feld vorhanden, sichtbar und bedienbar (Playwright pierct das offene Shadow-DOM):
		const nameInput = page.locator('kol-input-text[_label="Anzeigename"] input');
		await expect(nameInput, 'Feld „Anzeigename" fehlt').toBeVisible();
		const uniqueName = `E2E Name ${Date.now()}`;
		await nameInput.fill(uniqueName);

		const saveButton = page.locator('kol-button[_label="Anzeigename speichern"]');
		await expect(saveButton, 'Speichern-Button „Anzeigename speichern" fehlt').toBeVisible();
		await saveButton.click();

		// Die Kopfzeile (Avatar) zeigt den neuen Namen — Rot heute: es gibt kein Speichern.
		await expect(page.locator('.app-header__user')).toContainText(uniqueName, { timeout: 10_000 });
	});
});
