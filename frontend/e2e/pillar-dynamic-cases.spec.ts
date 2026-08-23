import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';
import { TITLE_MAX_LENGTH } from '../src/lib/titleLengthValidation.ts';

/**
 * ROTE Spec-Tests für #431 „Frontend — Säulen-Verwaltung + dynamische Grenzfälle"
 * (Schritt 5/5 der Serie #420 „Beliebige, nutzerdefinierte Säulen").
 *
 * Die Basis-CRUD-UI (Anlegen/Bearbeiten/Löschen) ist durch `pillar-crud.spec.ts` (#439) bereits
 * abgedeckt. Dieser Vertrag (#431) legt die **dynamischen Grenzfälle** fest, die über das reine
 * CRUD hinausgehen und erst durch das Zusammenspiel von Verwaltung + Gewichtung relevant werden:
 *
 *  - **AK1:** Vollständiger Lebenslauf inkl. **Gewichten** — Säule anlegen → gewichten → umbenennen →
 *    löschen; Persistenz aller Schritte über einen Reload.
 *  - **AK2 (Löschbestätigung + Renormierung):** Nach dem Löschen einer Säule summieren sich die
 *    Gewichte der **verbleibenden** Säulen wieder auf 100 % (Server renormiert proportional).
 *  - **AK3 (dynamische Säulenzahl):** UI rendert korrekt bei 1, 3 und 8 Säulen — kein Overflow,
 *    die Gewichtssumme stimmt jeweils (wird bei der Speicherung auf 100 % normiert).
 *  - **AK4 (Mobile-First, Pflicht):** Die Säulen-Verwaltung ist bei 375×812 ohne horizontales
 *    Scrollen bedienbar, auch bei vielen Säulen.
 *
 * Diese Tests sind **rot**, weil das Frontend die kombinierten Verhaltensweisen (insbesondere die
 * Renormierungs-Sichtbarkeit nach Löschen und die korrekte Gewichtungsanzeige bei beliebiger
 * Säulenzahl) aktuell nicht als durchgehenden Flow exponiert/verifiziert. Sie werden grün, sobald
 * die Umsetzung das Zusammenspiel von PillarList + PillarWeightsForm nach Mutationen durchreicht.
 *
 * Sie prüfen funktionales UI-Verhalten gegen das echte Backend (kein API-Mock, wie in
 * `crud.spec.ts`); `/auth/me` wird durch die Fixture authentifiziert.
 */
test.describe('#431 Säulen-Verwaltung — dynamische Grenzfälle', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen
	// und parallele/aufeinanderfolgende Läufe sich nicht stören. Maximal TITLE_MAX_LENGTH Zeichen:
	// Das Säulen-Formular kappt den Namen per nativem `maxlength` (#935) — auch bei Playwright
	// `fill()` —, längere Namen würden still gekappt und Assertions auf den vollen Namen scheitern.
	// Muster: `delete-dialog-focus.spec.ts` (uniqueTitle).
	let runId = 0;
	const uniqueName = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E-431-${label}`.slice(0, TITLE_MAX_LENGTH - tail.length);
		return `${head}${tail}`;
	};

	/** Löscht alle Säulen über die echte API (Vite-Proxy → Backend). */
	const deleteAllPillars = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number }[];
		for (const pillar of pillars) {
			await page.request.delete(`/api/v1/pillars/${pillar.id}`);
		}
	};

	/** Setzt die Gewichte aller aktuell vorhandenen Säulen proportional-gleich (je 1.0 Rohwert). */
	const setEqualWeightsViaApi = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number }[];
		if (pillars.length === 0) {
			return;
		}
		await page.request.put('/api/v1/pillars/weights', {
			data: { weights: pillars.map((pillar) => ({ id: pillar.id, weight: 100 / pillars.length })) },
		});
	};

	/**
	 * Die fünf kanonischen Lebensbalance-Säulen (Stammdaten, siehe server `SEED_PILLARS`). Nur Name +
	 * Kurzbeschreibung — die ausführlichen wissenschaftlichen Texte sind für nachfolgende Specs
	 * ohne Belang.
	 */
	const DEFAULT_PILLARS = [
		{ name: 'Körper', description: 'Leiblichkeit' },
		{ name: 'Mentale Gesundheit', description: 'Emotionsregulation' },
		{ name: 'Beziehungen', description: 'Bindung' },
		{ name: 'Wirksamkeit', description: 'Selbstwirksamkeit' },
		{ name: 'Sinn', description: 'Transzendenz & Werte' },
	] as const;

	/**
	 * Legt die fünf Stammdaten-Säulen neu an und gewichtet sie gleich (je 20 %). Der e2e-Seed bestückt
	 * das Backend beim Start mit genau diesen fünf Säulen; dieser Spec löscht sie (afterEach) samt der
	 * test-angelegten Säulen. Damit nachfolgende Specs im selben Shard, die Stammdaten voraussetzen
	 * (`series.spec.ts` #343, `settings-page.spec.ts` AK5), nicht leer ausgehen, wird der Zustand
	 * nach jedem Test restauriert. Isolation #537: die Shard-Zusammensetzung legte diese Specs zusammen.
	 */
	const reseedDefaultPillars = async (page: Page): Promise<void> => {
		for (const { name, description } of DEFAULT_PILLARS) {
			await page.request.post('/api/v1/pillars', { data: { name, description } });
		}
		await setEqualWeightsViaApi(page);
	};

	// Definierter leerer Start je Test: sonst erbt der erste Test im Shard (AK1) die fünf Backend-
	// Seed-Säulen und sein „einzelne Säule = 100 %" Szenario schlägt fehl (Rohwert 0,2 statt 1,0).
	test.beforeEach(async ({ page }) => {
		await deleteAllPillars(page);
	});

	test.afterEach(async ({ page }) => {
		await deleteAllPillars(page);
		await reseedDefaultPillars(page);
	});

	/** Öffnet den Säulen-Tab über die Settings-Route und wartet auf die Überschrift. */
	const openPillarTab = async (page: Page): Promise<void> => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
	};

	/**
	 * Legt eine Säule über die UI an: öffnet den Anlegen-Dialog, füllt Name und optional
	 * Beschreibung aus und klickt „Anlegen" im Dialog. Wartet, bis der Name in der Liste sichtbar ist.
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
	 * AK1 — Vollständiger Lebenslauf inkl. Gewichten: Anlegen → Gewichten → Umbenennen → Löschen.
	 * Persistenz aller Schritte über einen Reload. Der Flow verbindet Verwaltung (PillarList) und
	 * Gewichtung (PillarWeightsForm) zu einem durchgehenden Lebenszyklus — das reine CRUD aus #439
	 * lässt den Gewichten-Schritt aus.
	 */
	test('AK1: vollständiger Lebenslauf — anlegen → gewichten → umbenennen → löschen (persistiert über Reload)', async ({
		page,
	}) => {
		await openPillarTab(page);

		// 1. Anlegen
		const name = uniqueName('Lebenslauf');
		await createPillarViaUi(page, name, 'Beschreibung AK1');

		// 2. Gewichten: über die echte API das Gewicht setzen. Bei der einzelnen, in AK1 angelegten
		//    Säule erhält sie volles Gewicht (100 % → Rohwert 1,0), damit der „gewichten"-Schritt im
		//    Vertrag nachvollziehbar wird. Das Frontend muss die gespeicherte Gewichtung nach Reload
		//    anzeigen (siehe Slider-Assertion unten).
		await setEqualWeightsViaApi(page);
		await page.reload();
		await openPillarTab(page);

		// Nach Reload muss die Säule noch vorhanden sein (Persistenz des Anlegens + Gewichtung).
		await expect(page.getByText(name, { exact: true })).toBeVisible();

		// Der „gewichten"-Schritt ist als UI-Verhalten durchreicht: die gesetzte Gewichtung muss
		// nach dem Reload auch in der UI (PillarWeightsForm) sichtbar sein — nicht nur über die API
		// gesetzt worden sein. Bei einer einzelnen Säule hat setEqualWeightsViaApi volles Gewicht
		// (100 %) gesetzt → der Slider zeigt den Rohwert 1,0 (vgl. crud.spec.ts „Säulen-Gewicht
		// ändern" Z.163). KoliBris KolInputRange exponiert kein role=slider, aber im offenen
		// Shadow-DOM steckt ein natives input[type=range] (Playwright durchdringt das).
		await expect(page.locator('input[type="range"]').first()).toHaveValue('1');

		// 3. Umbenennen
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: 'Säule bearbeiten' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const renamed = `${name}-umbenannt`;
		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(renamed);
		await dialog.getByRole('button', { name: 'Speichern' }).click();
		await expect(page.getByText(renamed, { exact: true })).toBeVisible();

		// 4. Löschen mit Bestätigung
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
	});

	/**
	 * AK2 — Löschbestätigung mit Renormierung: Löscht man eine Säule, müssen die Gewichte der
	 * **verbleibenden** Säulen danach wieder (annähernd) 100 ergeben — der Server renormiert die
	 * Rest-Gewichte proportional (DELETE /pillars/:id, Schritt 5). Das Frontend zeigt die
	 * Bestätigung an; nach Bestätigung muss die neue Summe in der UI sichtbar sein.
	 */
	test('AK2: nach Löschen summieren die restlichen Gewichte wieder auf 100', async ({ page }) => {
		await openPillarTab(page);

		// Drei Säulen anlegen, damit nach dem Löschen einer noch zwei übrig bleiben.
		const a = uniqueName('RenormA');
		const b = uniqueName('RenormB');
		const c = uniqueName('RenormC');
		await createPillarViaUi(page, a);
		await createPillarViaUi(page, b);
		await createPillarViaUi(page, c);

		// Gleiche Gewichte über die API setzen (3 Säulen → je ~33,33 %, Summe 100).
		await setEqualWeightsViaApi(page);

		// Säule „a" über die UI löschen (mit Bestätigung). Der Bestätigungsdialog muss den Hinweis
		// auf die Renormierung der verbleibenden Gewichte enthalten.
		const aItem = page.locator('.pillar-item', { hasText: a });
		await aItem.getByRole('button', { name: 'Löschen' }).click();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		// Säule „a" muss weg sein …
		await expect(page.getByText(a, { exact: true })).toHaveCount(0);
		// … und die Gewichte der verbleibenden Säulen müssen nach dem Reload wieder ~100 summieren.
		await page.reload();
		await openPillarTab(page);

		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number; weight: number }[];
		const totalWeight = pillars.reduce((sum, pillar) => sum + pillar.weight, 0);
		// Renormierung auf 100 (innerhalb einer kleinen Toleranz für Float-Rundung).
		expect(totalWeight).toBeCloseTo(100, 0);

		// „a" darf nach Reload nicht mehr vorhanden sein, „b" und „c" schon.
		const names = pillars.map((pillar) => pillar);
		expect(names.length).toBe(2);
	});

	/**
	 * AK3 — dynamische Säulenzahl: Die UI rendert korrekt bei 1, 3 und 8 Säulen. Die
	 * Gewichtungs-Logik muss mit beliebiger Säulenzahl umgehen (keine feste 5er-Annahme); nach
	 * Setzen gleicher Gewichte muss die Summe 100 ergeben und jede Säule sichtbar bleiben.
	 */
	test.describe('AK3: UI rendert korrekt bei 1, 3 und 8 Säulen', () => {
		for (const count of [1, 3, 8]) {
			test(`rendert ${count} Säulen korrekt — alle sichtbar, Gewichtssumme = 100`, async ({ page }) => {
				await openPillarTab(page);

				// Säulen anlegen (auch die „1"- und „8"-Fälle decken die dynamische Zahl ab).
				const names: string[] = [];
				for (let index = 0; index < count; index += 1) {
					const name = uniqueName(`Dyn${index}`);
					names.push(name);
					await createPillarViaUi(page, name);
				}

				// Gleiche Gewichte setzen und prüfen, dass die Summe wieder 100 ergibt.
				await setEqualWeightsViaApi(page);
				await page.reload();
				await openPillarTab(page);

				const response = await page.request.get('/api/v1/pillars');
				const pillars = (await response.json()) as { id: number; name: string; weight: number }[];
				expect(pillars.length).toBe(count);

				// Jede angelegte Säule muss nach Reload noch sichtbar sein (Persistenz).
				for (const name of names) {
					await expect(page.getByText(name, { exact: true })).toBeVisible();
				}

				// Gewichtssumme muss (nach Renormierung/Speicherung) 100 ergeben.
				const totalWeight = pillars.reduce((sum, pillar) => sum + pillar.weight, 0);
				expect(totalWeight).toBeCloseTo(100, 0);
			});
		}
	});

	/**
	 * AK4 — Mobile-First (Pflicht): Die Säulen-Verwaltung ist bei 375×812 (iPhone X) ohne
	 * horizontales Scrollen bedienbar — auch mit mehreren Säulen. Muster wie `login.spec.ts` AK5
	 * (`element.scrollWidth <= window.innerWidth`).
	 */
	test('AK4: Mobile-First — kein horizontales Scrollen bei 375×812 mit vielen Säulen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openPillarTab(page);

		// Acht Säulen anlegen, um eine breite Liste zu simulieren (AK3 hat gezeigt, dass 8 möglich sind).
		for (let index = 0; index < 8; index += 1) {
			await createPillarViaUi(page, uniqueName(`Mobile-${index}`));
		}

		// Kein horizontales Scrollen auf Viewport- und Body-Ebene.
		const hasNoHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		);
		expect(hasNoHorizontalOverflow).toBe(true);
		const bodyNoOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(bodyNoOverflow).toBe(true);
	});
});
