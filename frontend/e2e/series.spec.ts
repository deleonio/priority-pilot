import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Funktionale End-to-End-Spec für die **Serien-Frontend-Vertikale** (#142) gegen das **echte**
 * Backend (Series-Vertrag aus #141, `openapi.yml`: `/series` CRUD, `/series/{id}/generate`,
 * `seriesId`/`isException` am `Task`). Nichts wird gemockt — wie `crud.spec.ts` läuft ein echtes
 * Express-Backend mit In-Memory-DB; der Vite-Proxy reicht die Requests durch.
 *
 * **Rote Spec-Tests (Stufe 1, TDD-Gewaltenteilung):** Diese Tests beschreiben das Soll-Verhalten,
 * bevor der Produktivcode existiert — sie werden grün, sobald die Umsetzung
 *   - eine Serien-Verwaltung (Einstieg „Serien verwalten" in der Kopf-Toolbar, Liste + Anlegen über
 *     eine `SeriesFormModal`) bereitstellt (AK 1) und
 *   - generierte Instanzen in der Aufgaben-Tabelle als zur Serie gehörig kennzeichnet, inkl.
 *     Ausnahme-Hinweis bei individuell geänderten Instanzen (AK 2, AK 3).
 *
 * **Isolation:** Die In-Memory-DB überlebt den ganzen Backend-Prozess; `afterEach` räumt darum erst
 * alle Tasks (auch generierte Instanzen), dann alle Serien über die echte API wieder ab.
 */
test.describe('Priority Pilot — Serien-Frontend gegen das echte Backend (#142)', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E Serie ${label} #${(runId += 1)}-${Date.now()}`;

	interface SeriesPayload {
		title: string;
		rhythm?: 'daily' | 'weekly' | 'monthly';
		defaultPriority?: number;
		defaultEstimatedEffort?: number;
		active?: boolean;
		startDate: string;
	}

	/** Legt eine Serie direkt über die echte API an (Setup für AK 2/AK 3) und gibt ihre `id` zurück. */
	const createSeriesViaApi = async (page: Page, payload: SeriesPayload): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				rhythm: 'weekly',
				defaultPriority: 3,
				defaultEstimatedEffort: 0.5,
				active: true,
				...payload,
			},
		});
		expect(response.ok()).toBeTruthy();
		const series = (await response.json()) as { id: number };
		return series.id;
	};

	/** Materialisiert die fälligen Instanzen einer Serie bis `until` über die echte API. */
	const generateInstancesViaApi = async (page: Page, seriesId: number, until: string): Promise<void> => {
		const response = await page.request.post(`/api/v1/series/${seriesId}/generate`, { data: { until } });
		expect(response.ok()).toBeTruthy();
	};

	interface ApiTask {
		id: number;
		title: string;
		deadline: string | null;
		seriesId: number | null;
		isException: boolean;
	}

	const listTasksViaApi = async (page: Page): Promise<ApiTask[]> => {
		const response = await page.request.get('/api/v1/tasks');
		expect(response.ok()).toBeTruthy();
		return (await response.json()) as ApiTask[];
	};

	/** Räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	/** Öffnet die Serien-Verwaltung über die Kopf-Toolbar (unabhängig davon, ob schon Tasks existieren). */
	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Serien verwalten' }).click();
		await expect(page.getByRole('heading', { name: 'Serien', exact: true })).toBeVisible();
		await waitForStableView(page);
	};

	/** Wechselt auf den „Aufgaben"-Tab (dort liegt die Task-Tabelle mit den Serien-Instanzen). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	// AK 1: Serie anlegen/bearbeiten/löschen → über `/series` persistiert und in der UI gelistet.
	test('AK1 — Serie über die UI anlegen: wird persistiert und in der Serien-Liste angezeigt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openSeriesManagement(page);

		const title = uniqueTitle('Anlegen');
		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Serie anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Titel').fill(title);
		// `startDate` ist im Vertrag (`SeriesCreate`) Pflicht — Startdatum als Anker der Serie setzen.
		await page.getByLabel('Startdatum').fill('2026-09-07');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neue Serie anlegen' })).toBeHidden();

		// In der UI gelistet: der Serien-Titel erscheint in der Serien-Verwaltung.
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		// Persistenz gegenprüfen: die Serie liegt tatsächlich über `/api/v1/series` im Backend.
		const series = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(series.some((entry) => entry.title === title)).toBeTruthy();
	});

	// AK 2: generierte Instanzen sind in der Aufgaben-Liste als zur Serie gehörig erkennbar gekennzeichnet,
	// inkl. `isException`-Hinweis bei abweichenden Instanzen.
	test('AK2 — generierte Instanzen sind in der Aufgaben-Tabelle als Serie gekennzeichnet (inkl. Ausnahme)', async ({
		page,
	}) => {
		const title = uniqueTitle('Kennzeichnung');
		// Wöchentliche Serie, zwei fällige Termine (07.09. + 14.09.2026) materialisieren.
		const seriesId = await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-09-07T00:00:00.000Z' });
		await generateInstancesViaApi(page, seriesId, '2026-09-14T00:00:00.000Z');

		// Eine der beiden Instanzen individuell ändern → das Backend markiert sie als `isException`.
		const instances = (await listTasksViaApi(page)).filter((task) => task.seriesId === seriesId);
		expect(instances.length).toBe(2);
		const exceptionResponse = await page.request.patch(`/api/v1/tasks/${instances[0].id}`, {
			data: { deadline: '2026-09-28T00:00:00.000Z' },
		});
		expect(exceptionResponse.ok()).toBeTruthy();

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Beide Instanzen tragen den Serien-Titel in der Tabelle.
		await expect(page.getByRole('cell', { name: title, exact: true })).toHaveCount(2);

		// AK 2: sichtbare Kennzeichnung „zur Serie gehörig" — das Serien-Badge erscheint in der Tabelle.
		await expect(page.getByText('Serie', { exact: true }).first()).toBeVisible();
		// AK 2: die individuell geänderte Instanz ist zusätzlich als Ausnahme („geändert") ausgewiesen.
		await expect(page.getByText(/geändert/).first()).toBeVisible();
	});

	// AK 3: eine generierte Instanz einzeln verschieben (Deadline ändern) wirkt nicht auf das Template
	// und nicht auf die Geschwister-Instanzen.
	test('AK3 — eine Instanz einzeln verschieben wirkt nicht auf Template und Geschwister', async ({ page }) => {
		const title = uniqueTitle('Verschieben');
		const seriesId = await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-09-07T00:00:00.000Z' });
		await generateInstancesViaApi(page, seriesId, '2026-09-14T00:00:00.000Z');

		const before = (await listTasksViaApi(page)).filter((task) => task.seriesId === seriesId);
		expect(before.length).toBe(2);
		// Instanzen nach Deadline sortieren: A = 07.09. (wird verschoben), B = 14.09. (bleibt unberührt).
		const sorted = [...before].sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
		const moved = sorted[0];
		const sibling = sorted[1];

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Genau die A-Instanz (Deadline 07.09.2026) anhand ihrer Deadline-Zelle finden und bearbeiten.
		const movedRow = page.getByRole('row').filter({ hasText: '07.09.2026' });
		await movedRow.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Deadline (optional)').fill('2026-09-28');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		// UI: die Geschwister-Instanz steht unverändert mit ihrer ursprünglichen Deadline weiterhin in der Liste.
		await openTasksTab(page);
		await expect(page.getByRole('cell', { name: '14.09.2026' })).toBeVisible();

		// Backend-Vertrag gegenprüfen: nur die verschobene Instanz änderte sich.
		const after = await listTasksViaApi(page);
		const movedAfter = after.find((task) => task.id === moved.id);
		const siblingAfter = after.find((task) => task.id === sibling.id);
		// Geschwister-Instanz unberührt (Deadline unverändert).
		expect(siblingAfter?.deadline).toBe(sibling.deadline);
		// Verschobene Instanz hat die neue Deadline und ist als Ausnahme markiert.
		expect(movedAfter?.deadline?.slice(0, 10)).toBe('2026-09-28');
		expect(movedAfter?.isException).toBe(true);

		// Das Serien-Template selbst bleibt unverändert (kein Drift durch die Einzel-Änderung).
		const seriesAfter = (await (await page.request.get(`/api/v1/series/${seriesId}`)).json()) as {
			title: string;
			startDate: string;
		};
		expect(seriesAfter.title).toBe(title);
		expect(seriesAfter.startDate.slice(0, 10)).toBe('2026-09-07');
	});
});
