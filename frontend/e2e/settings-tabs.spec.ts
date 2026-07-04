import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #271 „Settings-Seite: Tabs Allgemein + Säulen" (Stufe 1 TDD, der einklagbare
 * Vertrag).
 *
 * Ziel des Tickets: Die Settings-Seite (aus #270, `/settings/pillars`) bekommt eine `KolTabs`-
 * Navigation mit zwei Tabs — **Allgemein** (vorerst leerer Platzhalter) und **Säulen** (hostet den
 * Säulen-Gewichtungs-Editor). Routing: `/settings/pillars` → Säulen-Tab aktiv,
 * `/settings/general` → Allgemein-Tab aktiv.
 *
 * Diese Tests sind bewusst **rot**, bis der Produktivcode existiert: `SettingsPage.tsx` mit `KolTabs`
 * fehlt noch, ebenso die Route `/settings/general`. Die Tests navigieren direkt per `page.goto()`,
 * weil die Zahnrad-Navigation (#270) unabhängig davon bereits existiert.
 *
 * Sie prüfen reines UI-Verhalten gegen das echte Backend (kein API-Mock); `/auth/me` wird durch die
 * Fixture authentifiziert, damit die Auth-Gate durchlässig ist.
 */
test.describe('#271 Settings-Seite: Tabs Allgemein + Säulen', () => {
	/**
	 * AK1 — Tabs vorhanden: Auf der Settings-Seite sind zwei Tabs sichtbar — „Allgemein" und
	 * „Säulen". KolTabs rendert Tabs mit role="tab" in einer role="tablist".
	 */
	test('AK1: Settings-Seite zeigt zwei Tabs „Allgemein" und „Säulen"', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();
	});

	/**
	 * AK2 — Säulen-Tab zeigt Editor: Wenn der Säulen-Tab aktiv ist (Default auf
	 * `/settings/pillars`), wird der Säulen-Gewichtungs-Editor angezeigt. Der Editor enthält
	 * Eingabefelder für die Säulen-Gewichtungen (wie bisher via #270 bekannt).
	 */
	test('AK2: Säulen-Tab zeigt den Säulen-Gewichtungs-Editor', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		// Der Säulen-Tab ist aktiv — der Editor ist sichtbar.
		const pillarsTab = page.getByRole('tab', { name: 'Säulen', exact: true });
		await expect(pillarsTab).toHaveAttribute('aria-selected', 'true');

		// Der Editor enthält mindestens ein Eingabefeld für Säulen-Gewichtungen (range/number).
		await expect(page.getByRole('slider').or(page.getByRole('spinbutton')).first()).toBeVisible();
	});

	/**
	 * AK3 — Tab-Wechsel: Wenn der Säulen-Tab aktiv ist und auf „Allgemein" geklickt wird,
	 * wechselt die Anzeige zum Allgemein-Tab (Platzhalter sichtbar), der Säulen-Editor
	 * verschwindet.
	 */
	test('AK3: Klick auf „Allgemein"-Tab blendet Säulen-Editor aus und zeigt Allgemein-Inhalt', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		// Ausgangszustand: Säulen-Tab aktiv, Editor sichtbar.
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Klick auf „Allgemein".
		await page.getByRole('tab', { name: 'Allgemein', exact: true }).click();

		// Allgemein-Tab ist jetzt aktiv.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Der Allgemein-Tabpanel ist sichtbar (Platzhalter).
		await expect(page.getByRole('tabpanel')).toBeVisible();

		// Der Säulen-Editor ist nicht mehr sichtbar (ausgeblendet oder aus DOM entfernt).
		await expect(page.getByRole('slider').or(page.getByRole('spinbutton')).first()).toBeHidden();
	});

	/**
	 * AK4 — Route ↔ Tab: Die URL bestimmt den aktiven Tab beim initialen Laden.
	 * `/settings/general` aktiviert den Allgemein-Tab; `/settings/pillars` aktiviert den Säulen-Tab.
	 */
	test('AK4a: Route /settings/general aktiviert den Allgemein-Tab', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page);

		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	test('AK4b: Route /settings/pillars aktiviert den Säulen-Tab', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	/**
	 * AK5 — Mobile-First (375px): Auf einem 375px-Viewport verursacht die Settings-Seite
	 * mit Tabs kein horizontales Scrollen; beide Tabs sind sichtbar und bedienbar.
	 * Muster: login.spec.ts AK5 / task-tree.spec.ts AK-6.
	 */
	test('AK5: Settings-Tabs verursachen kein horizontales Scrollen bei 375px (Mobile-First)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		// Beide Tabs müssen auf dem schmalen Viewport sichtbar und bedienbar sein.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Kein horizontaler Überlauf: Das Settings-Root-Element ragt nicht über die Viewport-Breite.
		const overflowsHorizontally = await page.evaluate(() => {
			// Prüfe das body-Element und document.documentElement auf horizontalen Überlauf.
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
