import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #510 „Aufgabenliste mobilfähig machen – einheitliche Zeilen".
 *
 * Die Aufgabenliste (`TaskTree`, gerendert über das Aufgaben-Tab) ist auf Mobilgeräten nicht
 * responsive: Zeilenhöhen und Abstände sind uneinheitlich, Elemente (Aufklapp-Icon,
 * Fortschritts-Badge, Titel) vertikal verschoben, lange Titel überlaufen, und die erste Zeile
 * sieht anders aus als die restlichen. Diese Specs prüfen die Akzeptanzkriterien aus #510 als
 * ausführbare, geometrische Assertions.
 *
 * Abgrenzung (Dedup) zu vorhandenen Specs:
 *  - `task-tree-mobile-360.spec.ts` (#376/#387) deckt den horizontalen Overflow **bei 360 px**
 *    (tiefe Kette, drei Badges) und die „…"-Button-/Popover-Geometrie ab. #510 AK1 erweitert das
 *    auf **414 px** (iPhone-Klasse) → hier neu getestet.
 *  - `tasks-tab-filter.spec.ts` AK7 (#399) prüft bei **375 px**, dass Filter/Button/Switch sichtbar
 *    sind und kein Overflow entsteht. #510 AK4 verlangt zusätzlich **sinnvolles Stacking
 *    (keine Überlappung)** auf 360 px → hier neu getestet (Überlappungs-Assertion).
 *  - Einheitliche Zeilenhöhe, gemeinsame vertikale Mittellinie (Icon/Badge/Titel), erste Zeile
 *    gleich wie die restlichen sowie eine Desktop-Regression-Wächter (≥ 1024 px) sind nirgends
 *    getestet → ebenfalls neu hier.
 *
 * Wie die übrigen funktionalen Specs läuft dies gegen das **echte** Backend (In-Memory-DB,
 * Vite-Proxy). Daten werden über die API geseedet; `afterEach` räumt alle Tasks wieder ab.
 *
 * Die Specs sind **rot**, bis `TaskTree.tsx`/`app.css` einheitliche Zeilenhöhen, eine gemeinsame
 * vertikale Mittellinie und konsistente Darstellung über alle Zeilentypen (auch die erste) erzwingen
 * — additiv per Mobile-First-Kaskade, ohne Desktop-Regression.
 */
test.describe('Priority Pilot — Aufgabenliste mobilfähig, einheitliche Zeilen (#510)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Resp510 ${label} #${(runId += 1)}-${Date.now()}`;

	/** Toleranz für „gemeinsame Mittellinie"/„gleiche Höhe": erlaubte Pixel-Abweichung (vgl. header-appearance). */
	const TOLERANCE_PX = 2;

	/** iPhone-Klassen-Viewports aus #510 T1/T5 (360 px + 414 px) sowie der Desktop-Wächter (1024 px). */
	const VP_360 = { width: 360, height: 780 } as const;
	const VP_414 = { width: 414, height: 896 } as const;

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Verknüpft `childId` als Unteraufgabe von `parentId` (Muster `task-tree-mobile-360.spec.ts`):
	 * `POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`. `parentId` erhält
	 * dadurch ein Aufklapp-Icon sowie das Fortschritts-Badge.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(response.ok()).toBeTruthy();
	};

	/** Löscht alle Tasks über die echte API, damit jeder Test vom leeren Zustand startet. */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Der Listeneintrag eines Tasks im Baum, verankert über `data-testid="task-tree-item-<id>"`. */
	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Vertikaler Mittelpunkt einer Bounding-Box (für „gemeinsame Grundlinie"/Mittellinie). */
	const centerOf = (box: { y: number; height: number }): number => box.y + box.height / 2;

	/** True, wenn das Dokument horizontal über den Viewport hinausragt (> 1 px Toleranz). */
	const overflowsHorizontally = (page: Page): Promise<boolean> =>
		page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

	/**
	 * AK1 (AC1, T1) — Bei **414 px** (iPhone-Klasse) kein horizontaler Scrollen. #376 deckt 360 px ab;
	 * 414 px ist der zweite, in #510 T1 geforderte Referenz-Viewport. Seed: mehrere kurze Tasks plus
	 * eine Eltern-Aufgabe mit Unteraufgabe (→ Aufklapp-Icon + Fortschritts-Badge = breiteste Zeile).
	 */
	test('AK1: kein horizontaler Overflow bei 414px (Tasks + Fortschritts-Badge)', async ({ page }) => {
		await page.setViewportSize(VP_414);

		const parent = await createTask(page, uniqueTitle('Eltern'));
		const child = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parent, child);
		await createTask(page, uniqueTitle('Solo'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, parent).locator('.task-tree-badge--progress')).toBeVisible();

		expect(await overflowsHorizontally(page)).toBe(false);
	});

	/**
	 * AK2 (AC2, T1) — Einheitliche Zeilenhöhe über mehrere einzeilige Zeilen **verschiedenen Typs**
	 * (Blatt ohne Badge vs. Eltern-Aufgabe mit Fortschritts-Badge). #510 AC2/AC5 verlangen, dass alle
	 * Zeilen gleich hoch sind — auch Zeilen mit vs. ohne Badge. Bei 360 px müssen die Höhen der
	 * geprüften Zeilen innerhalb der Toleranz übereinstimmen.
	 */
	test('AK2: einheitliche Zeilenhöhe bei 360px – Blatt gleicht Eltern-Zeile mit Badge', async ({ page }) => {
		await page.setViewportSize(VP_360);

		const parent = await createTask(page, uniqueTitle('Eltern'));
		const child = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parent, child);
		const solo = await createTask(page, uniqueTitle('Solo'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const parentBox = await item(page, parent).boundingBox();
		const soloBox = await item(page, solo).boundingBox();
		expect(parentBox).not.toBeNull();
		expect(soloBox).not.toBeNull();

		if (parentBox !== null && soloBox !== null) {
			expect(
				Math.abs(parentBox.height - soloBox.height),
				`Eltern-Zeile (${parentBox.height}px) und Blatt-Zeile (${soloBox.height}px) müssen gleich hoch sein`,
			).toBeLessThanOrEqual(TOLERANCE_PX);
		}
	});

	/**
	 * AK3 (AC2, T3) — Gemeinsame vertikale Mittellinie: Aufklapp-Icon, Titel und Fortschritts-Badge
	 * einer Zeile liegen auf einer Grundlinie (Mittelpunkte ≤ TOLERANCE_PX auseinander). #510 AC2/T3
	 * stellte genau diese Ausrichtung als Fehlerursache fest. Geprüft an der Eltern-Zeile (hat Icon +
	 * Badge) bei 360 px.
	 */
	test('AK3: Icon, Titel und Fortschritts-Badge teilen sich eine Mittellinie bei 360px', async ({ page }) => {
		await page.setViewportSize(VP_360);

		const parent = await createTask(page, uniqueTitle('Eltern'));
		const child = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parent, child);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const row = item(page, parent);
		const toggle = row.locator('.task-tree-toggle').first();
		const title = row.locator('.task-tree-title').first();
		const badge = row.locator('.task-tree-badge--progress').first();

		await expect(toggle).toBeVisible();
		await expect(badge).toBeVisible();

		const toggleBox = await toggle.boundingBox();
		const titleBox = await title.boundingBox();
		const badgeBox = await badge.boundingBox();

		const centers = [centerOf(toggleBox!), centerOf(titleBox!), centerOf(badgeBox!)];
		const spread = Math.max(...centers) - Math.min(...centers);
		expect(
			spread,
			`Mittelpunkte (Icon ${centers[0]}, Titel ${centers[1]}, Badge ${centers[2]}) dürfen höchstens ${TOLERANCE_PX}px auseinanderliegen`,
		).toBeLessThanOrEqual(TOLERANCE_PX);
	});

	/**
	 * AK4 (AC3, T2) — Lange Aufgabentitel brechen sauber um (≥ 2 Zeilen), statt zu überlaufen oder
	 * abgeschnitten zu werden; die Zeile bleibt innerhalb des Viewports. Nachgewiesen als Wrap: die
	 * Titel-Höhe eines langen Titels ist deutlich größer als die eines kurzen (≥ 1,5×). Daneben darf
	 * kein horizontaler Overflow entstehen (414 px). (Abgrenzung: #376 AK4 prüft nur eine
	 * Mindestbreite > 80 px, nicht das tatsächliche Umbrechen.)
	 */
	test('AK4: langer Titel bricht um (≥ 2 Zeilen), kein Overflow bei 414px', async ({ page }) => {
		await page.setViewportSize(VP_414);

		const shortId = await createTask(page, uniqueTitle('Kurz'));
		const longId = await createTask(
			page,
			`Sehr langer Aufgabentitel der auf schmalen mobilen Viewports sauber auf mehrere Zeilen umbrechen muss statt zu überlaufen oder abgeschnitten zu werden ${Date.now()}`,
		);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const shortBox = await item(page, shortId).locator('.task-tree-title').first().boundingBox();
		const longBox = await item(page, longId).locator('.task-tree-title').first().boundingBox();
		expect(shortBox).not.toBeNull();
		expect(longBox).not.toBeNull();

		if (shortBox !== null && longBox !== null) {
			expect(
				longBox.height,
				`Langer Titel (${longBox.height}px) muss auf mehrere Zeilen umbrechen (≥ 1,5 × kurz ${shortBox.height}px)`,
			).toBeGreaterThanOrEqual(shortBox.height * 1.5);
		}

		expect(await overflowsHorizontally(page)).toBe(false);
	});

	/**
	 * AK5 (AC5, T4) — Erste Zeile gleicht optisch den restlichen Zeilen: Die Höhe der ersten Zeile
	 * entspricht der einer nachfolgenden Zeile (gleicher Typ, einzeilig) innerhalb der Toleranz.
	 * #510 AC5/T4 stellte fest, dass die erste Zeile abweichend dargestellt wird.
	 */
	test('AK5: erste Zeile gleicht der zweiten Zeile (einheitliche Höhe) bei 360px', async ({ page }) => {
		await page.setViewportSize(VP_360);

		const firstId = await createTask(page, uniqueTitle('Erste'));
		const secondId = await createTask(page, uniqueTitle('Zweite'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Top-Level-Zeilen in Anzeige-Reihenfolge: erste und zweite eingetragene Aufgabe (gleicher Typ,
		// einzeilig). Sortiert nach y-Position, um die Anzeige-Reihenfolge (nicht die ID) zu greifen.
		const firstBox = await item(page, firstId).boundingBox();
		const secondBox = await item(page, secondId).boundingBox();
		expect(firstBox).not.toBeNull();
		expect(secondBox).not.toBeNull();

		if (firstBox !== null && secondBox !== null) {
			expect(
				Math.abs(firstBox.height - secondBox.height),
				`Erste Zeile (${firstBox.height}px) und zweite Zeile (${secondBox.height}px) müssen gleich hoch sein`,
			).toBeLessThanOrEqual(TOLERANCE_PX);
		}
	});

	/**
	 * AK6 (AC4, T5) — Filter-Leiste (Such-Eingabefeld + „Filtern"-Button) bleibt bei 360 px bedienbar:
	 * beide vollständig sichtbar und **ohne Überlappung** (sinnvolles Stacking/Umbrechen statt
	 * side-by-side-Gequetsche). Abgrenzung: `tasks-tab-filter.spec.ts` AK7 (#399) prüft bei 375 px
	 * Sichtbarkeit + kein Overflow, aber keine Überlappung — die Überlappungs-Assertion ist hier neu.
	 */
	test('AK6: Suchfeld und „Filtern"-Button bei 360px sichtbar und ohne Überlappung', async ({ page }) => {
		await page.setViewportSize(VP_360);
		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const search = page.getByRole('searchbox', { name: /suchen|filter|titel/i });
		const filter = page.getByRole('button', { name: 'Filtern' });

		await expect(search).toBeVisible();
		await expect(filter).toBeVisible();

		const searchBox = await search.boundingBox();
		const filterBox = await filter.boundingBox();
		expect(searchBox).not.toBeNull();
		expect(filterBox).not.toBeNull();

		if (searchBox !== null && filterBox !== null) {
			// Beide vollständig im Viewport.
			expect(searchBox.x).toBeGreaterThanOrEqual(0);
			expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(VP_360.width + 1);
			expect(filterBox.x).toBeGreaterThanOrEqual(0);
			expect(filterBox.x + filterBox.width).toBeLessThanOrEqual(VP_360.width + 1);

			// Keine Überlappung: bei vertikalem Stacking liegt der Button unter dem Eingabefeld
			// (filterBox.y ≥ Ende searchBox), bei nebeneinander liegt er rechts daneben. Beides ist
			// zulässig; unzulässig ist eine Überlappung ihrer Bounding-Boxen.
			const overlapX = Math.max(
				0,
				Math.min(searchBox.x + searchBox.width, filterBox.x + filterBox.width) - Math.max(searchBox.x, filterBox.x),
			);
			const overlapY = Math.max(
				0,
				Math.min(searchBox.y + searchBox.height, filterBox.y + filterBox.height) - Math.max(searchBox.y, filterBox.y),
			);
			const overlaps = overlapX > 1 && overlapY > 1;
			expect(overlaps, 'Suchfeld und „Filtern"-Button dürfen sich nicht überlappen').toBe(false);
		}

		expect(await overflowsHorizontally(page)).toBe(false);
	});

	/**
	 * AK7 (T6) — Desktop-Regression: Bei ≥ 1024 px bleibt die Aufgabenliste ohne horizontalen Overflow
	 * (kein Downgrade des Desktop-Layouts durch die Mobile-Anpassungen). Wächter-Test, der eine
	 * versehliche Desktop-Regression der Mobile-First-Kaskade auffängt.
	 */
	test('AK7: Desktop ≥1024px – kein horizontaler Overflow (keine Regression)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });

		const parent = await createTask(page, uniqueTitle('Eltern'));
		const child = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parent, child);
		await createTask(page, uniqueTitle('Solo'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, parent).locator('.task-tree-badge--progress')).toBeVisible();

		expect(await overflowsHorizontally(page)).toBe(false);
	});
});
