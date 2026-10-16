import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * #1258 Desktop-Fortführung (PR #2663): Ab 48rem sitzt der „…"-Popover-Button konstant am
 * rechten Rand der Aufgabenzeile — im Einzeilen-Layout wie in der umbrochenen Controls-Zeile
 * (langer Titel + Badge-Zuwachs, der #376-Fall). boundingBox statt scrollWidth (die App-Shell
 * clippt overflow-x, Muster `issue-1258-tasks-mobile.spec.ts`); Referenz ist `.task-tree-row`
 * als Flex-Container der Zeile.
 *
 * Toleranz: hinter dem Button steht die dauerhaft gemountete Done-Feedback-Live-Region
 * (#2526/#2572) und kostet im Leerzustand den Zeilen-Gap (`--task-tree-row-gap` = 8px) — die
 * Button-Rechtskante darf also höchstens einen Gap vom Zeilenrand entfernt sein. Genau diese
 * Kombination (beide Layouts, beide Kanten) hätte das anfängliche No-Op des `margin-left: auto`
 * im content-sized Controls-Container aufgedeckt.
 */
test.describe('Balamentum — Aufgaben-Tab ab 48rem: „…"-Button rechtsbündig', () => {
	/** Zeilen-Gap (8px) + 1px Rundung. */
	const RIGHT_EDGE_TOLERANCE_PX = 9;

	/** Button-Rechtskante an der Zeilen-Rechtskante (pollt: `boundingBox()` misst einmalig). */
	const expectRightAligned = async (row: Locator, button: Locator): Promise<void> => {
		await expect
			.poll(async () => {
				const rowBox = await row.boundingBox();
				const btnBox = await button.boundingBox();
				if (rowBox === null || btnBox === null) return false;
				const overshoot = btnBox.x + btnBox.width - (rowBox.x + rowBox.width);
				return overshoot <= 0.5 && overshoot >= -RIGHT_EDGE_TOLERANCE_PX;
			})
			.toBe(true);
	};

	/** Legt einen Task über die echte API an; liefert seine ID. */
	const createTaskViaApi = async (page: Page, data: Record<string, unknown>): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', { data });
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	/** Räumt alle Tasks über die echte API ab. */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		const categories = (await (await page.request.get('/api/v1/categories')).json()) as {
			id: number;
			name: string;
		}[];
		for (const category of categories.filter((entry) => entry.name.startsWith('E2E-Rechts-'))) {
			await page.request.delete(`/api/v1/categories/${category.id}`);
		}
	});

	/** Öffnet den Aufgaben-Tab und stellt die Offen-Ansicht sicher (Umschalter idempotent). */
	const openTasksView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).uncheck();
		await waitForStableView(page);
	};

	test('Einzeilen-Layout: „…"-Button an der Zeilen-Rechtskante (900px)', async ({ page }) => {
		await page.setViewportSize({ width: 900, height: 812 });
		const id = await createTaskViaApi(page, { title: 'E2E Rechtsbuendig Einzeilig', priority: 3 });
		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row).toBeVisible();
		const header = row.locator('.task-tree-row-header');
		const controls = row.locator('.task-tree-row-controls');

		// Vorbedingung Einzeilig: Header und Controls überlappen vertikal (dieselbe Flex-Zeile)
		// und das Desktop-Layout ist aktiv (mobil wäre justify-content: space-between).
		await expect
			.poll(async () => {
				const headerBox = await header.boundingBox();
				const controlsBox = await controls.boundingBox();
				if (headerBox === null || controlsBox === null) return false;
				return headerBox.y < controlsBox.y + controlsBox.height && controlsBox.y < headerBox.y + headerBox.height;
			})
			.toBe(true);
		expect(await controls.evaluate((el) => getComputedStyle(el).justifyContent)).toBe('flex-start');

		await expectRightAligned(row, row.locator('.task-tree-actions'));
	});

	test('Umbrochene Controls-Zeile: „…"-Button an der Zeilen-Rechtskante (800px)', async ({ page }) => {
		await page.setViewportSize({ width: 800, height: 812 });
		// Badge-Zuwachs über Kategorie + Checkliste vergrößert die hypothetische Controls-Breite,
		// damit der lange Titel die Controls-Zeile zuverlässig umbrechen lässt (Zeilenumbruch
		// entscheidet an den Flex-Basis-Größen, nicht an den geschrumpften).
		const category = await page.request.post('/api/v1/categories', {
			data: { name: 'E2E-Rechts-Kategorie', color: '#1064d0' },
		});
		expect(category.ok()).toBeTruthy();
		const categoryId = ((await category.json()) as { id: number }).id;
		const checklist = [1, 2, 3].map((number) => ({ id: crypto.randomUUID(), title: `Punkt ${number}` }));
		// 64-Zeichen-Titel (Server-Limit 65, Muster issue-1258 AK3): maximal breiter Header.
		const title = 'Umbrochen'.padEnd(64, 'x');
		const id = await createTaskViaApi(page, { title, priority: 3, categoryId, checklist });
		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row).toBeVisible();
		const header = row.locator('.task-tree-row-header');
		const controls = row.locator('.task-tree-row-controls');

		// Vorbedingung Umbruch: die Controls-Zeile liegt GANZ unter dem Header und das
		// Desktop-Layout ist aktiv (mobil wäre justify-content: space-between).
		await expect
			.poll(async () => {
				const headerBox = await header.boundingBox();
				const controlsBox = await controls.boundingBox();
				if (headerBox === null || controlsBox === null) return false;
				return controlsBox.y >= headerBox.y + headerBox.height - 1;
			})
			.toBe(true);
		expect(await controls.evaluate((el) => getComputedStyle(el).justifyContent)).toBe('flex-start');

		await expectRightAligned(row, row.locator('.task-tree-actions'));
	});
});
