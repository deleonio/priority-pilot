import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #1027 — Vertikaler Abstand der Aufgaben-Cards im „Wald"-Tab.
 *
 * Spec: docs/spec/issue-1027.md
 * Ziel: Top-Level-Aufgaben-Cards im Wald sind mit deutlich mehr vertikaler
 * Lücke (≥ 24 px) klar getrennt, ohne horizontales Clipping (375 px) und
 * ohne Änderung an Einrückung/Hierarchie (AK3 = bestehende #704-Tests).
 *
 * AK1 — Lücke zwischen aufeinanderfolgenden Top-Level-Cards ≥ 24 px (rot bis zur CSS-Anpassung)
 * AK2 — 375 px: keine Wald-Card verlässt die Viewportbreite (Regressionsschutz)
 * AK3 — dedup: durch unverändert grüne #704-Tests abgedeckt (kein neuer Test).
 *
 * Isolation: Jeder Test legt Tasks über die echte API an; afterEach räumt alle Tasks ab.
 */

test.describe('Wald-Card-Abstand (#1027)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `GAP ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt über die echte API einen Task an und gibt dessen ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/** Löscht alle Tasks über die echte API. */
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

	/** Wechselt auf den Aufgabenwald-Tab (Label „Wald"). */
	const openForestTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Wald', exact: true }).click();
		await waitForStableView(page);
	};

	test('AK1: Lücke zwischen aufeinanderfolgenden Top-Level-Cards beträgt mindestens 24 px', async ({ page }) => {
		// Setup: Zwei unabhängige Tasks (keine Abhängigkeiten) → zwei Top-Level-Bäume,
		// deren Cards im Wald untereinander stehen.
		const firstId = await createTask(page, uniqueTitle('Erster Baum'));
		const secondId = await createTask(page, uniqueTitle('Zweiter Baum'));

		await page.goto('/');
		await waitForStableView(page);

		await openForestTab(page);

		const firstCard = page.getByTestId(`forest-node-${firstId}`);
		const secondCard = page.getByTestId(`forest-node-${secondId}`);

		await expect(firstCard).toBeVisible();
		await expect(secondCard).toBeVisible();

		// ROT: Die Leerraum-Lücke (Unterkante der oberen Card bis Oberkante der
		// unteren) muss mindestens 24 px betragen — Ist sind ca. 12 px.
		const boxes = [await firstCard.boundingBox(), await secondCard.boundingBox()];
		expect(boxes[0]).not.toBeNull();
		expect(boxes[1]).not.toBeNull();

		const sorted = boxes
			.filter((box): box is { x: number; y: number; width: number; height: number } => box !== null)
			.sort((a, b) => a.y - b.y);
		const gap = sorted[1].y - (sorted[0].y + sorted[0].height);

		expect(gap).toBeGreaterThanOrEqual(24);
	});

	test('AK2: Bei 375 px verlässt keine Wald-Card die Viewportbreite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Setup: Zwei unabhängige Top-Level-Bäume, deren Abstand erhöht wird.
		await createTask(page, uniqueTitle('Mobil Eins'));
		await createTask(page, uniqueTitle('Mobil Zwei'));

		await page.goto('/');
		await waitForStableView(page);

		await openForestTab(page);

		const cards = page.locator('[data-testid^="forest-node-"]');
		await expect(cards.first()).toBeVisible();

		// Kein horizontales Clipping: Jede Card bleibt komplett innerhalb des
		// 375-px-Viewports (Bounding-Box statt scrollWidth — die Shell clippt
		// mit overflow-x: hidden, ein scrollWidth-Vergleich wäre falsch-grün).
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(2);

		const viewportWidth = 375;
		for (let i = 0; i < count; i += 1) {
			const box = await cards.nth(i).boundingBox();
			expect(box, `Card ${i} muss eine Bounding-Box haben`).not.toBeNull();
			if (box) {
				expect(box.x, `Card ${i} darf nicht links aus dem Viewport ragen`).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width, `Card ${i} darf nicht rechts aus dem 375-px-Viewport ragen`).toBeLessThanOrEqual(
					viewportWidth + 1,
				);
			}
		}
	});
});
