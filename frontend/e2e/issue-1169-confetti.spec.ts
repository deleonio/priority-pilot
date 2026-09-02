import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für #1169 — Konfetti beim Erledigt-Switch („…"-Popover, beide TaskTree-Stellen).
 *
 * Spezifikation: `docs/spec/issue-1169.md`. Das Konfetti existiert noch nicht → RED:
 * `confetti-overlay` trifft in keinem Test, alle Specs laufen in ihren Ziel-Assertionen rot.
 *
 * Konventionen wie `done-toggle.spec.ts`: echtes Backend (In-Memory-DB, Vite-Proxy),
 * API-Seed pro Test, `afterEach` räumt alle Tasks ab. Das Overlay wird ausschließlich über
 * `data-testid="confetti-overlay"` adressiert — die Render-Technik (Canvas/DOM) ist der
 * Umsetzung überlassen und darf von diesen Tests nicht geprüft werden.
 *
 * Ruckel-Freiheit auf Mobil (AK4) ist architektonisch gesichert (rAF + feste moderate
 * Partikelzahl, Canvas auf Viewportgröße — s. Spec); eine objektive Frame-Metrik ist in der
 * CI-Umgebung nicht zuverlässig messbar, deshalb prüft TF4 Durchlaufen + Bedienbarkeit.
 */
test.describe('Priority Pilot — Konfetti beim Erledigt-Toggle (#1169)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `Konfetti ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	const fetchStatus = async (page: Page, id: number): Promise<string> => {
		const response = await page.request.get(`/api/v1/tasks/${id}`);
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { status: string };
		return task.status;
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

	const doneToggle = (page: Page, id: number) =>
		item(page, id)
			.locator('[role="toolbar"]')
			.getByRole('button', { name: /Erledigt|Wieder öffnen/i });

	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	/** Das Konfetti-Overlay — der einzige Vertragspunkt zwischen Spec und Umsetzung. */
	const confetti = (page: Page) => page.getByTestId('confetti-overlay');

	/** Öffnet die Aufgaben-Liste und legt eine frisch seedete offene Aufgabe bereit. */
	const seedOpenTask = async (page: Page, label: string): Promise<number> => {
		const id = await createTask(page, uniqueTitle(label));
		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();
		return id;
	};

	test('AK1: Klick auf „Erledigt" startet ein Konfetti-Overlay über den gesamten Viewport', async ({ page }) => {
		const id = await seedOpenTask(page, 'Start');

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		await expect(confetti(page)).toBeVisible();

		// „Über den gesamten Viewport": das Overlay beginnt oben links und deckt Breite/Höhe ab.
		const box = await confetti(page).boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.x).toBeLessThanOrEqual(1);
			expect(box.y).toBeLessThanOrEqual(1);
			expect(box.x + box.width).toBeGreaterThanOrEqual(page.viewportSize()?.width ?? 0);
			expect(box.y + box.height).toBeGreaterThanOrEqual(page.viewportSize()?.height ?? 0);
		}
	});

	test('AK2: das Konfetti endet von selbst innerhalb 4–6 s und hinterlässt keine DOM-Reste', async ({ page }) => {
		const id = await seedOpenTask(page, 'Ende');

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// Effekt läuft zunächst …
		await expect(confetti(page)).toBeVisible();
		// … und verschwindet ohne Nutzer-Interaktion innerhalb des Toleranzfensters (≤ 6 s).
		await expect(confetti(page)).toBeHidden({ timeout: 6_500 });

		// Keine Reste: das Overlay ist nicht nur unsichtbar, sondern aus dem DOM entfernt.
		expect(await confetti(page).count()).toBe(0);
	});

	test('AK3: Wieder-Öffnen (Done→Open) löst kein Konfetti aus', async ({ page }) => {
		const id = await seedOpenTask(page, 'Reopen');

		// Erst per UI auf Erledigt schalten — der Open→Done-Effekt feuert (AK1). Ein API-Seed
		// auf „Done" zeigt die Zeile nie im Aufgaben-Tab (GET /forest liefert nur offene
		// Aufgaben), deshalb der UI-Weg. Warten bis zum Selbst-Abbau (AK2) ist nicht möglich:
		// Die Liste lädt neu und entfernt die Done-Zeile, das Popover geht damit verloren.
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// Ersteffekt nicht mitzählen: Overlay-Anzahl VOR dem Reopen merken …
		const overlaysBeforeReopen = await confetti(page).count();

		// … und sofort über das noch offene Popover wiederveröffnen (Muster done-toggle.spec.ts, #387).
		await expect(doneToggle(page, id)).toBeVisible();
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Open');

		// Kein NEUES Overlay — kurzes Fenster reicht, da launchConfetti synchron zum Klick passiert.
		await page.waitForTimeout(1_000);
		expect(await confetti(page).count()).toBe(overlaysBeforeReopen);
	});

	test('AK5: während der Konfetti-Animation bleibt eine andere Aufgabe bedienbar', async ({ page }) => {
		// Beide Aufgaben VOR der Navigation anlegen — die Aufgabenliste lädt nicht nach
		// (kein Polling), nachträglich per API geseedete Zeilen erscheinen nie.
		const idA = await createTask(page, uniqueTitle('A'));
		const idB = await createTask(page, uniqueTitle('B'));
		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, idA)).toBeVisible();
		await expect(item(page, idB)).toBeVisible();

		// Konfetti starten …
		await openActionsPopover(page, idA);
		await doneToggle(page, idA).click();
		await expect(confetti(page)).toBeVisible();

		// … und währenddessen Aufgabe B über ihr „…"-Popover auf Erledigt schalten:
		// Popover öffnen (Klick geht durch) und PATCH persistiert (AK5).
		await openActionsPopover(page, idB);
		await doneToggle(page, idB).click();
		await expect.poll(async () => fetchStatus(page, idB)).toBe('Done');
	});

	test('AK4: auf 375×667 läuft der Effekt durch und die UI bleibt bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const id = await seedOpenTask(page, 'Mobil');

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// Effekt läuft auch auf Mobil durch (rAF + feste Partikelzahl, s. Spec-Kommentar oben).
		await expect(confetti(page)).toBeVisible();

		// Bedienbarkeit: der Toggle der (sticky) Zeile bleibt während der Animation erreichbar.
		await expect(doneToggle(page, id)).toBeAttached();
	});

	test('AK6: bei prefers-reduced-motion: reduce wird kein Konfetti erzeugt', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const id = await seedOpenTask(page, 'Reduce');

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// Der Statuswechsel funktioniert trotzdem …
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// … nur der Effekt bleibt aus (JS-Abfrage, nicht die CSS-Token-Regel — s. Spec).
		await page.waitForTimeout(1_000);
		expect(await confetti(page).count()).toBe(0);
	});
});
