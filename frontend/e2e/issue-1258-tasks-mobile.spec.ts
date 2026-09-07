import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * Spec-Tests für #1258 „Aufgabenliste mobil responsive layouting" — die vier Akzeptanzkriterien
 * im Tab „Aufgaben" beim Referenz-Viewport 375px (docs/mobile-ui-rules.md):
 *
 *  1. Kein horizontales Scrollen — offene Liste UND erledigte Tabelle (letztere dort reduziert
 *     auf Titel + Aktion, Widerruf der #1020-Entscheidung; ausführlicher Vertrag in
 *     `completed-tasks.spec.ts`, AK-1 (#1258)).
 *  2. Mindestens vier offene Aufgaben gleichzeitig sichtbar (Zweizeilen-Modell:
 *     Titelzeile + Controls-Zeile mit Badges links, „…"-Button rechtsbündig).
 *  3. Titel bricht um statt seitlich abgeschnitten zu werden.
 *  4. Jeder Aktionsauslöser mindestens 44×44px (Touch-Target-Minimum).
 *
 * Wie `issue-1121-geo-badge-title.spec.ts` läuft diese Spec gegen das echte Backend
 * (In-Memory-DB, Vite-Proxy); Daten werden über die API angelegt, `afterEach` räumt auf.
 */
test.describe('Priority Pilot — #1258: Aufgaben-Tab mobil (375px)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #1258 ${label}`.slice(0, 30 - tail.length);
		return `${head} ${tail}`;
	};

	/** Legt einen Task über die echte API an; `status: 'Done'` markiert ihn direkt erledigt. */
	const createTaskViaApi = async (page: Page, title: string, status?: 'Done'): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, ...(status === undefined ? {} : { status }) },
		});
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
	});

	/** Öffnet den Aufgaben-Tab und stellt die Offen-Ansicht sicher (Umschalter idempotent). */
	const openTasksView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).uncheck();
		await waitForStableView(page);
	};

	const openCompletedView = async (page: Page): Promise<void> => {
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).check();
		await waitForStableView(page);
	};

	test('AK1: offene Aufgaben — kein horizontaler Überlauf bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createTaskViaApi(page, uniqueTitle('OhneScroll'));
		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const items = page.locator('.task-list-item');
		await expect(items).toHaveCount(1);
		const box = await items.first().boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width, 'Zeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);
	});

	test('AK2: mindestens vier offene Aufgaben gleichzeitig sichtbar (375×812)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const ids: number[] = [];
		for (let i = 0; i < 4; i += 1) {
			ids.push(await createTaskViaApi(page, uniqueTitle(`Sichtbar${i}`)));
		}
		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		// Vollständig sichtbar = Zeilen-Unterkante innerhalb des Viewports (812px) — gleichzeitig,
		// ohne zu scrollen.
		let fullyVisible = 0;
		for (const id of ids) {
			const box = await page.getByTestId(`task-list-item-${id}`).boundingBox();
			expect(box).not.toBeNull();
			if (box!.y + box!.height <= 812) fullyVisible += 1;
		}
		expect(fullyVisible, 'vier Aufgaben ohne Scrollen vollständig im Viewport').toBeGreaterThanOrEqual(4);
	});

	test('AK3: langer Titel bricht um, statt seitlich abgeschnitten zu werden', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		// Ein einziges, 108 Zeichen langes „Wort" ohne Leerzeichen — nur `overflow-wrap: anywhere`
		// (app.css, .task-tree-title) kann es in die Zeilenbreite zwingen; klassischer Umbruch nicht.
		const longWord = 'Titelumbruchpruefung'.repeat(6);
		const id = await createTaskViaApi(page, `${uniqueTitle('Lang')} ${longWord}`);
		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		// Der vollständige Titeltext ist gerendert (umgebrochen, nicht abgeschnitten) …
		await expect(row.getByText(longWord)).toBeVisible();
		// … und die Zeile läuft nicht aus dem Viewport.
		const box = await row.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});

	test('AK4: Aktionsauslöser mindestens 44×44px — „…"-Trigger und „Wieder öffnen"', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createTaskViaApi(page, uniqueTitle('OffenTarget'));
		await createTaskViaApi(page, uniqueTitle('DoneTarget'), 'Done');
		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		// Offene Aufgabe: „…"-Popover-Trigger (KoliBri erzwingt die 44px-Mindestgröße über
		// `--a11y-min-size` im Shadow-DOM — hier wird der Vertrag eingefroren). 0,5px-Toleranz
		// gegen Subpixel-Rundung.
		const moreBox = await page.getByRole('button', { name: 'Weitere Aktionen' }).first().boundingBox();
		expect(moreBox).not.toBeNull();
		expect(moreBox!.width, '„…"-Trigger mindestens 44px breit').toBeGreaterThanOrEqual(44 - 0.5);
		expect(moreBox!.height, '„…"-Trigger mindestens 44px hoch').toBeGreaterThanOrEqual(44 - 0.5);

		// Erledigte Aufgabe: „Wieder öffnen"-Icon-Button in der reduzierten Tabelle.
		await openCompletedView(page);
		const reopenButton = page.getByRole('button', { name: 'Wieder öffnen' }).first();
		await expect(reopenButton).toBeVisible();
		const reopenBox = await reopenButton.boundingBox();
		expect(reopenBox).not.toBeNull();
		expect(reopenBox!.width, '„Wieder öffnen" mindestens 44px breit').toBeGreaterThanOrEqual(44 - 0.5);
		expect(reopenBox!.height, '„Wieder öffnen" mindestens 44px hoch').toBeGreaterThanOrEqual(44 - 0.5);

		// Nebenbei: In der reduzierten Tabelle existiert kein horizontaler Scroll-Container
		// (Haupt-Vertrag in completed-tasks.spec.ts; hier als Invariante des selben Setups).
		const host = page.locator('.completed-tasks kol-table-stateful');
		await expect(host).toBeVisible();
		const { scroller } = await host.evaluate(measureHorizontalScroll);
		expect(scroller).toBeNull();
	});
});
