import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #704 — Aufgabenbaum-Layout.
 *
 * Spec: docs/spec/issue-704.md
 * Ziel: Saubere, strukturierte Darstellung des Aufgabenbaums mit klarer Hierarchie
 *
 * Baum-Richtung folgt dem etablierten #336-Vertrag (server/src/logics/tree.ts,
 * task-list-flat.spec.ts): Die Eltern-Aufgabe (Abhängige) steht oben, ihre
 * Unteraufgaben (= Vorgänger) sind darunter eingerückt.
 *
 * AK 1 — Aufgaben mit verschachtelter Struktur klar erkennbar (Indentation)
 * AK 2 — Einrückung/Indentation intuitiv
 * AK 3 — Kein visuelles Chaos
 *
 * Isolation: Jeder Test legt Tasks über die echte API an; afterEach räumt alle Tasks ab.
 */

test.describe('Aufgabenbaum-Layout (#704)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `TREE ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt über die echte API einen Task an und gibt dessen ID zurück. */
	const createTask = async (page: Page, title: string, priority: number = 3): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/** Verknüpft predecessorId als Vorgänger von targetId über die echte API. */
	const addDependency = async (page: Page, targetId: number, predecessorId: number): Promise<void> => {
		await page.request.post(`/api/v1/tasks/${targetId}/dependencies`, {
			data: { dependingTaskId: predecessorId },
		});
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

	/** Wechselt auf den Aufgabenwald-Tab. */
	const openForestTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgabenwald', exact: true }).click();
		await waitForStableView(page);
	};

	test.describe('AK 1 — Aufgaben mit verschachtelter Struktur klar erkennbar (#704)', () => {
		test('AK1a: Unteraufgabe (Vorgänger) ist visuell eingerückt (Indentation)', async ({ page }) => {
			// Setup: Zwei Aufgaben mit Abhängigkeit (Vorgänger → Ziel); das Ziel ist die
			// Eltern-Aufgabe, der Vorgänger ihre Unteraufgabe (#336-Semantik).
			const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
			const targetId = await createTask(page, uniqueTitle('Ziel'));
			await addDependency(page, targetId, predecessorId);
			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			// Beide Aufgaben müssen im Wald sichtbar sein
			const predecessorItem = page.getByTestId(`forest-node-${predecessorId}`);
			const targetItem = page.getByTestId(`forest-node-${targetId}`);

			await expect(predecessorItem).toBeVisible();
			await expect(targetItem).toBeVisible();

			// ROT: Die Unteraufgabe (Vorgänger) muss stärker eingerückt sein als die Eltern-Aufgabe
			// Die Einrückung wird über das margin-left des Container-Elements gemessen
			const predecessorIndent = await predecessorItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const targetIndent = await targetItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			// Die Unteraufgabe muss eine erkennbar größere Einrückung haben
			expect(predecessorIndent).toBeGreaterThan(targetIndent);
		});

		test('AK1b: Aufgaben gleicher Hierarchiestufe haben gleiche Einrückung', async ({ page }) => {
			// Setup: Ein Vorgänger mit zwei abhängigen Aufgaben auf gleicher Ebene
			const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
			const targetAId = await createTask(page, uniqueTitle('Ziel-A'));
			const targetBId = await createTask(page, uniqueTitle('Ziel-B'));
			await addDependency(page, targetAId, predecessorId);
			await addDependency(page, targetBId, predecessorId);
			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const targetAItem = page.getByTestId(`forest-node-${targetAId}`);
			const targetBItem = page.getByTestId(`forest-node-${targetBId}`);

			await expect(targetAItem).toBeVisible();
			await expect(targetBItem).toBeVisible();

			// ROT: Beide abhängigen Aufgaben müssen die gleiche Einrückung haben
			const targetAIndent = await targetAItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const targetBIndent = await targetBItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			expect(targetAIndent).toBe(targetBIndent);
		});

		test('AK1c: Tiefe Verschachtelung (3 Ebenen) bleibt lesbar', async ({ page }) => {
			// Setup: Drei Ebenen Tiefe (A → B → C)
			const taskAId = await createTask(page, uniqueTitle('A'));
			const taskBId = await createTask(page, uniqueTitle('B'));
			const taskCId = await createTask(page, uniqueTitle('C'));
			await addDependency(page, taskBId, taskAId);
			await addDependency(page, taskCId, taskBId);
			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const itemA = page.getByTestId(`forest-node-${taskAId}`);
			const itemB = page.getByTestId(`forest-node-${taskBId}`);
			const itemC = page.getByTestId(`forest-node-${taskCId}`);

			await expect(itemA).toBeVisible();
			await expect(itemB).toBeVisible();
			await expect(itemC).toBeVisible();

			// ROT: Einrückung muss mit jeder Unteraufgaben-Ebene zunehmen. Kette A → B → C
			// (B hängt von A ab, C von B): C ist die Wurzel, B ihre Unteraufgabe, A deren
			// Unteraufgabe — die Einrückung wächst also von C über B nach A (#336-Semantik).
			const indentA = await itemA.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const indentB = await itemB.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const indentC = await itemC.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			expect(indentA).toBeGreaterThan(indentB);
			expect(indentB).toBeGreaterThan(indentC);
		});
	});

	test.describe('AK 2 — Einrückung/Indentation intuitiv (#704)', () => {
		test('AK2a: Einrückung ist nicht zu groß (maximal 48px pro Ebene)', async ({ page }) => {
			// Setup: Zwei Ebenen
			const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
			const targetId = await createTask(page, uniqueTitle('Ziel'));
			await addDependency(page, targetId, predecessorId);
			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const predecessorItem = page.getByTestId(`forest-node-${predecessorId}`);
			const targetItem = page.getByTestId(`forest-node-${targetId}`);

			const predecessorIndent = await predecessorItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const targetIndent = await targetItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const indentDifference = predecessorIndent - targetIndent;

			// ROT: Die Einrückungsdifferenz sollte nicht größer als 48px sein (zu viel Platz)
			expect(indentDifference).toBeLessThanOrEqual(48);

			// ROT: Die Einrückungsdifferenz sollte mindestens 16px sein (erkennbar, aber nicht zu wenig)
			expect(indentDifference).toBeGreaterThanOrEqual(16);
		});

		test('AK2b: Flache Liste hat keine Einrückung (baseline)', async ({ page }) => {
			// Setup: Nur eine Aufgabe ohne Abhängigkeiten
			const taskId = await createTask(page, uniqueTitle('Solo'));
			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const taskItem = page.getByTestId(`forest-node-${taskId}`);
			await expect(taskItem).toBeVisible();

			// ROT: Eine Aufgabe ohne Vorgänger sollte keine oder minimale Einrückung haben
			const indent = await taskItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			// Maximal 8px Abstand für baseline-Aufgaben
			expect(indent).toBeLessThanOrEqual(8);
		});
	});

	test.describe('AK 3 — Kein visuelles Chaos (#704)', () => {
		test('AK3a: Whitespace bleibt bei vielen Aufgaben erhalten', async ({ page }) => {
			// Setup: 5 Aufgaben auf gleicher Ebene (Test für Whitespace-Erhalt)
			const parentTaskId = await createTask(page, uniqueTitle('Parent'));
			const childIds: number[] = [];

			for (let i = 0; i < 5; i++) {
				const childId = await createTask(page, uniqueTitle(`Child-${i}`));
				await addDependency(page, childId, parentTaskId);
				childIds.push(childId);
			}

			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			// ROT: Alle Aufgaben sollten sichtbar sein
			for (const childId of childIds) {
				await expect(page.getByTestId(`forest-node-${childId}`)).toBeVisible();
			}

			// ROT: Kein horizontaler Overflow (Scrollbalken) auf Desktop-Viewport
			const hasOverflow = await page.evaluate(() => {
				const doc = document.documentElement;
				return doc.scrollWidth > doc.clientWidth;
			});

			expect(hasOverflow).toBe(false);
		});

		test('AK3b: Aufgaben sind nicht überlappend (vertical spacing)', async ({ page }) => {
			// Setup: Zwei Aufgaben auf gleicher Ebene
			const parentTaskId = await createTask(page, uniqueTitle('Parent'));
			const childAId = await createTask(page, uniqueTitle('Child-A'));
			const childBId = await createTask(page, uniqueTitle('Child-B'));
			await addDependency(page, childAId, parentTaskId);
			await addDependency(page, childBId, parentTaskId);

			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const itemA = page.getByTestId(`forest-node-${childAId}`);
			const itemB = page.getByTestId(`forest-node-${childBId}`);

			await expect(itemA).toBeVisible();
			await expect(itemB).toBeVisible();

			// ROT: Die Aufgaben sollten sich nicht überlappen (positiver vertikaler Abstand)
			const boxA = await itemA.boundingBox();
			const boxB = await itemB.boundingBox();

			expect(boxA).not.toBeNull();
			expect(boxB).not.toBeNull();

			if (boxA && boxB) {
				const verticalDistance = Math.abs(boxA.y - boxB.y);
				// Mindestens 20px vertikaler Abstand (kein Überlappen)
				expect(verticalDistance).toBeGreaterThanOrEqual(20);
			}
		});
	});

	test.describe('Randfälle — Mobilansicht (#704)', () => {
		test('Mobile: Hierarchie bleibt auf schmalen Viewport erkennbar', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 812 });

			// Setup: Zwei Ebenen
			const predecessorId = await createTask(page, uniqueTitle('Vorgänger'));
			const targetId = await createTask(page, uniqueTitle('Ziel'));
			await addDependency(page, targetId, predecessorId);

			await page.goto('/');
			await waitForStableView(page);

			await openForestTab(page);

			const predecessorItem = page.getByTestId(`forest-node-${predecessorId}`);
			const targetItem = page.getByTestId(`forest-node-${targetId}`);

			await expect(predecessorItem).toBeVisible();
			await expect(targetItem).toBeVisible();

			// ROT: Auch auf Mobil muss die Hierarchie erkennbar sein (Einrückung der Unteraufgabe)
			const predecessorIndent = await predecessorItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			const targetIndent = await targetItem.evaluate((el: Element) => {
				const styles = window.getComputedStyle(el);
				return parseInt(styles.marginLeft || '0', 10);
			});

			expect(predecessorIndent).toBeGreaterThan(targetIndent);
		});
	});
});
