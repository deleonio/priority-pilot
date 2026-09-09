import { expect, test } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

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
	 * AK2 — Navigation per Klick (#382): Klick auf das Zahnrad navigiert zu `/settings/general`;
	 * der „Allgemein"-Tab ist aktiv (`aria-selected="true"`), „Säulen" ist inaktiv.
	 */
	test('AK2: Klick auf das Zahnrad navigiert zu /settings/general und aktiviert den Allgemein-Tab', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await toolbar.getByRole('button', { name: /Einstellungen/i }).click();

		// URL muss auf /settings/general wechseln (nicht mehr /settings/pillars — #382).
		await expect(page).toHaveURL(/\/settings\/general/);

		// „Allgemein"-Tab ist aktiv; „Säulen"-Tab ist inaktiv.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	/**
	 * AK3 — Direktaufruf/Reload der Route: Ein direkter `page.goto('/settings/pillars')` rendert die
	 * Settings-Seite (Säulen) — nicht das Dashboard. Die Route ist also beim Laden auflösbar (analog
	 * zur Hilfe-Route: pushState/popstate).
	 */
	test('AK3: Direktaufruf von /settings/pillars rendert die Settings-Seite', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Die Settings-Seite mit dem Säulen-Editor ist sichtbar (Dashboard-Inhalt wäre falsch).
		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();
	});

	/**
	 * AK5 — Speichern unverändert: Der Säulen-Editor auf der Seite `/settings/pillars` löst beim
	 * „Speichern" weiterhin einen `PUT /api/v1/pillars/weights`-Request aus (Speicherverhalten
	 * unverändert gegenüber dem bisherigen Modal).
	 */
	test('AK5: „Speichern" löst einen PUT /pillars/weights aus', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('heading', { name: /Säulen-Gewichtung/i })).toBeVisible();

		// Den Request VOR dem Klick registrieren, damit er nicht verpasst wird.
		const saveRequest = page.waitForRequest(
			(request) => request.url().includes('/pillars/weights') && request.method() === 'PUT',
		);
		await page.getByRole('button', { name: /Speichern/i }).click();
		await saveRequest;
	});

	/**
	 * AK6 — Mobile-First (#382): Auf einem 375-px-Viewport erzeugt `/settings/general` kein
	 * horizontales Scrollen; das Zahnrad navigiert auf `/settings/general` und der „Allgemein"-Tab
	 * ist aktiv.
	 */
	test('AK6: /settings/general auf 375 px – kein horizontales Scrollen, Allgemein-Tab aktiv', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		// Das Zahnrad ist auch auf schmalem Viewport erreichbar und bedienbar — dort über das
		// „⋮"-Menü der Kopf-Aktionen, das den Header auf 375px einzeilig hält.
		const gearButton = await headerAction(page, /Einstellungen/i);
		await expect(gearButton).toBeVisible();
		await gearButton.click();

		// URL muss /settings/general sein (nicht /settings/pillars — #382).
		await expect(page).toHaveURL(/\/settings\/general/);
		// Warten, bis die Tabs gerendert sind, damit die Breite valide gemessen wird.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		const hasNoHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(hasNoHorizontalOverflow).toBe(true);
	});
});

/**
 * ROTE Spec-Tests für #1320 „Einstellungen und Hilfe als normale Seite statt
 * Fullscreen-Overlay mit Zurück-Button" (Spec `docs/spec/issue-1320.md`).
 *
 * Der bisherige AK4-Test oben („Zurück-Button führt von /settings/pillars zurück zum
 * Dashboard") wurde entfernt — er widerspricht AK3 unten (kein „Zurück"-Button mehr)
 * und ist durch den AK5-Test hier ersetzt (Test-Pflege-Bedarf, PR-Body).
 */
test.describe('#1320 Einstellungen als normale Seite mit sichtbarem Header', () => {
	/** AK1 — Header (Banner, Toolbar, Avatar) bleibt auf /settings/general sichtbar. */
	test('AK1: Header mit Banner, Toolbar und Avatar ist auf /settings/general sichtbar', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('toolbar', { name: /Kopf-Aktionen/ })).toBeVisible();
		await expect(page.locator('kol-avatar')).toBeVisible();
	});

	/** AK3 — Kein Button mit dem zugänglichen Namen „Zurück" existiert mehr. */
	test('AK3: Kein „Zurück"-Button auf /settings/general', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toHaveCount(0);
	});

	/**
	 * AK5 — Der aktive Toolbar-Button „Einstellungen" schaltet zurück zur zuletzt aktiven
	 * Hauptansicht (hier: /aufgaben); ohne vorherige Hauptansicht (Kaltstart) ist das Ziel `/`.
	 */
	test('AK5: erneuter Klick auf „Einstellungen" führt zur vorherigen Hauptansicht zurück', async ({ page }) => {
		await page.goto('/aufgaben');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/settings\/general/);

		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/aufgaben$/);
	});

	test('AK5: Kaltstart auf /settings/general ohne vorherige Hauptansicht führt zu „/"', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/$/);
	});

	/** AK8 — Mobile-First (375px): Header und Seiteninhalt liegen vollständig im Viewport. */
	test('AK8: 375px — Header und Seiteninhalt ohne horizontale Überlagerung', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();
		const headerBox = await header.boundingBox();
		expect(headerBox, 'Header rendert messbar').not.toBeNull();
		expect(headerBox!.x + headerBox!.width, 'Header endet im Viewport').toBeLessThanOrEqual(375 + 1);

		const content = page.locator('.settings-tabs');
		await expect(content).toBeVisible();
		const contentBox = await content.boundingBox();
		expect(contentBox, 'Seiteninhalt rendert messbar').not.toBeNull();
		expect(contentBox!.x + contentBox!.width, 'Seiteninhalt endet im Viewport').toBeLessThanOrEqual(375 + 1);
	});
});
