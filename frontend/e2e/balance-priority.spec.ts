import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für die „Balance-Priorisierung" in der Aufgabenliste (Tab „Aufgaben").
 *
 * Ein Schalter in der Filterleiste sortiert die offene Liste nach virtueller Balance-Priorität
 * (Defizit-gewichtet, Rechenkern `frontend/src/lib/balancePriority.ts`), das P-Badge zeigt dann
 * die virtuelle Prio als `~P{n}`. Gerechnet wird live an der Datenlage; es gehen keinerlei
 * Schreibzugriffe auf `/api/v1/tasks` raus — die Server-`priority` bleibt unberührt.
 *
 * Wie die übrigen funktionalen Specs läuft dies gegen das echte Backend (In-Memory-DB,
 * Vite-Proxy); `/auth/me` authentifiziert die Fixture. Szenario: Der gesamte erledigte Aufwand
 * liegt in Säule B (eine erledigte Aufgabe zahlt voll dort ein) → Säule A ist unterversorgt
 * (Defizit 1). Task X (Original-Prio 1) zahlt in A, Task Y (Original-Prio 5) in B. Ohne
 * Balance-Modus steht Y (P5) über X (P1); im Balance-Modus kehrt sich das um.
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

	/** Legt einen Task über die echte API an (voll in eine Säule einzahlend) und liefert ihn zurück. */
	const createTask = async (page: Page, title: string, priority: number, pillarId: number | null): Promise<TaskDto> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				priority,
				estimatedEffort: 1,
				...(pillarId !== null ? { pillars: [{ pillarId, share: 100, confidence: 80 }] } : {}),
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
		const pillarsResponse = await page.request.get('/api/v1/pillars');
		expect(pillarsResponse.ok()).toBeTruthy();
		const pillars = ((await pillarsResponse.json()) as PillarDto[]).filter((pillar) => pillar.weight > 0);
		expect(pillars.length).toBeGreaterThanOrEqual(2);
		const [pillarA, pillarB] = pillars;

		// Gesamter erledigter Aufwand in Säule B → Säule A hat ihr volles Defizit.
		const doneTask = await createTask(page, uniqueTitle('Versorger'), 3, pillarB.id);
		await setDone(page, doneTask.id);

		const taskX = await createTask(page, uniqueTitle('X-Defizit'), 1, pillarA.id);
		const taskY = await createTask(page, uniqueTitle('Y-Versorgt'), 5, pillarB.id);
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

	test('sortiert nach Defizit, zeigt ~P-Badges, schreibt nichts und lässt sich zurückschalten', async ({ page }) => {
		const { taskX, taskY } = await seedScene(page);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Ohne Balance-Modus: Original-Prio bestimmt die Reihenfolge — Y (P5) über X (P1).
		await expect(item(page, taskX.id)).toBeVisible();
		await expect(item(page, taskY.id)).toBeVisible();
		expect(await yOf(page, taskY.id)).toBeLessThan(await yOf(page, taskX.id));

		const writes = recordTaskWrites(page);

		// Balance-Modus aktivieren — der Defizit-Task X rückt trotz Prio 1 nach oben.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).toBeChecked();
		await expect.poll(async () => (await yOf(page, taskX.id)) < (await yOf(page, taskY.id))).toBe(true);

		// Badge zeigt die virtuelle Prio, unterscheidbar per Tilde-Präfix (~P{n}).
		await expect(item(page, taskX.id).getByText('~P5')).toBeVisible();
		await expect(item(page, taskY.id).getByText('~P1')).toBeVisible();

		// Zurückschalten zeigt Original-Reihenfolge und Original-Badges wieder.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).not.toBeChecked();
		await expect.poll(async () => (await yOf(page, taskY.id)) < (await yOf(page, taskX.id))).toBe(true);
		await expect(item(page, taskY.id).getByText('P5')).toBeVisible();
		await expect(item(page, taskX.id).getByText('P1')).toBeVisible();

		// Während des gesamten Umschaltens ging kein Schreibrequest auf die Tasks raus.
		expect(writes).toEqual([]);
	});

	// Der mobile Viewport gilt für den ganzen Test — test.use wirkt nur auf Describe-Ebene.
	test.describe('mobile 375px', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test('375px: Der Schalter bleibt bedienbar und liegt vollständig im Viewport', async ({ page }) => {
			await seedScene(page);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await balanceSwitch(page).click();
			await expect(balanceSwitch(page)).toBeChecked();

			const switchBox = await balanceSwitch(page).boundingBox();
			expect(switchBox).not.toBeNull();
			// Die App-Shell clippt overflow-x (scrollWidth wäre strukturell ≤ Viewport) — daher
			// Bounding-Box-Prüfung: der Schalter liegt vollständig im 375px-Viewport.
			expect(switchBox!.x).toBeGreaterThanOrEqual(0);
			expect(switchBox!.x + switchBox!.width).toBeLessThanOrEqual(375);
		});
	});
});
