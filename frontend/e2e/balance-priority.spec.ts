import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView, fullPillarContributions, registerOwnSession } from './helpers';

/**
 * E2E-Vertrag für die „Balance-Priorisierung" in der Aufgabenliste (Tab „Aufgaben", #1792).
 *
 * Seit #1792 ist die Balance-Sortierung der **Standard** (`balancePreferences`, localStorage
 * `pp-balance-priority`, Default an): ohne Schalterklick steht der Defizit-Task oben. Abschaltbar
 * am Ansichts-Schalter und am Einstellungs-Schalter (Allgemein-Tab) — beide spiegeln denselben
 * Key, der Zustand übersteht ein Neuladen. Ein einmaliger Hinweis (Dismiss-Key
 * `pp-balance-hint-dismissed`) erklärt die Umstellung und lässt sich direkt wegklicken.
 *
 * Gerechnet wird live an der Datenlage (Rechenkern `frontend/src/lib/balancePriority.ts`); es
 * gehen keinerlei Schreibzugriffe auf `/api/v1/tasks` raus — die Server-`priority` bleibt
 * unberührt. Szenario wie bisher: der gesamte erledigte Aufwand liegt in Säule B → Säule A ist
 * unterversorgt (Defizit 1). Task X (Original-Prio 1) zahlt in A, Task Y (Original-Prio 5) in B.
 * Im Balance-Modus steht X über Y (virtuelle Badges ~P4/~P2, s. TEST-PFLEGE unten), sonst Y über X.
 *
 * Spec: docs/spec/issue-1792.md. **Test-Pflege:** Der bisherige Test nahm Default **aus** an
 * („Ohne Balance-Modus …") und widerspricht AK2 — umgebaut (siehe PR-Beschreibung).
 *
 * `data-testid`-Konvention: `task-list-item-{id}` pro Blatt-Aufgabe (#537).
 */
test.describe('Balance-Priorisierung in der Aufgabenliste', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E-Balance-${label} #${(runId += 1)}`;

	interface PillarDto {
		id: number;
		name: string;
		weight: number;
	}
	interface TaskDto {
		id: number;
		title: string;
	}

	/**
	 * Legt einen Task über die echte API an und liefert ihn zurück. #2077: Vollverteilung mit
	 * Schwerpunkt auf der Säule am `emphasis` (Höchstanteil 80 %) statt Ein-Säulen-100 % —
	 * nicht-leere Anteilslisten müssen alle Säulen des Kontos abdecken (Schreib-Regel des Backends).
	 */
	const createTask = async (
		page: Page,
		title: string,
		priority: number,
		pillars: PillarDto[],
		emphasis: number | null,
	): Promise<TaskDto> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				priority,
				estimatedEffort: 1,
				...(emphasis !== null ? { pillars: fullPillarContributions(pillars, emphasis, 80) } : {}),
			},
		});
		expect(response.ok()).toBeTruthy();
		return (await response.json()) as TaskDto;
	};

	const setDone = async (page: Page, id: number): Promise<void> => {
		const response = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
		expect(response.ok()).toBeTruthy();
	};

	/** Zwei gewichtete Säulen (A = unterversorgt, B = versorgt) plus Task X (Prio 1 → A) und Y (Prio 5 → B). */
	const seedScene = async (page: Page): Promise<{ taskX: TaskDto; taskY: TaskDto }> => {
		// Eigene Session (#2132-Fixup): der Pass-Through-Account der Shard-DB sammelt Säulen-Reste
		// anderer Specs (15 statt 5 Säulen) — die Vollverteilungs-Fixtures spreizen dann auf alle,
		// die Defizite kippen und die Badge-Erwartung (~P4) bricht. Die frische Registrierung säht
		// GENAU die fünf Standard-Säulen und hält die Rechnung deterministisch.
		await registerOwnSession(page, 'balance-priority');
		const pillarsResponse = await page.request.get('/api/v1/pillars');
		expect(pillarsResponse.ok()).toBeTruthy();
		const pillars = ((await pillarsResponse.json()) as PillarDto[]).filter((pillar) => pillar.weight > 0);
		expect(pillars.length).toBeGreaterThanOrEqual(2);
		const [pillarA, pillarB] = pillars;

		// Erledigter Aufwand schwerpunktmäßig in Säule B (80 %) → Säule A bleibt deutlich defizitär.
		const doneTask = await createTask(page, uniqueTitle('Versorger'), 3, pillars, pillars.indexOf(pillarB));
		await setDone(page, doneTask.id);

		const taskX = await createTask(page, uniqueTitle('X-Defizit'), 1, pillars, pillars.indexOf(pillarA));
		const taskY = await createTask(page, uniqueTitle('Y-Versorgt'), 5, pillars, pillars.indexOf(pillarB));
		return { taskX, taskY };
	};

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
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

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	const balanceSwitch = (page: Page) => page.getByRole('checkbox', { name: /Balance-Priorisierung/i });

	/** Der Einmal-Hinweis auf die Balance-Umstellung (AK4) — über den Alert-Text lokalisiert. */
	const hint = (page: Page) => page.locator('kol-alert').filter({ hasText: /Balance-Priorisierung/i });

	/** Vertikalposition eines Listen-Eintrags (px von oben) — kleinere y = weiter oben in der Liste. */
	const yOf = async (page: Page, id: number): Promise<number> => {
		const box = await item(page, id).boundingBox();
		expect(box).not.toBeNull();
		return box!.y;
	};

	/** Registriert einen Mitschnitt aller Schreibrequests auf /api/v1/tasks (es darf keiner rausgehen). */
	const recordTaskWrites = (page: Page): string[] => {
		const writes: string[] = [];
		page.on('request', (request) => {
			if (/\/api\/v1\/tasks/.test(request.url()) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
				writes.push(`${request.method()} ${request.url()}`);
			}
		});
		return writes;
	};

	test('AK2: Balance-Sortierung ist Standard ohne Schalterklick — AK3: Abschalten hält Neuladen stand, beide Schalter synchron', async ({
		page,
	}) => {
		const { taskX, taskY } = await seedScene(page);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);

		// AK2: Ohne irgendeinen Klick — Schalter an, Defizit-Task X über Y (P5), virtuelle Badges.
		await expect(balanceSwitch(page)).toBeChecked();
		await expect(item(page, taskX.id)).toBeVisible();
		await expect(item(page, taskY.id)).toBeVisible();
		await expect.poll(async () => (await yOf(page, taskX.id)) < (await yOf(page, taskY.id))).toBe(true);
		// TEST-PFLEGE #2077: Die Vollverteilungs-Pflicht macht Ein-Säulen-100 %-Fixtures unmöglich —
		// der Balance-Score ist auf 0,8 · Defizit gedeckelt (Schwerpunkt-Säule trägt max. 80 %). Mit
		// Gleichverteilten Seed-Gewichten (je 20) und 80/5×4-Beiträgen ergibt sich deterministisch
		// X ≈ 0,71 → ~P4 und Y ≈ 0,15 → ~P2; die Kernaussage (X dringlicher als Y) bleibt erhalten.
		await expect(item(page, taskX.id).getByText('~P4')).toBeVisible();
		await expect(item(page, taskY.id).getByText('~P2')).toBeVisible();

		const writes = recordTaskWrites(page);

		// AK3: Abschalten am Ansichts-Schalter — Original-Reihenfolge und Original-Badges kehren zurück.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).not.toBeChecked();
		await expect.poll(async () => (await yOf(page, taskY.id)) < (await yOf(page, taskX.id))).toBe(true);
		await expect(item(page, taskY.id).getByText('P5')).toBeVisible();
		await expect(item(page, taskX.id).getByText('P1')).toBeVisible();

		// Während des gesamten Umschaltens ging kein Schreibrequest auf die Tasks raus.
		expect(writes).toEqual([]);

		// AK3: Zustand überlebt Neuladen (pp-balance-priority = false), Ansichts-Schalter bleibt aus.
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(balanceSwitch(page)).not.toBeChecked();
		await expect.poll(async () => (await yOf(page, taskY.id)) < (await yOf(page, taskX.id))).toBe(true);
		// Das erste explizite Abschalten setzt das Dismiss-Flag — der Hinweis kehrt nicht zurück.
		await expect(hint(page)).toHaveCount(0);

		// AK3: Beide Schalter zeigen denselben Zustand — der Einstellungs-Schalter ist ebenfalls aus.
		const settingsSwitch = page.getByRole('checkbox', { name: /Balance-Priorisierung/i });
		await page.goto('/app/settings/general');
		await expect(settingsSwitch).not.toBeChecked();

		// … und Einschalten in den Einstellungen spiegelt an den Ansichts-Schalter zurück.
		await settingsSwitch.click();
		await expect(settingsSwitch).toBeChecked();
		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(balanceSwitch(page)).toBeChecked();
	});

	test('AK4: Einmal-Hinweis erscheint, nennt den Weg zum Abschalten und kehrt nach Dismiss nicht zurück', async ({
		page,
	}) => {
		await seedScene(page);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Ohne Dismiss-Flag: Hinweis über der Aufgabenliste, Weg zum Abschalten genannt.
		const hintBox = hint(page).first();
		await expect(hintBox).toBeVisible();
		await expect(hintBox).toContainText(/Einstellungen/i);

		// Direktes Wegkippen im Hinweis (KolButton im Alert) — danach ist die Fläche komplett weg.
		await hintBox.locator('kol-button').first().click();
		await expect(hintBox).toBeHidden();

		// Persistenz: nach Neuladen ist der Hinweis weg und der Dismiss-Key gesetzt.
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(hint(page)).toHaveCount(0);
		expect(await page.evaluate(() => localStorage.getItem('pp-balance-hint-dismissed'))).toBe('true');
	});

	// Der mobile Viewport gilt für den ganzen Test — test.use wirkt nur auf Describe-Ebene.
	test.describe('mobile 375px', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		/**
		 * AK5: Element liegt mit seiner Bounding-Box vollständig im 375px-Viewport — die App-Shell
		 * clippt overflow-x, daher Bounding-Box statt scrollWidth. `boundingBox()` misst einmalig
		 * und kann im Render-Moment null liefern → in expect.poll nachmessen (Muster helpers.ts).
		 */
		const withinViewport = async (locator: Locator): Promise<void> => {
			await expect
				.poll(async () => {
					const box = await locator.boundingBox();
					return box !== null && box.x >= 0 && box.x + box.width <= 375;
				})
				.toBe(true);
		};

		test('AK5: Hinweis und beide Schalter liegen vollständig im 375px-Viewport', async ({ page }) => {
			await seedScene(page);

			await page.goto('/app/');
			await waitForStableView(page);
			await openTasksTab(page);

			await withinViewport(hint(page).first());
			await withinViewport(balanceSwitch(page));

			// Der Einstellungs-Schalter (Allgemein-Tab) ebenfalls ohne horizontalen Overflow.
			await page.goto('/app/settings/general');
			await withinViewport(page.getByRole('checkbox', { name: /Balance-Priorisierung/i }));
		});
	});
});
