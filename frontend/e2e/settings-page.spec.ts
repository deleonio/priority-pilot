import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #270 „Einstellungen: Popover durch Zahnrad-Toolbar-Button und Route
 * /settings/pillars ersetzen" (Stufe 1 TDD, der einklagbare Vertrag). Teil der Serie #269.
 *
 * Ziel des Tickets: Der bisherige `KolPopoverButton` „Einstellungen" **außerhalb** der Toolbar
 * „Kopf-Aktionen" wird ersetzt. NEU liegt ein icon-only Zahnrad-Button „Einstellungen"
 * **innerhalb** der Toolbar. Ein Klick navigiert — analog zur Hilfe-Route (#256, pushState/popstate,
 * kein React-Router) — zur neuen Route `/settings/pillars`. Dort erscheint eine eigene Settings-Seite,
 * die den Säulen-Gewichtungs-Editor (Überschrift „Säulen-Gewichtung") **direkt** rendert (kein Modal
 * mehr). Ein „Zurück"-Button führt zurück zum Dashboard (`/`). Das Speicherverhalten (PUT auf
 * `/api/v1/pillars/weights`) bleibt unverändert. Die Seite ist Mobile-First (kein horizontales
 * Scrollen bei 375 px).
 *
 * Diese Tests sind bewusst **rot**, bis der Produktivcode existiert: Der Zahnrad-Button in der Toolbar,
 * die Route `/settings/pillars`, die Settings-Seite mit dem Säulen-Editor und der Zurück-Button fehlen
 * aktuell. Der bestehende Test `AK4` in `header-toolbar.spec.ts` beschreibt das ALTE Verhalten (Popover
 * außerhalb der Toolbar) und wird durch diese Umsetzung selbst rot — die Tests hier beschreiben das
 * NEUE Soll-Verhalten.
 *
 * Sie prüfen reines UI-Verhalten gegen das echte Backend (kein API-Mock, wie in `crud.spec.ts`);
 * `/auth/me` wird durch die Fixture authentifiziert, damit die Auth-Gate durchlässig ist.
 */
test.describe('#270 Einstellungen – Zahnrad-Toolbar-Button und Route /settings/pillars', () => {
	/**
	 * AK1 — Zahnrad in der Toolbar, kein Popover: Die Toolbar „Kopf-Aktionen" enthält einen icon-only
	 * Button „Einstellungen" (Zahnrad, zugänglicher Name via `_label`). Es existiert kein zweiter
	 * „Einstellungen"-Button außerhalb der Toolbar — der bisherige `KolPopoverButton` ist ersetzt.
	 */
	test('AK1: Toolbar „Kopf-Aktionen" enthält den Einstellungs-Button, kein Popover mehr', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		// Der Zahnrad-Button liegt jetzt INNERHALB der Toolbar (icon-only, Name via aria-label „Einstellungen").
		await expect(toolbar.getByRole('button', { name: /Einstellungen/i })).toBeVisible();

		// Es darf keinen weiteren „Einstellungen"-Button außerhalb der Toolbar geben: seitenweit genau einer,
		// und dieser ist der in der Toolbar. Damit ist der alte Popover-Button entfernt.
		await expect(page.getByRole('button', { name: /Einstellungen/i })).toHaveCount(1);
	});

	/**
	 * AK2 — Navigation per Klick: Klick auf das Zahnrad navigiert zu `/settings/pillars`; die
	 * Settings-Seite mit dem Säulen-Editor (Überschrift „Säulen-Gewichtung") ist sichtbar.
	 */
	test('AK2: Klick auf das Zahnrad navigiert zu /settings/pillars und zeigt den Säulen-Editor', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await toolbar.getByRole('button', { name: /Einstellungen/i }).click();

		// URL muss auf die neue Settings-Route wechseln.
		await expect(page).toHaveURL(/\/settings\/pillars/);

		// Der Säulen-Editor wird direkt auf der Seite gerendert (kein Modal mehr).
		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();
	});

	/**
	 * AK3 — Direktaufruf/Reload der Route: Ein direkter `page.goto('/settings/pillars')` rendert die
	 * Settings-Seite (Säulen) — nicht das Dashboard. Die Route ist also beim Laden auflösbar (analog
	 * zur Hilfe-Route: pushState/popstate).
	 */
	test('AK3: Direktaufruf von /settings/pillars rendert die Settings-Seite', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		// Die Settings-Seite mit dem Säulen-Editor ist sichtbar (Dashboard-Inhalt wäre falsch).
		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();
	});

	/**
	 * AK4 — Zurück: Auf `/settings/pillars` gibt es einen „Zurück"-Button; ein Klick führt zurück zum
	 * Dashboard, die URL ist danach nicht mehr `/settings/pillars`.
	 */
	test('AK4: Zurück-Button führt von /settings/pillars zurück zum Dashboard', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();

		// Zurück-Button klicken.
		await page.getByRole('button', { name: /zurück/i }).click();

		// Die URL darf danach nicht mehr auf der Settings-Route liegen (zurück auf dem Dashboard).
		await expect(page).not.toHaveURL(/\/settings\/pillars/);
	});

	/**
	 * AK5 — Speichern unverändert: Der Säulen-Editor auf der Seite `/settings/pillars` löst beim
	 * „Speichern" weiterhin einen `PUT /api/v1/pillars/weights`-Request aus (Speicherverhalten
	 * unverändert gegenüber dem bisherigen Modal).
	 */
	test('AK5: „Speichern" löst einen PUT /pillars/weights aus', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();

		// Den Request VOR dem Klick registrieren, damit er nicht verpasst wird.
		const saveRequest = page.waitForRequest(
			(request) => request.url().includes('/pillars/weights') && request.method() === 'PUT',
		);
		await page.getByRole('button', { name: /Speichern/i }).click();
		await saveRequest;
	});

	/**
	 * AK6 — Mobile-First: Auf einem 375-px-Viewport erzeugt `/settings/pillars` kein horizontales
	 * Scrollen (`document.body.scrollWidth <= window.innerWidth`); das Zahnrad in der Toolbar bleibt
	 * sichtbar und bedienbar.
	 */
	test('AK6: /settings/pillars auf 375 px – kein horizontales Scrollen, Zahnrad bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		// Das Zahnrad ist auch auf schmalem Viewport in der Toolbar sichtbar und bedienbar.
		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		const gearButton = toolbar.getByRole('button', { name: /Einstellungen/i });
		await expect(gearButton).toBeVisible();
		await gearButton.click();

		await expect(page).toHaveURL(/\/settings\/pillars/);
		// Warten, bis der Editor gerendert ist, damit die Breite valide gemessen wird.
		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();

		const hasNoHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(hasNoHorizontalOverflow).toBe(true);
	});
});
