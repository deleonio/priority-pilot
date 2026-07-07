import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #376 „Mobile Ansicht der Aufgabenliste aufräumen und responsiv stabilisieren".
 *
 * Die Aufgabenliste (`TaskTree`, #238/#363) muss auf schmalen Mobil-Viewports (Samsung-S24-Klasse,
 * 360×780) sauber umbrechen: kein horizontaler Overflow, beide Zeilen-Buttons und das „…"-Popover
 * vollständig im Viewport und bedienbar, und ein langer Titel darf nicht zeichenweise zerfallen.
 *
 * Diese Specs prüfen den **Worst Case**: eine tiefe (≥ 6 Ebenen) aufgeklappte Kette, deren am tiefsten
 * eingerückte Zeile gleichzeitig ein Serie-, ein Ausnahme- **und** ein Fortschritts-Badge trägt — genau
 * die Zeile, die auf 360px am ehesten überläuft. Muster: `task-tree.spec.ts` (AK-369-3/AK-361-6),
 * `done-toggle.spec.ts` (AK4), `progress.spec.ts` (AK1), `series.spec.ts` (AK2/AK3) — hier aber
 * konsequent bei 360 statt 375.
 *
 * Wie die übrigen funktionalen Specs läuft dies gegen das **echte** Backend (In-Memory-DB,
 * Vite-Proxy). Der Baum wird über die API geseedet: eine Unteraufgabe ist der **Vorgänger** ihrer
 * Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`, #336). Im
 * Wald erscheint das Kind als `dependents`-Eintrag (Unteraufgabe) des Elternteils; die invertierte
 * Anzeige (#363) dreht diese Kante um (Unter-/Blattaufgaben oben, Oberaufgaben als aufklappbare Kinder).
 *
 * `afterEach` räumt erst alle Tasks (inkl. generierter Serien-Instanzen), dann alle Serien ab, damit
 * jeder Test vom leeren Zustand startet.
 *
 * Die Specs sind **rot**, bis `TaskTree.tsx`/`app.css` die 360px-Kaskade umsetzen (AK5: additiv per
 * `@media (min-width: …)`, kein Downgrade des Desktop-Layouts).
 */
test.describe('Priority Pilot — Aufgabenliste responsiv bei 360px (#376)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Mobile360 ${label} #${(runId += 1)}-${Date.now()}`;

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
	 * Verknüpft `childId` als Unteraufgabe von `parentId` — exakt wie `TaskForm.tsx`: das Kind wird zum
	 * **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
	 * `dependingTaskId = childId`, #336). Damit taucht das Kind im Wald unter `parent.dependents` auf.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(response.ok()).toBeTruthy();
	};

	/**
	 * Erzeugt eine Serien-Instanz mit gesetzter Ausnahme: legt eine wöchentliche Serie an, materialisiert
	 * deren erste fällige Instanz und verschiebt anschließend deren Deadline individuell — das Backend
	 * markiert die Instanz dadurch als `isException` (Muster `series.spec.ts` AK2/AK3). Die zurückgegebene
	 * Task-ID trägt damit sowohl das Serie- als auch das Ausnahme-Badge. Der Titel der Instanz entspricht
	 * dem Serien-Titel.
	 */
	const createSeriesExceptionInstance = async (page: Page, title: string): Promise<number> => {
		const seriesResponse = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(seriesResponse.ok()).toBeTruthy();
		const seriesId = ((await seriesResponse.json()) as { id: number }).id;

		// `until` liegt exakt zwischen erster (07.09.) und zweiter (14.09.) Fälligkeit → genau eine Instanz.
		const generateResponse = await page.request.post(`/api/v1/series/${seriesId}/generate`, {
			data: { until: '2026-09-08T00:00:00.000Z' },
		});
		expect(generateResponse.ok()).toBeTruthy();

		const tasksResponse = await page.request.get('/api/v1/tasks');
		const tasks = (await tasksResponse.json()) as { id: number; seriesId: number | null }[];
		const instance = tasks.find((task) => task.seriesId === seriesId);
		expect(instance).toBeDefined();
		const instanceId = (instance as { id: number }).id;

		// Individuelle Deadline-Verschiebung → Backend setzt `isException = true` (Ausnahme-Badge).
		const patchResponse = await page.request.patch(`/api/v1/tasks/${instanceId}`, {
			data: { deadline: '2026-09-28T00:00:00.000Z' },
		});
		expect(patchResponse.ok()).toBeTruthy();
		return instanceId;
	};

	/** Räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Der Listeneintrag eines Tasks im Baum, verankert über `data-testid="task-tree-item-<id>"`. */
	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Das Aufklapp-/Zuklapp-Steuerelement innerhalb eines Knotens. */
	const toggle = (page: Page, id: number) =>
		item(page, id)
			.getByRole('button', { name: /Auf|Zuklappen|klappen/i })
			.first();

	/** Öffnet das „Weitere Aktionen"-Popover („…") eines Knotens (#361). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	/**
	 * Seedet die Worst-Case-Zeile: eine semantische Kette der Tiefe 7 (`A ⊃ t1 ⊃ … ⊃ t6`), an deren
	 * Spitze die Serien-Ausnahme-Instanz `A` steht. `A` hat mit `t1` eine Unteraufgabe und trägt damit
	 * zusätzlich das Fortschritts-Badge — also alle drei Badges (Serie, Ausnahme, Fortschritt).
	 *
	 * In der invertierten Anzeige (#363) ist das Blatt `t6` die Wurzel; Aufklappen führt über
	 * `t6 → t5 → … → t1 → A` sechs Ebenen tief nach unten, bis `A` (die am tiefsten eingerückte Zeile
	 * mit allen drei Badges) erscheint.
	 *
	 * Rückgabe:
	 * - `deepestId` = `A` (am tiefsten eingerückte Worst-Case-Zeile, alle drei Badges),
	 * - `orderedFromRoot` = Anzeige-Reihenfolge `[t6, t5, t4, t3, t2, t1, A]` (Wurzel → tiefste Zeile).
	 */
	const seedWorstCaseChain = async (
		page: Page,
		deepestTitle: string,
	): Promise<{ deepestId: number; orderedFromRoot: number[] }> => {
		const deepestId = await createSeriesExceptionInstance(page, deepestTitle);
		const chain = [deepestId];
		let parentId = deepestId;
		for (let level = 1; level <= 6; level += 1) {
			const childId = await createTask(page, uniqueTitle(`Ebene-${level}`));
			await addSubtask(page, parentId, childId);
			chain.push(childId);
			parentId = childId;
		}
		return { deepestId, orderedFromRoot: [...chain].reverse() };
	};

	/** Klappt die gesamte Anzeige-Kette auf (jede Zeile außer der tiefsten hat ein Aufklapp-Symbol). */
	const expandFully = async (page: Page, orderedFromRoot: number[]): Promise<void> => {
		for (let i = 0; i < orderedFromRoot.length - 1; i += 1) {
			const id = orderedFromRoot[i];
			await expect(item(page, id)).toBeVisible();
			await toggle(page, id).click();
		}
		await expect(item(page, orderedFromRoot[orderedFromRoot.length - 1])).toBeVisible();
	};

	test('AK1: kein horizontaler Overflow bei 360px (tiefe Kette + Serie/Ausnahme/Fortschritt)', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });

		const { deepestId, orderedFromRoot } = await seedWorstCaseChain(page, uniqueTitle('WorstCase'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expandFully(page, orderedFromRoot);

		// Die am tiefsten eingerückte Worst-Case-Zeile trägt alle drei Badges (Serie, Ausnahme, Fortschritt).
		const worstCaseRow = item(page, deepestId);
		await expect(worstCaseRow.getByText('Serie', { exact: true })).toBeVisible();
		await expect(worstCaseRow.getByText('geändert', { exact: true })).toBeVisible();
		await expect(worstCaseRow.getByText(/^\d+\/\d+$/)).toBeVisible();

		// Kernvertrag: Das Dokument ragt nicht über die Viewport-Breite hinaus (AK1).
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	test('AK2: Erledigt-Toggle und „…"-Button liegen bei 360px vollständig im Viewport und erfüllen 44×44', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 360, height: 780 });

		const { deepestId, orderedFromRoot } = await seedWorstCaseChain(page, uniqueTitle('Buttons'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expandFully(page, orderedFromRoot);

		// Beide Zeilen-Buttons der Worst-Case-Zeile: der (aufgrund offener Unteraufgabe ggf. gesperrte,
		// aber weiterhin gerenderte) Erledigt-Toggle und der „…"-Button. Rein geometrische Prüfung:
		// vollständig im Viewport (`box.x + box.width <= 360 + 1`) und Touch-Target-Minimum 44×44.
		const doneToggle = page.getByTestId(`done-toggle-${deepestId}`);
		const moreButton = item(page, deepestId).getByRole('button', { name: /Weitere Aktionen/i });

		for (const button of [doneToggle, moreButton]) {
			await expect(button).toBeVisible();
			const box = await button.boundingBox();
			expect(box).not.toBeNull();
			if (box !== null) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);
				expect(box.width).toBeGreaterThanOrEqual(44);
				expect(box.height).toBeGreaterThanOrEqual(44);
			}
		}
	});

	test('AK3: „…"-Popover samt aller 4 Aktionen liegt bei 360px vollständig im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });

		const { deepestId, orderedFromRoot } = await seedWorstCaseChain(page, uniqueTitle('Popover'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expandFully(page, orderedFromRoot);
		await openActionsPopover(page, deepestId);

		// Alle vier Aktionen liegen vollständig im Viewport (kein Abschneiden am rechten/linken Rand).
		const buttonNames = ['Bearbeiten', 'Abhängigkeiten', 'Unteraufgabe anlegen', 'Löschen'];
		for (const name of buttonNames) {
			const button = item(page, deepestId).getByRole('button', { name });
			await expect(button).toBeVisible();
			const box = await button.boundingBox();
			expect(box).not.toBeNull();
			if (box !== null) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);
			}
		}

		// Auch bei geöffnetem Popover kein horizontaler Seiten-Overflow (Muster AK-369-3, hier bei 360).
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	test('AK4: langer Titel behält bei 360px eine sinnvolle Mindestbreite (kein zeichenweiser Zerfall)', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 360, height: 780 });

		const longTitle = `Sehr langer Aufgabentitel der auf schmalen mobilen Viewports nicht in winzige Ein- oder Zwei-Zeichen-Fragmente zerfallen darf ${Date.now()}`;
		const { deepestId, orderedFromRoot } = await seedWorstCaseChain(page, longTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expandFully(page, orderedFromRoot);

		// Die Titel-Box (`.task-tree-title`) der Worst-Case-Zeile muss trotz tiefer Einrückung + drei Badges
		// eine sinnvolle Mindestbreite behalten. Bricht der Titel zeichenweise um, schrumpft die Box weit
		// unter diesen Schwellwert — die Grobprüfung (> 80px) fängt den Zerfall ab (kurze visuelle
		// Verifikation ergänzt dies im Review).
		const titleBox = item(page, deepestId).locator('.task-tree-title').first();
		await expect(titleBox).toBeVisible();
		const box = await titleBox.boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.width).toBeGreaterThan(80);
		}
	});

	// AK5 — Mobile-First-Kaskade: neue Breiten-Regeln ausschließlich additiv via `@media (min-width: …)`,
	// kein Downgrade des Desktop-Layouts. Bewusst KEIN automatischer Test: Dies ist eine rein statische
	// Eigenschaft der CSS-Kaskade und wird per Code-Review/PR-Begründung geprüft (siehe Issue #376).
});
