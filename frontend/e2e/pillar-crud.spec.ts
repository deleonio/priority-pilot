import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';
import { TITLE_MAX_LENGTH } from '../src/lib/titleLengthValidation.ts';

/**
 * E2E-Spec-Tests für #439 „Säulen-Verwaltungs-UI im Einstellungen-Tab (anlegen/bearbeiten/löschen)".
 * Teil der Serie #425.
 *
 * Ziel des Tickets: Im Säulen-Tab der Settings-Seite eine Verwaltungs-Komponente, mit der Säulen
 * angelegt, bearbeitet und gelöscht werden können — jeweils über eigene Modal-Dialoge (KoliBri).
 *
 * Sie prüfen funktionales UI-Verhalten gegen das echte Backend (kein API-Mock);
 * `/auth/me` wird durch die Fixture authentifiziert.
 */
test.describe('#439 Säulen-Verwaltung — CRUD im Einstellungen-Tab', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen
	// und parallele/aufeinanderfolgende Läufe sich nicht stören. Maximal TITLE_MAX_LENGTH Zeichen:
	// Das Säulen-Formular kappt den Namen per nativem `maxlength` (#935) — auch bei Playwright
	// `fill()` —, längere Namen würden still gekappt und Assertions auf den vollen Namen scheitern.
	// Muster: `delete-dialog-focus.spec.ts` (uniqueTitle).
	let runId = 0;
	const uniqueName = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E-Pillar-${label}`.slice(0, TITLE_MAX_LENGTH - tail.length);
		return `${head}${tail}`;
	};

	/** Löscht alle Säulen (außer den Default-Säulen) über die echte API. */
	const deleteAllPillars = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number }[];
		for (const pillar of pillars) {
			await page.request.delete(`/api/v1/pillars/${pillar.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllPillars(page);
	});

	/** Öffnet den Säulen-Tab über die Settings-Route. */
	const openPillarTab = async (page: Page): Promise<void> => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
	};

	/**
	 * Legt eine Säule über die UI an: öffnet den Anlegen-Dialog, füllt Name (und optional
	 * Beschreibung) aus und klickt „Anlegen" im Dialog. Wartet, bis der Name in der Liste sichtbar ist.
	 */
	const createPillarViaUi = async (page: Page, name: string, description?: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
		if (description !== undefined) {
			await dialog.getByRole('textbox', { name: 'Beschreibung' }).fill(description);
		}
		await dialog.getByRole('button', { name: 'Anlegen' }).click();

		await expect(page.getByText(name, { exact: true })).toBeVisible();
	};

	/**
	 * AK1 — Säule anlegen: Im Säulen-Tab kann eine neue Säule mit Name (Pflicht) und Beschreibung
	 * (optional) angelegt werden. Nach dem Anlegen erscheint sie sofort in der Liste.
	 */
	test('AK1: Säule anlegen — erscheint sofort in der Liste', async ({ page }) => {
		await openPillarTab(page);

		const name = uniqueName('Anlegen');
		await createPillarViaUi(page, name, 'Test-Beschreibung');
	});

	/**
	 * AK1 (Zusatz): Anlegen ohne Beschreibung (nur Name) funktioniert ebenfalls.
	 */
	test('AK1: Säule ohne Beschreibung anlegen', async ({ page }) => {
		await openPillarTab(page);

		const name = uniqueName('OhneBeschreibung');
		await createPillarViaUi(page, name);
	});

	/**
	 * AK1 (Zusatz): Anlegen ohne Name zeigt Validierungsfehler an.
	 */
	test('AK1: Anlegen ohne Name zeigt Validierungsfehler', async ({ page }) => {
		await openPillarTab(page);

		// Anlegen-Dialog öffnen und ohne Namenseingabe absenden
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await waitForStableView(page, 'Priority Pilot');

		await page.locator('kol-dialog').getByRole('button', { name: 'Anlegen' }).click();

		// Ein Fehlerhinweis muss erscheinen.
		await expect(page.getByText(/name.*darf nicht leer/i)).toBeVisible();
	});

	/**
	 * AK2 — Umbenennen: Der Name einer Säule kann im Bearbeiten-Dialog geändert werden;
	 * der neue Name ist nach dem Speichern sichtbar und bleibt nach Reload erhalten.
	 */
	test('AK2: Säule umbenennen — neuer Name bleibt nach Reload', async ({ page }) => {
		// Zuerst eine Säule anlegen
		await openPillarTab(page);
		const originalName = uniqueName('Umbenennen-A');
		await createPillarViaUi(page, originalName);

		// Umbenennen: Bearbeiten-Dialog öffnen
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: 'Säule bearbeiten' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		const newName = uniqueName('Umbenennen-B');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(newName);
		await dialog.getByRole('button', { name: 'Speichern' }).click();

		// Neuer Name muss sichtbar sein
		await expect(page.getByText(newName, { exact: true })).toBeVisible();
		// Alter Name darf nicht mehr sichtbar sein
		await expect(page.getByText(originalName, { exact: true })).toHaveCount(0);

		// Reload: neuer Name persistiert
		await page.reload();
		await openPillarTab(page);
		await expect(page.getByText(newName, { exact: true })).toBeVisible();
	});

	/**
	 * AK2 (Zusatz): Beschreibung ändern — neue Beschreibung bleibt nach Reload erhalten.
	 */
	test('AK2: Beschreibung ändern — bleibt nach Reload', async ({ page }) => {
		await openPillarTab(page);
		const name = uniqueName('Beschreibung');
		await createPillarViaUi(page, name, 'Alt');

		// Beschreibung im Bearbeiten-Dialog ändern
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Beschreibung' }).fill('Neu');
		await dialog.getByRole('button', { name: 'Speichern' }).click();

		// Neue Beschreibung muss sichtbar sein (auf PillarList-Bereich scopen — PillarWeightsForm
		// zeigt dieselbe Beschreibung parallel im selben Tab und würde sonst eine strict-mode-
		// violation auslösen)
		await expect(page.locator('.pillar-list').getByText('Neu', { exact: true })).toBeVisible();

		// Reload
		await page.reload();
		await openPillarTab(page);
		await expect(page.locator('.pillar-list').getByText('Neu', { exact: true })).toBeVisible();
	});

	/**
	 * AK3 — Löschen mit Bestätigung: Löschen erfordert Bestätigung inkl. Hinweis auf betroffene
	 * Tasks/Serien. Auch die letzte Säule darf gelöscht werden.
	 */
	test('AK3: Löschen mit Bestätigung — Säule verschwindet aus der Liste', async ({ page }) => {
		await openPillarTab(page);
		const name = uniqueName('Löschen');
		await createPillarViaUi(page, name);

		// Löschen-Button klicken → Bestätigungsdialog öffnet sich
		await page.getByRole('button', { name: 'Löschen' }).first().click();

		// Der Bestätigungsdialog muss den Hinweistext enthalten
		await expect(page.getByText(/tasks.*serien.*zuordnung/i)).toBeVisible();

		// Bestätigen
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		// Säule darf nicht mehr sichtbar sein
		await expect(page.getByText(name, { exact: true })).toHaveCount(0);
	});

	/**
	 * AK3 (Zusatz): Auch die letzte Säule darf gelöscht werden — kein „letzte Säule geschützt"-Verhalten.
	 */
	test('AK3: Letzte Säule löschen — erlaubt', async ({ page }) => {
		await openPillarTab(page);
		const name = uniqueName('Letzte');
		await createPillarViaUi(page, name);

		// Auch als einzige Säule muss der Löschen-Button verfügbar sein.
		const deleteButton = page.getByRole('button', { name: 'Löschen' }).first();
		await expect(deleteButton).toBeEnabled();
		await deleteButton.click();

		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		// Keine Säulen mehr → Hinweis „Keine Säulen vorhanden" oder leere Liste
		await expect(page.getByText(name, { exact: true })).toHaveCount(0);
	});

	/**
	 * AK3 (Zusatz): Löschen abbrechen — Säule bleibt erhalten.
	 */
	test('AK3: Löschen abbrechen — Säule bleibt erhalten', async ({ page }) => {
		await openPillarTab(page);
		const name = uniqueName('Abbrechen');
		await createPillarViaUi(page, name);

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
		await page.getByRole('button', { name: 'Abbrechen' }).click();

		// Säule ist immer noch da
		await expect(page.getByText(name, { exact: true })).toBeVisible();
	});

	/**
	 * AK4 — Mobile-First: Auf einem 375-px-Viewport erzeugt der Säulen-Tab mit mehreren Säulen
	 * kein horizontales Scrollen.
	 */
	test('AK4: Mobile-First — kein horizontales Scrollen bei 375 px mit vielen Säulen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Mehrere Säulen anlegen, um eine breite Liste zu simulieren
		await openPillarTab(page);
		const names: string[] = [];
		for (let i = 0; i < 5; i++) {
			const name = uniqueName(`Mobile-${i}`);
			names.push(name);
			await createPillarViaUi(page, name);
		}

		// Kein horizontales Scrollen
		const hasNoHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(hasNoHorizontalOverflow).toBe(true);
	});

	/**
	 * AK1+Löschen: Vollständiger CRUD-Durchlauf — Anlegen → Umbenennen → Löschen.
	 */
	test('AK1+2+3: Vollständiger CRUD-Durchlauf (Anlegen → Umbenennen → Löschen)', async ({ page }) => {
		await openPillarTab(page);

		// 1. Anlegen
		const name = uniqueName('CRUD');
		await createPillarViaUi(page, name, 'CRUD-Beschreibung');

		// 2. Umbenennen
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		const renamed = `${name}-umbenannt`;
		await dialog.getByRole('textbox', { name: 'Name' }).fill(renamed);
		await dialog.getByRole('button', { name: 'Speichern' }).click();
		await expect(page.getByText(renamed, { exact: true })).toBeVisible();

		// 3. Löschen
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
	});
});
