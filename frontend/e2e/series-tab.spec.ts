import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests (Stufe 1 TDD, der einklagbare Vertrag) für #335
 * „Serien-Verwaltung als eigenen Tab statt Modal anbieten".
 *
 * Ziel des Tickets: Die Serien-Verwaltung wird aus dem `SeriesManagementModal` (Einstieg über den
 * Header-Button „Serien verwalten") herausgelöst und als eigener Tab „Serien" neben „Aufgaben"
 * angeboten. Der Tab zeigt die Serien im TaskTree-Stil (`series-tree` als Wurzelcontainer,
 * `series-tree-item-<id>` je Serie) mit einer Aktions-Toolbar (Bearbeiten/Löschen). „Bearbeiten"
 * öffnet weiterhin `TaskForm` im Serie-Modus (Modal; der Umschalter ist im Bearbeiten-Modus ausgeblendet, #334),
 * „Löschen" entfernt die Serie. „Fällige Instanzen generieren" bleibt im Serien-Tab funktional.
 *
 * Wie `crud.spec.ts` / `series.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB,
 * Vite-Proxy). Nichts wird gemockt außer der Auth-Gate (siehe `fixtures.ts`). Diese Tests sind
 * **rot**, bis der Serien-Tab (`series-tree`, `series-tree-item-<id>`) implementiert und der
 * Header-Button „Serien verwalten" plus das `SeriesManagementModal` abgelöst sind.
 *
 * **Isolation:** `afterEach` räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien
 * über die echte API wieder ab, damit jeder Test vom definierten, leeren Zustand startet.
 */
test.describe('Priority Pilot — #335: Serien-Verwaltung als eigener Tab', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #335 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	interface SeriesPayload {
		title: string;
		rhythm?: 'daily' | 'weekly' | 'monthly';
		priority?: number;
		estimatedEffort?: number;
		active?: boolean;
		startDate: string;
	}

	/** Legt eine Serie direkt über die echte API an und gibt ihre `id` zurück. */
	const createSeriesViaApi = async (page: Page, payload: SeriesPayload): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				...payload,
			},
		});
		expect(response.ok()).toBeTruthy();
		const series = (await response.json()) as { id: number };
		return series.id;
	};

	/** Listet alle Tasks (inkl. generierter Instanzen) über die echte API. */
	const listTasksViaApi = async (page: Page): Promise<{ id: number }[]> => {
		const response = await page.request.get('/api/v1/tasks');
		expect(response.ok()).toBeTruthy();
		return (await response.json()) as { id: number }[];
	};

	/** Listet alle Serien über die echte API. */
	const listSeriesViaApi = async (page: Page): Promise<{ id: number; title: string }[]> => {
		const response = await page.request.get('/api/v1/series');
		expect(response.ok()).toBeTruthy();
		return (await response.json()) as { id: number; title: string }[];
	};

	/** Räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = await listTasksViaApi(page);
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = await listSeriesViaApi(page);
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	/**
	 * Öffnet den Serien-Tab (löst das alte Modal ab). Rot, solange der Tab „Serien" noch nicht existiert.
	 */
	const openSeriesTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
	};

	/** Der Wurzelcontainer des Serien-Baums. */
	const seriesTree = (page: Page) => page.getByTestId('series-tree');

	/** Der Listeneintrag einer Serie, verankert über `data-testid="series-tree-item-<id>"`. */
	const seriesItem = (page: Page, id: number) => page.getByTestId(`series-tree-item-${id}`);

	// AK1 — Serien-Tab existiert & ist erreichbar: Klick auf den Tab „Serien" zeigt den Serien-Baum.
	test('AK1 — Serien-Tab existiert und ist über die Tab-Leiste erreichbar', async ({ page }) => {
		const title = uniqueTitle('TabErreichbar');
		await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);

		// Der Tab „Serien" existiert und ist klickbar.
		const seriesTab = page.getByRole('tab', { name: 'Serien', exact: true });
		await expect(seriesTab).toBeVisible();
		await seriesTab.click();

		// Nach dem Klick ist der Serien-Baum sichtbar.
		await expect(seriesTree(page)).toBeVisible();
	});

	// AK2 — Zeile im TaskTree-Stil mit Aktions-Toolbar: Titel + Rhythmus-Badge und eine Toolbar mit
	// den Buttons „Bearbeiten" und „Löschen".
	test('AK2 — Serien-Zeile zeigt Titel + Rhythmus-Badge und eine Aktions-Toolbar (Bearbeiten/Löschen)', async ({
		page,
	}) => {
		const title = uniqueTitle('Zeile');
		const seriesId = await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		// Die Serien-Zeile ist über ihre ID verankert und trägt den Titel.
		const item = seriesItem(page, seriesId);
		await expect(item).toBeVisible();
		await expect(item).toContainText(title);

		// Rhythmus-Badge (wöchentlich) in der Zeile sichtbar.
		await expect(item.getByText(/wöchentlich|weekly/i).first()).toBeVisible();

		// Aktions-Toolbar mit Rolle „toolbar" und den Buttons „Bearbeiten" + „Löschen".
		const toolbar = item.getByRole('toolbar');
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Löschen' })).toBeVisible();
	});

	// AK3 — Bearbeiten öffnet TaskForm im Serie-Modus (Modal) & speichert: Switch ausgeblendet (#334),
	// Titel vorbefüllt; Speichern aktualisiert die Zeile.
	test('AK3 — „Bearbeiten" öffnet TaskForm im Serie-Modus mit vorbefülltem Titel; Speichern aktualisiert die Zeile', async ({
		page,
	}) => {
		const titleOld = uniqueTitle('BearbeitenAlt');
		const titleNew = uniqueTitle('BearbeitenNeu');
		const seriesId = await createSeriesViaApi(page, { title: titleOld, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		// „Bearbeiten" in der Aktions-Toolbar der Serie klicken.
		await seriesItem(page, seriesId).getByRole('button', { name: 'Bearbeiten' }).click();
		await waitForStableView(page);

		// TaskForm im Serie-Modus (Modal): Der Umschalter ist im Bearbeiten-Modus ausgeblendet (#334).
		await expect(page.getByTestId('mode-switch')).not.toBeAttached();

		// Titel ist vorbefüllt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(titleOld);

		// Titel ändern und speichern.
		await page.getByRole('textbox', { name: 'Titel' }).fill(titleNew);
		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
		// #553: Titel ist ein kaskadierbares Feld — der Speichern-Klick öffnet jetzt das
		// `ConfirmSeriesActionModal` („Änderungen übernehmen"). Dieser Test prüft das Bearbeiten,
		// nicht die Kaskade, deshalb den sicheren Default „Nein (nur Serie)" wählen (Template-only).
		await page.getByRole('button', { name: /^Nein/i }).click();
		await waitForStableView(page);

		// Die Zeile ist aktualisiert: neuer Titel sichtbar, alter nicht mehr.
		await expect(seriesItem(page, seriesId)).toContainText(titleNew);
		await expect(page.getByText(titleOld, { exact: true })).toBeHidden();

		// Persistenz gegenprüfen.
		const series = await listSeriesViaApi(page);
		expect(series.some((entry) => entry.title === titleNew)).toBeTruthy();
	});

	// AK4 — Löschen entfernt die Serie: Zeile verschwindet, API bestätigt die Löschung.
	test('AK4 — „Löschen" entfernt die Serie: Zeile verschwindet und die API bestätigt die Löschung', async ({
		page,
	}) => {
		const title = uniqueTitle('Loeschen');
		const seriesId = await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		const item = seriesItem(page, seriesId);
		await expect(item).toBeVisible();

		// „Löschen" in der Aktions-Toolbar klicken.
		await item.getByRole('button', { name: 'Löschen' }).click();
		await waitForStableView(page);

		// #553: Der Bestätigungsdialog besitzt jetzt drei Buttons (Ja/Nein/Abbrechen) statt
		// „Endgültig löschen". „Nein (nur Serie, …)" löscht die Serie ohne Kaskade (cascade=false).
		await page.getByRole('button', { name: /^Nein/i }).click();
		await waitForStableView(page);

		// Die Zeile verschwindet aus dem Serien-Baum.
		await expect(item).toBeHidden();

		// Backend-Vertrag gegenprüfen: die Serie ist tatsächlich gelöscht.
		const series = await listSeriesViaApi(page);
		expect(series.some((entry) => entry.id === seriesId)).toBeFalsy();
	});

	// AK5 — „Fällige Instanzen generieren" bleibt funktional: Der Button im Serien-Tab erzeugt Instanzen.
	test('AK5 — „Fällige Instanzen generieren" im Serien-Tab erzeugt fällige Instanzen', async ({ page }) => {
		const title = uniqueTitle('Generieren');
		// Serie mit Startdatum in der Vergangenheit → mehrere fällige Termine liegen bereit.
		await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-01-01T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		// Vorbedingung: noch keine Tasks materialisiert.
		expect((await listTasksViaApi(page)).length).toBe(0);

		const generateButton = page.getByRole('button', { name: /Fällige Instanzen generieren/i });
		await expect(generateButton).toBeVisible();
		await generateButton.click();

		// Nach dem Klick sind fällige Instanzen serverseitig materialisiert.
		await expect(async () => {
			expect((await listTasksViaApi(page)).length).toBeGreaterThan(0);
		}).toPass();
	});

	// AK7 — Serien-Tab auch bei 0 Aufgaben erreichbar: alle Tasks gelöscht, 1 Serie via API,
	// App öffnen, Serien-Tab klickbar, Serie sichtbar.
	test('AK7 — Serien-Tab ist auch bei 0 Aufgaben erreichbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Alle Tasks löschen → definierter Nullzustand (keine Aufgaben).
		for (const task of await listTasksViaApi(page)) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}

		// Genau eine Serie via API anlegen.
		const title = uniqueTitle('NullAufgaben');
		const seriesId = await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		// App neu öffnen: trotz 0 Aufgaben muss der Serien-Tab erreichbar sein.
		await page.goto('/');
		await waitForStableView(page);

		const seriesTab = page.getByRole('tab', { name: 'Serien', exact: true });
		await expect(seriesTab).toBeVisible();
		await seriesTab.click();

		// Der Serien-Baum und die angelegte Serie sind sichtbar.
		await expect(seriesTree(page)).toBeVisible();
		await expect(seriesItem(page, seriesId)).toBeVisible();
		await expect(seriesItem(page, seriesId)).toContainText(title);
	});

	// AK8 — Mobile-First 375px ohne horizontales Scrollen: Bei 375×812 kein horizontaler Overflow.
	test('AK8 — Serien-Tab verursacht keinen horizontalen Overflow bei 375×812', async ({ page }) => {
		const title = uniqueTitle('Mobile');
		await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-09-07T00:00:00.000Z' });

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		// Der Serien-Baum ist sichtbar.
		await expect(seriesTree(page)).toBeVisible();

		// Kein horizontaler Overflow des Dokuments.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);
	});
});
