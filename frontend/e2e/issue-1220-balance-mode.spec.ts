import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für #1220 — „Balance-Priorisierung" in der Aufgabenliste (Tab „Aufgaben").
 *
 * Tests zur Spec `docs/spec/issue-1220.md` (AK1–AK6): Ein Schalter in der Filterleiste
 * sortiert die offene Liste nach virtueller Balance-Priorität (Defizit-gewichtet, Rechenkern
 * `frontend/src/lib/balancePriority.ts`), das P-Badge zeigt die virtuelle Prio als `~P{n}`,
 * „Neu berechnen" ersetzt den eingefrorenen Stand (Snapshot-Semantik), und es gehen
 * keinerlei Schreibzugriffe auf `/api/v1/tasks` raus — die Server-`priority` bleibt unberührt.
 *
 * AK6 nagelt die Aufgabenteilung fest: Der Schalter wechselt nur die Sicht (lädt nichts), der
 * Button setzt nur den Stand neu (schaltet nichts). Beide Zuständigkeiten überlappten sich
 * ursprünglich, wodurch Schalter und Button aus verschiedenen Datenquellen rechneten.
 *
 * Wie die übrigen funktionalen Specs läuft dies gegen das echte Backend (In-Memory-DB,
 * Vite-Proxy); `/auth/me` authentifiziert die Fixture. Szenario: Der gesamte erledigte Aufwand
 * liegt in Säule B (eine erledigte Aufgabe zahlt voll dort ein) → Säule A ist unterversorgt
 * (Defizit 1). Task X (Original-Prio 1) zahlt in A, Task Y (Original-Prio 5) in B. Ohne
 * Balance-Modus steht Y (P5) über X (P1); im Balance-Modus kehrt sich das um.
 *
 * `data-testid`-Konvention: `task-list-item-{id}` pro Blatt-Aufgabe (#537).
 */
test.describe('#1220 Balance-Priorisierung in der Aufgabenliste', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E-1220-${label} #${(runId += 1)}`;

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
	const seedScene = async (
		page: Page,
	): Promise<{ pillarA: PillarDto; pillarB: PillarDto; taskX: TaskDto; taskY: TaskDto }> => {
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
		return { pillarA, pillarB, taskX, taskY };
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

	const rebalanceButton = (page: Page) => page.getByRole('button', { name: /Neu berechnen/i });

	/** Der aria-live-Hinweis mit dem Stand der Sortierung (trägt auch den Veraltet-Zusatz). */
	const balanceHint = (page: Page) =>
		page
			.locator('[aria-live="polite"]')
			.filter({ hasText: /sortiert/i })
			.first();

	/** Vertikalposition eines Listen-Eintrags (px von oben) — kleinere y = weiter oben in der Liste. */
	const yOf = async (page: Page, id: number): Promise<number> => {
		const box = await item(page, id).boundingBox();
		expect(box).not.toBeNull();
		return box!.y;
	};

	/** Registriert einen Mitschnitt aller Schreibrequests auf /api/v1/tasks (AK3: es darf keiner rausgehen). */
	const recordTaskWrites = (page: Page): string[] => {
		const writes: string[] = [];
		page.on('request', (request) => {
			if (/\/api\/v1\/tasks/.test(request.url()) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
				writes.push(`${request.method()} ${request.url()}`);
			}
		});
		return writes;
	};

	test('AK1+AK3+AK4: Sortierung nach Defizit, virtuelles ~P-Badge, keine Schreibzugriffe, umschaltbar', async ({
		page,
	}) => {
		const { taskX, taskY } = await seedScene(page);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Ohne Balance-Modus: Original-Prio bestimmt die Reihenfolge — Y (P5) über X (P1).
		await expect(item(page, taskX.id)).toBeVisible();
		await expect(item(page, taskY.id)).toBeVisible();
		expect(await yOf(page, taskY.id)).toBeLessThan(await yOf(page, taskX.id));

		const writes = recordTaskWrites(page);

		// AK1: Balance-Modus aktivieren — der Defizit-Task X rückt trotz Prio 1 nach oben.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).toBeChecked();
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));

		// AK3: Badge zeigt die virtuelle Prio, unterscheidbar per Tilde-Präfix (~P{n}).
		await expect(item(page, taskX.id).getByText('~P5')).toBeVisible();
		await expect(item(page, taskY.id).getByText('~P1')).toBeVisible();

		// AK4: Zurückschalten zeigt Original-Reihenfolge und Original-Badges wieder.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).not.toBeChecked();
		expect(await yOf(page, taskY.id)).toBeLessThan(await yOf(page, taskX.id));
		await expect(item(page, taskY.id).getByText('P5')).toBeVisible();
		await expect(item(page, taskX.id).getByText('P1')).toBeVisible();

		// AK4: Erneutes Aktivieren liefert wieder die Balance-Sortierung (Werte blieben getrennt erhalten).
		await balanceSwitch(page).click();
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));
		await expect(item(page, taskX.id).getByText('~P5')).toBeVisible();

		// AK3: Während des gesamten Umschaltens ging kein Schreibrequest auf die Tasks raus.
		expect(writes).toEqual([]);
	});

	test('AK2: „Neu berechnen" ersetzt den eingefrorenen Stand — Anzeige folgt erst auf den Klick', async ({ page }) => {
		const { pillarA, taskX, taskY } = await seedScene(page);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Balance-Modus: Der Stand lief bis hierher mit, das Einschalten friert ihn ein — X (Defizit) über Y.
		await balanceSwitch(page).click();
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));
		await expect(balanceHint(page)).toBeVisible();
		await expect(balanceHint(page)).not.toContainText('Daten haben sich geändert');

		// Datenbasis extern kippen: Eine erledigte Aufgabe zahlt jetzt auch in Säule A ein →
		// Ist-Anteil von A steigt, ihr Defizit fällt auf 0 (Soll ≤ Ist-Anteil).
		const lateSupplier = await createTask(page, uniqueTitle('Nachzügler'), 3, pillarA.id);
		await setDone(page, lateSupplier.id);

		// Snapshot-Semantik: Die angezeigte Reihenfolge bleibt eingefroren — kein automatisches
		// Nachziehen, obwohl sich die Datenbasis geändert hat.
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));

		// Klick auf „Neu berechnen" ersetzt den Stand sichtbar: Beide Defizite sind nun
		// 0 → Sekundärkriterium Original-Prio → Y (P5) über X (P1).
		// Test-Pflege (#1220, Impl-Phase): Der Klick lädt die Datenbasis neu (GET) und committet
		// erst danach — ein einzelner Read unmittelbar nach dem Klick racet gegen den Netzwerk-
		// Roundtrip und flakt. Geprüft bleibt dieselbe Aussage (Y über X), nur als erwartungsvoller
		// Poll (Repo-Muster: PR #1079, MEMORY 2026-08-28).
		await rebalanceButton(page).click();
		await expect.poll(async () => (await yOf(page, taskY.id)) < (await yOf(page, taskX.id))).toBe(true);

		// Der Modus bleibt an — der Button setzt nur den Stand neu, er schaltet nichts um.
		await expect(balanceSwitch(page)).toBeChecked();
	});

	test('Veralteter Stand wird ausgewiesen, sobald sich die Datenlage in der App ändert', async ({ page }) => {
		const { taskX, taskY } = await seedScene(page);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await balanceSwitch(page).click();
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));
		await expect(balanceHint(page)).not.toContainText('Daten haben sich geändert');

		// Eine Aufgabe in der App erledigen: Ihr Aufwand zählt ab jetzt zum Ist ihrer Säule, das
		// Defizit verschiebt sich. Der eingefrorene Stand bildet das nicht mehr ab — genau das
		// meldet der Hinweis, damit erkennbar ist, wann „Neu berechnen" etwas ändern würde.
		// Der Erledigt-Toggle liegt hinter dem Aktionen-Popover der Zeile (#387, Muster balance.spec.ts).
		await page
			.getByRole('button', { name: /Weitere Aktionen/i })
			.first()
			.click();
		const doneButton = page.getByRole('button', { name: 'Erledigt' }).first();
		await expect(doneButton).toBeVisible();
		await doneButton.click();

		await expect(balanceHint(page)).toContainText('Daten haben sich geändert');

		// Die Reihenfolge zieht dabei nicht von selbst nach (AK2 gilt weiter).
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));

		// Erst „Neu berechnen" übernimmt die neue Lage — danach ist der Stand wieder aktuell.
		await rebalanceButton(page).click();
		await expect(balanceHint(page)).not.toContainText('Daten haben sich geändert');
	});

	test('AK6: Schalter wechselt nur die Sicht, „Neu berechnen" setzt nur den Stand neu', async ({ page }) => {
		const { taskX, taskY } = await seedScene(page);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Außerhalb des Modus gibt es nichts neu zu berechnen — der Stand läuft ohnehin mit.
		await expect(rebalanceButton(page)).toHaveCount(0);

		// Der Schalter wechselt nur die Sicht: Er sortiert sofort um, ohne Daten nachzuladen.
		const taskReads: string[] = [];
		page.on('request', (request) => {
			if (/\/api\/v1\/tasks(\?|$)/.test(request.url()) && request.method() === 'GET') {
				taskReads.push(request.url());
			}
		});
		await balanceSwitch(page).click();
		expect(await yOf(page, taskX.id)).toBeLessThan(await yOf(page, taskY.id));
		expect(taskReads).toEqual([]);

		// Der Button lädt die Datenbasis nach, lässt den Schalter aber unangetastet.
		await expect(rebalanceButton(page)).toBeVisible();
		await rebalanceButton(page).click();
		await expect.poll(() => taskReads.length).toBeGreaterThan(0);
		await expect(balanceSwitch(page)).toBeChecked();

		// Ausschalten blendet den Button wieder aus — er hat außerhalb des Modus keine Wirkung.
		await balanceSwitch(page).click();
		await expect(balanceSwitch(page)).not.toBeChecked();
		await expect(rebalanceButton(page)).toHaveCount(0);
	});

	// AK5 braucht den mobilen Viewport für den ganzen Test — test.use wirkt nur auf Describe-Ebene.
	test.describe('mobile 375px', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test('AK5 (375px): Schalter, Stand-Hinweis und „Neu berechnen“ bleiben bedienbar, kein Clipping', async ({
			page,
		}) => {
			await seedScene(page);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Der Schalter schaltet den Modus an — erst damit erscheinen Hinweis und Button.
			await balanceSwitch(page).click();
			await expect(balanceSwitch(page)).toBeChecked();
			await expect(rebalanceButton(page)).toBeVisible();

			const switchBox = await balanceSwitch(page).boundingBox();
			const hintBox = await balanceHint(page).boundingBox();
			const buttonBox = await rebalanceButton(page).boundingBox();
			expect(switchBox).not.toBeNull();
			expect(hintBox).not.toBeNull();
			expect(buttonBox).not.toBeNull();

			// Die App-Shell clippt overflow-x (scrollWidth wäre strukturell ≤ Viewport) — daher
			// Bounding-Box-Prüfung: alle drei liegen vollständig im 375px-Viewport.
			for (const box of [switchBox!, hintBox!, buttonBox!]) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(375);
			}
		});
	});
});
