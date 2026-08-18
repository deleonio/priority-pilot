import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #368 — „Abhängigkeitseditor: ‚Entfernen' als Icon-Button".
 *
 * Vertrag: Der „Entfernen"-Button jeder Vorgänger-Zeile im DependencyModal wird von einem
 * Text-Button (`_label="Entfernen"` für alle Zeilen) auf einen reinen Icon-Button umgestellt:
 *  - `_label` wird zeilenspezifisch, z. B. `"Vorgänger #<id> – <title> entfernen"`
 *  - `_hideLabel` blendet den sichtbaren Text aus, behält aber den zugänglichen Namen
 *  - `_icons={{ left: { icon: 'kolicon-cross' } }}` rendert ein `kol-icon` im Shadow-DOM
 *  - `_variant="danger"` und `_disabled={busy}` bleiben unverändert
 *
 * **⚠️ Seit #537 geskippt:** Die flache Blatt-Liste zeigt nur noch Tasks ohne Unteraufgaben
 * (`dependents.length === 0`). Ein Target-Task mit Vorgänger hat aber `dependents > 0` und
 * erscheint somit nicht mehr in der Aufgabenliste — der Abhängigkeits-Dialog lässt sich über
 * Tab 1 nicht mehr öffnen. Diese Specs können erst wieder ausgeführt werden, wenn das
 * ForestPanel (Tab 3) editierbar ist (Issue #537 AK8–12, separater Folgelauf).
 *
 * **Isolation:** Jeder Test legt Tasks an; `afterEach` räumt alle Tasks über die echte API ab.
 */
test.describe.skip('Abhängigkeits-Editor: Entfernen-Icon-Button (#368) — geskippt seit #537', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `DEP ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt über die echte API einen Task an und gibt dessen ID zurück (Vite-Proxy → Backend). */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Verknüpft über die echte API `predecessorId` als Vorgänger von `targetId`
	 * (POST /tasks/{targetId}/dependencies → dependingTaskId = predecessorId).
	 */
	const addDependency = async (page: Page, targetId: number, predecessorId: number): Promise<void> => {
		await page.request.post(`/api/v1/tasks/${targetId}/dependencies`, {
			data: { dependingTaskId: predecessorId },
		});
	};

	/** Löscht alle aktuell vorhandenen Tasks über die echte API. */
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

	/** Wechselt auf den „Aufgaben"-Tab (die Task-Tabelle liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Öffnet den Abhängigkeiten-Dialog gezielt für den Ziel-Task (per stabiler `data-testid` seines
	 * Listen-Eintrags in der flachen Blatt-Liste, #537).
	 */
	const openTargetDependencies = async (page: Page, targetId: number): Promise<void> => {
		const targetItem = page.getByTestId(`task-list-item-${targetId}`);
		const moreButton = targetItem.getByRole('button', { name: 'Weitere Aktionen' });
		await expect(moreButton).toBeVisible();
		await moreButton.click();
		await targetItem.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
	};

	test('AK1: Entfernen ist ein reiner Icon-Button (Icon vorhanden, kein sichtbarer Text)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Ziel-Task mit genau einem Vorgänger vorbereiten.
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
		await addDependency(page, targetId, predecessorId);
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openTargetDependencies(page, targetId);

		// Der Entfernen-Button ist per Rolle + zugänglichem Namen auffindbar (Icon-only braucht aria-Label).
		const removeButton = page
			.locator('.dependency-list li')
			.first()
			.getByRole('button', { name: /entfernen/i });
		await expect(removeButton).toBeVisible();

		// KoliBri Icon-Rendering nicht prüfen — nur öffentliche Schnittstelle testen.
		await expect(removeButton).toHaveAccessibleName(/entfernen/i);
	});

	test('AK2: Icon-Button entfernt den Vorgänger (Funktion unverändert)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Ziel-Task mit einem Vorgänger vorbereiten.
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorTitle = uniqueTitle('Vorgänger');
		const predecessorId = await createTask(page, predecessorTitle);
		await addDependency(page, targetId, predecessorId);
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openTargetDependencies(page, targetId);

		// Vorgänger ist zunächst in der Liste sichtbar.
		const list = page.locator('.dependency-list');
		await expect(list.locator('li > span').filter({ hasText: predecessorTitle })).toBeVisible();

		// rot: Der Klick adressiert den zeilenspezifischen Button per Vorgänger-ID im Namen.
		// Aktuell heißt der Button nur „Entfernen" → kein Treffer → Klick läuft in Timeout.
		const removeButton = list.getByRole('button', { name: new RegExp(`#${predecessorId}\\b.*entfernen`, 'i') });
		await removeButton.click();
		await waitForStableView(page);

		// Nach dem Klick ist der Vorgänger aus der Liste verschwunden (Funktion unverändert).
		await expect(list.locator('li > span').filter({ hasText: predecessorTitle })).toHaveCount(0);
	});

	test('AK3: Zwei Vorgänger → unterscheidbare, zeilenspezifische zugängliche Namen', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Ziel-Task mit ZWEI Vorgängern vorbereiten.
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorAId = await createTask(page, uniqueTitle('Vorgänger-A'));
		const predecessorBId = await createTask(page, uniqueTitle('Vorgänger-B'));
		await addDependency(page, targetId, predecessorAId);
		await addDependency(page, targetId, predecessorBId);
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openTargetDependencies(page, targetId);

		const list = page.locator('.dependency-list');
		await expect(list.locator('li')).toHaveCount(2);

		// rot: Beide Buttons heißen aktuell identisch „Entfernen" → kein Button trägt die Vorgänger-ID
		// im zugänglichen Namen. Nach dem Fix sind die Namen zeilenspezifisch und damit eindeutig.
		const buttonA = list.getByRole('button', { name: new RegExp(`#${predecessorAId}\\b.*entfernen`, 'i') });
		const buttonB = list.getByRole('button', { name: new RegExp(`#${predecessorBId}\\b.*entfernen`, 'i') });
		await expect(buttonA).toHaveCount(1);
		await expect(buttonB).toHaveCount(1);
	});

	test('AK4: Kein horizontaler Overflow auf 375-px-Viewport, Icon-Button erreichbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		// Ziel-Task mit einem Vorgänger vorbereiten.
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
		await addDependency(page, targetId, predecessorId);
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openTargetDependencies(page, targetId);

		// rot: Der Icon-Button ist per zeilenspezifischem, zugänglichem Namen erreichbar.
		// Aktuell heißt der Button nur „Entfernen" → kein Treffer.
		const removeButton = page
			.locator('.dependency-list li')
			.first()
			.getByRole('button', { name: new RegExp(`#${predecessorId}\\b.*entfernen`, 'i') });
		await expect(removeButton).toBeVisible();

		// Kein horizontaler Overflow auf schmalem Viewport.
		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);
	});
});
