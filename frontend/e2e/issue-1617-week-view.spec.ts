import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1617: Wochenansicht des Tagesplans.
 * AK1: Wochenansicht zeigt alle 7 Tage mit ihren Aufgaben.
 * AK2: Aus der Wochenansicht kann man einen Tag anwählen — Kreuzverhör-Entscheidung #5 (Option 5.2,
 *   PR #1620 Runde 2): der Sprung landet im Aufgaben-Tab, gefiltert auf die Deadline des Tages.
 * AK3: Manuell geplante (per Deadline datierte) Aufgaben werden dem richtigen Tag zugeordnet.
 * Seit #2011 ist der Umschalter eine Radiogruppe („Heute“/„Woche“) — die Klicks wählen die Radio-Option „Woche“.
 */

/** Montag (UTC-Mitternacht, ISO-Datum) der Kalenderwoche, in der `reference` liegt. */
const mondayIsoOf = (reference: Date): string => {
	const utcDay = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
	const isoWeekday = new Date(utcDay).getUTCDay();
	const offsetToMonday = isoWeekday === 0 ? 6 : isoWeekday - 1;
	return new Date(utcDay - offsetToMonday * 86_400_000).toISOString().slice(0, 10);
};
test.describe('Dashboard — Wochenansicht (#1617)', () => {
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

	test('AK1/AK3: zeigt 7 Tageskarten, eine mit Deadline heute datierte Aufgabe erscheint genau einmal', async ({
		page,
	}) => {
		const todayIso = new Date().toISOString().slice(0, 10);
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #1617 Wochenaufgabe', deadline: todayIso },
		});

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('radio', { name: 'Woche', exact: true }).click();

		const dayCards = page.locator('.week-view-day');
		await expect(dayCards).toHaveCount(7);

		// Die Aufgabe erscheint unter genau einem Wochentag (dem heutigen).
		await expect(page.locator('.week-view-day', { hasText: 'E2E #1617 Wochenaufgabe' })).toHaveCount(1);
	});

	test('bei 375×812 brechen die 7 Tageskarten ohne horizontalen Overflow um', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('radio', { name: 'Woche', exact: true }).click();
		await expect(page.locator('.week-view-day')).toHaveCount(7);

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	test('AK2: ein Klick auf „Tag öffnen" springt in den Aufgaben-Tab, gefiltert auf die Deadline des Tages', async ({
		page,
	}) => {
		const mondayIso = mondayIsoOf(new Date());
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #1617 Montagsaufgabe', deadline: mondayIso },
		});
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #1617 Aufgabe ohne Deadline' },
		});

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('radio', { name: 'Woche', exact: true }).click();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		// Die erste Tageskarte ist Montag (Wochenstart, WEEKDAY_LABELS in WeekView.tsx).
		await page.getByRole('button', { name: 'Tag öffnen' }).first().click();

		await expect(page).toHaveURL(new RegExp(`/aufgaben\\?deadline=${mondayIso}`));
		await expect(page.locator('.week-view-grid')).toHaveCount(0);
		// KolAlert exponiert die Rolle nicht zuverlässig (Memory 2026-08-19-ff., issue-620-Muster) —
		// auf den Wrapper-Host scopen statt getByRole('heading').
		await expect(page.locator('.task-deadline-filter')).toContainText('Aufgaben-Filter aktiv');
		// KolTabs hält inaktive Panels (Dashboard) per `hidden` weiter im DOM — der Titel steht dort
		// ggf. zusätzlich (Deadline-Liste/„nächste Aufgabe"); auf den Aufgaben-Tab-Container scopen,
		// sonst schlägt der strict-mode Locator mit mehreren Treffern fehl.
		const taskSection = page.locator('.task-section');
		await expect(taskSection.getByText('E2E #1617 Montagsaufgabe')).toBeVisible();
		await expect(taskSection.getByText('E2E #1617 Aufgabe ohne Deadline')).toHaveCount(0);
	});
});

test.describe('Dashboard — Wochenansicht: erledigte Aufgaben (#2012)', () => {
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

	test('AK4: erledigte Aufgabe erscheint in ihrer Tageskarte, ohne horizontalen Overflow bei 375px', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const todayIso = new Date().toISOString().slice(0, 10);
		const created = await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #2012 erledigt', deadline: todayIso },
		});
		const { id } = (await created.json()) as { id: number };
		await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('radio', { name: 'Woche', exact: true }).click();

		// Erledigte Einträge tragen die Done-Klasse und bleiben in der Karte sichtbar.
		const doneEntry = page.locator('.week-view-done', { hasText: 'E2E #2012 erledigt' });
		await expect(doneEntry).toHaveCount(1);
		// Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x (Memory 2026-08-24).
		const box = await doneEntry.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	});
});
