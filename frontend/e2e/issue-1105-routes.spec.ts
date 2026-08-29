import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1105 „App-Routes für alle Menüs (außer Dialoge)“ (Stufe 1 TDD, der
 * einklagbare Vertrag). Vertragsquelle: `docs/spec/issue-1105.md`.
 *
 * Ziel des Tickets: Alle Haupt-Menüs sind unter eindeutigen, browser-nativen URLs erreichbar
 * (React Router v6) — Browser-Back/Forward und Deep-Links funktionieren, der aktive Tab (und der
 * Settings-Tab) wird aus der URL abgeleitet, `/aufgaben` reagiert auf `?view=` und `?q=`.
 * Dialoge (Task-Dialog, Suche, Säulen-Berater) bleiben Modals und ändern die URL nicht.
 *
 * Diese Tests sind bewusst **rot**, bis der Produktivcode existiert: Heute gibt es nur die
 * Hand-strick-Navigation für `/hilfe` und `/settings/general` (pushState/popstate in `App.tsx`);
 * `/aufgaben`, `/serien`, `/wald` sind reine interne Tab-States ohne URL, Query-Parameter werden
 * ignoriert und Tab-Klicks ändern die URL nicht.
 *
 * Sie prüfen reines UI-Verhalten gegen das echte Backend (kein API-Mock, wie in `crud.spec.ts`);
 * `/auth/me` wird durch die Fixture authentifiziert, damit die Auth-Gate durchlässig ist.
 */
test.describe('#1105 App-Routes für alle Menüs', () => {
	/** Aktiv-Zustand eines Haupt-Tabs lesen (KoliBri rendert role="tab" mit aria-selected). */
	const mainTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

	/**
	 * AK1 — Alle 8 Routen rendern die zugehörige Ansicht bei direktem Aufruf (Deep-Link).
	 * `/hilfe` und `/settings/general` sind bereits durch `help.spec.ts` bzw.
	 * `settings-page.spec.ts` abgedeckt — hier die noch fehlenden fünf.
	 */
	for (const [route, tabName] of [
		['/aufgaben', 'Aufgaben'],
		['/serien', 'Serien'],
		['/wald', 'Wald'],
	] as const) {
		test(`AK1: Deep-Link ${route} öffnet die Ansicht „${tabName}“`, async ({ page }) => {
			await page.goto(route);
			await waitForStableView(page);

			await expect(mainTab(page, tabName)).toHaveAttribute('aria-selected', 'true');
			// Die anderen Haupt-Tabs sind nicht aktiv (kein stiller Fallback auf das Dashboard).
			for (const other of ['Dashboard', 'Aufgaben', 'Serien', 'Wald'].filter((n) => n !== tabName)) {
				await expect(mainTab(page, other)).toHaveAttribute('aria-selected', 'false');
			}
		});
	}

	// Dedup: Deep-Links auf die Settings-Panels sind bereits eingeklagt — `settings-page.spec.ts`
	// (AK3: `/settings/pillars` → Säulen-Tab aktiv) und `llm-settings.spec.ts` (`/settings/llm`
	// → KI-Provider-Panel-Inhalt sichtbar). Hier keine Doppeltests.

	/**
	 * AK2 — Menü-Navigation via Tabs ändert die URL; Back/Forward stellt Ansicht + URL wieder her.
	 */
	test('AK2: Tab-Klick ändert die URL, Back/Forward stellt die Ansicht wieder her', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await mainTab(page, 'Aufgaben').click();
		await expect(page).toHaveURL(/\/aufgaben$/);
		await expect(mainTab(page, 'Aufgaben')).toHaveAttribute('aria-selected', 'true');

		await mainTab(page, 'Serien').click();
		await expect(page).toHaveURL(/\/serien$/);

		// Back: vorherige Ansicht (Aufgaben) inkl. URL — ohne Reload.
		await page.goBack();
		await expect(page).toHaveURL(/\/aufgaben$/);
		await expect(mainTab(page, 'Aufgaben')).toHaveAttribute('aria-selected', 'true');
		await expect(mainTab(page, 'Serien')).toHaveAttribute('aria-selected', 'false');

		// Forward: wieder Serien.
		await page.goForward();
		await expect(page).toHaveURL(/\/serien$/);
		await expect(mainTab(page, 'Serien')).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK4 — Der aktive Tab ist reine Funktion der URL: bei Load (AK1) und bei URL-Wechsel
	 * (AK2) darf kein divergierender `activeTab`-State übrig bleiben.
	 */
	test('AK4: URL-Wechsel ohne Klick leitet den aktiven Tab ab (kein divergierender State)', async ({ page }) => {
		await page.goto('/wald');
		await waitForStableView(page);

		// SPA-seitige Navigation (History-API, wie React Router sie macht) — kein Reload.
		await page.evaluate(() => window.history.pushState({}, '', '/aufgaben'));
		await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));

		await expect(mainTab(page, 'Aufgaben')).toHaveAttribute('aria-selected', 'true');
		await expect(mainTab(page, 'Wald')).toHaveAttribute('aria-selected', 'false');
	});

	/**
	 * AK5 — `/aufgaben?view=done` steuert die Listenansicht, Suche setzt `?q=`,
	 * Back stellt den vorherigen Filterzustand wieder her.
	 */
	test('AK5: ?view=done und ?q= steuern Ansicht und Filter, Back stellt sie wieder her', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Arrangement: eine erledigte und eine offene Aufgabe erzeugen (Muster aus tasks-tab-filter.spec).
		const doneTitle = `1105-Erledigt-${Date.now()}`;
		const openTitle = `1105-Offen-${Date.now()}`;
		const createTask = async (title: string): Promise<void> => {
			await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await page.getByRole('button', { name: 'Überspringen' }).click();
			await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(title);
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		};
		await createTask(doneTitle);
		await createTask(openTitle);

		// Erste (älteste/oberste) Aufgabe im offenen Baum erledigen.
		await mainTab(page, 'Aufgaben').click();
		await page
			.getByRole('button', { name: /Weitere Aktionen/i })
			.first()
			.click();
		await page.getByRole('button', { name: 'Erledigt' }).first().click();
		await page.reload();
		await waitForStableView(page);

		// ?view=done öffnet direkt die erledigte Tabelle — ohne den Umschalter anzufassen.
		await page.goto('/aufgaben?view=done');
		await waitForStableView(page);
		await expect(page.getByRole('tab', { name: 'Aufgaben', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('checkbox', { name: /Erledigte Aufgaben/i })).toBeChecked();
		await expect(page.getByText(doneTitle, { exact: true }).first()).toBeVisible();
		await expect(page.getByText(openTitle, { exact: true }).first()).not.toBeVisible();

		// Suche anwenden → ?q= steht in der URL.
		const searchbox = page.getByRole('searchbox', { name: /suchen|filter|titel/i });
		await expect(searchbox).toBeVisible();
		await searchbox.fill('1105-Offen');
		await page.getByRole('button', { name: 'Filtern' }).click();
		await expect(page).toHaveURL(/\/aufgaben\?.*q=1105-Offen/);

		// Back: vorheriger Filterzustand (view=done ohne q) ist wieder hergestellt.
		await page.goBack();
		await expect(page).not.toHaveURL(/q=1105-Offen/);
		await expect(page.getByText(doneTitle, { exact: true }).first()).toBeVisible();
	});

	/**
	 * AK6 — Dialoge bleiben Modals: Öffnen/Schließen von Task-Dialog, Suche und Säulen-Berater
	 * ändert Pathname/Query nicht.
	 */
	test('AK6: Dialoge ändern die URL nicht', async ({ page }) => {
		for (const label of ['Neuen Task anlegen', 'Suche', 'Säulen-Berater']) {
			// Je Dialog frisch laden, damit Schließen-Mechanik (Escape/Abbrechen) keine Folge-Klicks blockiert.
			await page.goto('/');
			await waitForStableView(page);
			const urlBefore = page.url();

			await (await headerAction(page, label)).click();
			// Öffnen darf Pathname/Query nicht verändern (Dialog bleibt Modal, keine Route).
			expect(page.url(), `${label}: Öffnen ändert die URL`).toBe(urlBefore);

			// Schließen (Escape am nativen <dialog>) ebenso wenig.
			await page.keyboard.press('Escape');
			expect(page.url(), `${label}: Schließen ändert die URL`).toBe(urlBefore);
		}
	});

	/**
	 * AK8 — Mobile-first: alle Haupt-Routen sind bei 375 px ohne horizontalen Overflow nutzbar.
	 */
	test('AK8: Haupt-Routen ohne horizontalen Overflow bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });

		for (const route of ['/', '/aufgaben', '/serien', '/wald']) {
			await page.goto(route);
			await waitForStableView(page);

			// Navigation bleibt bedienbar (Tabs sichtbar), App-Shell + Tab-Leiste passen in den Viewport.
			const tabs = page.getByRole('tablist', { name: /Ansichten/ });
			await expect(tabs).toBeVisible();

			const [mainBox, tabsBox] = await Promise.all([page.locator('main.app').boundingBox(), tabs.boundingBox()]);
			expect(mainBox, `${route}: App-Shell muss eine Boundingbox haben`).not.toBeNull();
			expect(tabsBox, `${route}: Tab-Leiste muss eine Boundingbox haben`).not.toBeNull();
			expect(mainBox!.x + mainBox!.width, `${route}: App-Shell ragt über 375px hinaus`).toBeLessThanOrEqual(375);
			expect(tabsBox!.x, `${route}: Tab-Leiste beginnt im Viewport`).toBeGreaterThanOrEqual(0);
			expect(tabsBox!.x + tabsBox!.width, `${route}: Tab-Leiste ragt über 375px hinaus`).toBeLessThanOrEqual(375);
		}
	});
});
