import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für den Aufgabengraphen im Tab „Wald" — die Nachfolge der Baumdarstellung
 * (`ForestPanel`, zuvor abgedeckt von `issue-704-tree-layout.spec.ts` und
 * `issue-1027-forest-card-spacing.spec.ts`).
 *
 * Die Absichten der abgelösten Specs leben hier weiter:
 * - #704 „verschachtelte Struktur klar erkennbar": im Graphen über getrennte Ebenen (y-Positionen)
 *   und sichtbare Kanten statt über Einrückung.
 * - #1027 AK2 „kein Clipping bei 375 px": derselbe Bounding-Box-Test, jetzt gegen den Canvas.
 *
 * Neu und fachlicher Kern des Umbaus: eine Aufgabe mit zwei übergeordneten Aufgaben erscheint
 * genau einmal (der Baum musste sie duplizieren), und das Kantengewicht ist sichtbar.
 *
 * Isolation: Jeder Test legt Tasks über die echte API an; afterEach räumt alle Tasks ab.
 */
test.describe('Aufgabengraph (Tab „Wald")', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `GRAPH ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	const createTask = async (page: Page, title: string, priority: number = 3): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/** Verknüpft predecessorId als Vorgänger (Unteraufgabe) von targetId, optional mit Gewicht. */
	const addDependency = async (page: Page, targetId: number, predecessorId: number, weight?: number): Promise<void> => {
		await page.request.post(`/api/v1/tasks/${targetId}/dependencies`, {
			data: { dependingTaskId: predecessorId, ...(weight === undefined ? {} : { weight }) },
		});
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

	const openGraphTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Wald', exact: true }).click();
		await waitForStableView(page);
	};

	test('Knoten und Kantengewicht sind sichtbar', async ({ page }) => {
		const childId = await createTask(page, uniqueTitle('Vorgänger'));
		const parentId = await createTask(page, uniqueTitle('Ziel'));
		await addDependency(page, parentId, childId, 0.5);

		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		await expect(page.getByTestId(`graph-node-${childId}`)).toBeVisible();
		await expect(page.getByTestId(`graph-node-${parentId}`)).toBeVisible();
		// Das Gewicht steht als Zahl an der Kante — die Strichstärke allein trägt die Information nicht.
		await expect(page.getByTestId('task-graph-canvas').getByText('0,5', { exact: true })).toBeVisible();
	});

	test('Die Unteraufgabe steht über der Aufgabe, die sie ermöglicht', async ({ page }) => {
		// Ersetzt die Einrückungs-ACs aus #704: die Hierarchie zeigt sich jetzt über die Ebenen.
		const childId = await createTask(page, uniqueTitle('Unten'));
		const parentId = await createTask(page, uniqueTitle('Oben'));
		await addDependency(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		const childBox = await page.getByTestId(`graph-node-${childId}`).boundingBox();
		const parentBox = await page.getByTestId(`graph-node-${parentId}`).boundingBox();
		expect(childBox).not.toBeNull();
		expect(parentBox).not.toBeNull();
		expect(childBox!.y).toBeLessThan(parentBox!.y);
	});

	test('Eine Aufgabe mit zwei übergeordneten Aufgaben erscheint genau einmal', async ({ page }) => {
		const sharedId = await createTask(page, uniqueTitle('Geteilt'));
		const firstParentId = await createTask(page, uniqueTitle('Eltern A'));
		const secondParentId = await createTask(page, uniqueTitle('Eltern B'));
		await addDependency(page, firstParentId, sharedId);
		await addDependency(page, secondParentId, sharedId);

		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		// Im alten Wald stand „Geteilt" zweimal — einmal je Teilbaum.
		await expect(page.getByTestId(`graph-node-${sharedId}`)).toHaveCount(1);
		await expect(page.getByTestId(`graph-node-${firstParentId}`)).toBeVisible();
		await expect(page.getByTestId(`graph-node-${secondParentId}`)).toBeVisible();
	});

	test('Die Ansichts-Buttons erfüllen die 44-px-Regel', async ({ page }) => {
		await createTask(page, uniqueTitle('Solo'));
		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		for (const label of ['Ansicht einpassen', 'Vergrößern', 'Verkleinern']) {
			const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
			expect(box, `Button „${label}" muss eine Bounding-Box haben`).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('Die Listenfassung trägt alle Knoten samt Gewicht', async ({ page }) => {
		const childId = await createTask(page, uniqueTitle('Vorgänger'));
		const parentId = await createTask(page, uniqueTitle('Ziel'));
		await addDependency(page, parentId, childId, 0.5);

		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		// Die Liste steht immer im DOM (nur eingeklappt) — sie ist der barrierefreie Zugang zum Graphen.
		const parentItem = page.getByTestId(`graph-list-item-${parentId}`);
		await expect(parentItem).toBeAttached();
		await expect(page.getByTestId(`graph-list-item-${childId}`)).toBeAttached();
		expect(await parentItem.textContent()).toContain('Gewicht 0,5');
	});

	test('Ein Klick auf einen Knoten öffnet Details und von dort den Abhängigkeits-Dialog', async ({ page }) => {
		const taskId = await createTask(page, uniqueTitle('Detail'));
		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		await page.getByTestId(`graph-node-${taskId}`).click();
		const detailButton = page.getByRole('button', { name: 'Abhängigkeiten bearbeiten', exact: true });
		await expect(detailButton).toBeVisible();

		await detailButton.click();
		await expect(page.getByText('Aktuelle Vorgänger')).toBeVisible();
	});

	test('Bei 375 px bleibt der Graph in der Viewportbreite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const childId = await createTask(page, uniqueTitle('Mobil Eins'));
		const parentId = await createTask(page, uniqueTitle('Mobil Zwei'));
		await addDependency(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openGraphTab(page);

		const canvas = page.getByTestId('task-graph-canvas');
		await expect(canvas).toBeVisible();

		const box = await canvas.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		// Kein horizontaler Seiten-Scroll: der Canvas clippt seinen Inhalt selbst.
		const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
		expect(hasOverflow).toBe(false);
	});
});
