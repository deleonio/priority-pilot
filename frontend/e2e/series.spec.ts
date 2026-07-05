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
		priority?: number;
		estimatedEffort?: number;
		active?: boolean;
		startDate: string;
	}

	/** Legt eine Serie direkt über die echte API an (Setup für AK 2/AK 3) und gibt ihre `id` zurück. */
	const createSeriesViaApi = async (page: Page, payload: SeriesPayload): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
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

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
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
		await expect(page.getByText(title, { exact: true })).toHaveCount(2);

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

		// Genau die A-Instanz anhand ihrer ID (aus der API) im Task-Tree finden und bearbeiten.
		const movedItem = page.locator(`[data-testid="task-tree-item-${moved.id}"]`);
		await movedItem.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Deadline (optional)').fill('2026-09-28');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		// UI: die Geschwister-Instanz steht unverändert weiterhin in der Liste (Deadline wird im Task-Tree nicht angezeigt).
		await openTasksTab(page);
		await expect(page.locator(`[data-testid="task-tree-item-${sibling.id}"]`)).toBeVisible();

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

	// AK7 (#244): In der Serien-Verwaltung gibt es einen Button „Fällige Instanzen generieren".
	// Ein Klick stößt die serverseitige Materialisierung an; danach existieren neue Tasks.
	test('AK7 (#244) — Button „Fällige Instanzen generieren" in SeriesManagementModal: Klick erzeugt Tasks', async ({
		page,
	}) => {
		const title = uniqueTitle('GenerateAll');
		// Serie mit Startdatum in der Vergangenheit → mehrere fällige Termine liegen bereit.
		await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-01-01T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Vorbedingung: noch keine Tasks (Serie ist angelegt, aber nichts materialisiert).
		const before = await listTasksViaApi(page);
		expect(before.length).toBe(0);

		const generateButton = page.getByRole('button', { name: /Fällige Instanzen generieren/i });
		await expect(generateButton).toBeVisible();
		await generateButton.click();

		// Nach dem Klick sind fällige Instanzen serverseitig materialisiert.
		await expect(async () => {
			const after = await listTasksViaApi(page);
			expect(after.length).toBeGreaterThan(0);
		}).toPass();
	});

	// AK8 (#244): Der Button ist auf einem 375px-Viewport (Mobile-First) ohne horizontales
	// Scrollen erreichbar — er bleibt vollständig innerhalb der Viewport-Breite.
	test('AK8 (#244) — Button „Fällige Instanzen generieren" auf 375px Viewport (Mobile-First)', async ({ page }) => {
		const title = uniqueTitle('GenerateAllMobile');
		await createSeriesViaApi(page, { title, rhythm: 'weekly', startDate: '2026-01-01T00:00:00.000Z' });

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		const generateButton = page.getByRole('button', { name: /Fällige Instanzen generieren/i });
		await expect(generateButton).toBeVisible();

		const box = await generateButton.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	});
});

/**
 * Rote Spec-Tests für #297 (Sub-D #293): Ablösung von `SeriesFormModal` durch `TaskForm`.
 *
 * Nach dem Cleanup öffnet „Neue Serie anlegen" und „Bearbeiten" in `SeriesManagementModal`
 * nicht mehr `SeriesFormModal`, sondern den bloßen `<TaskForm>`-Body im Serie-Modus.
 * Erkennbar am `data-testid="mode-toggle"` (aus `TaskForm`) — dieses Testid fehlt im
 * alten `SeriesFormModal`, weshalb AK1 und AK2 aktuell rot sind.
 */
test.describe('Priority Pilot — #297: SeriesFormModal durch TaskForm ersetzen', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E #297 ${label} #${(runId += 1)}-${Date.now()}`;

	interface SeriesPayload {
		title: string;
		rhythm?: 'daily' | 'weekly' | 'monthly';
		startDate: string;
	}

	const createSeriesViaApi = async (page: Page, payload: SeriesPayload): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: { rhythm: 'weekly', priority: 3, estimatedEffort: 0.5, active: true, ...payload },
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) await page.request.delete(`/api/v1/tasks/${task.id}`);
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) await page.request.delete(`/api/v1/series/${entry.id}`);
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Serien verwalten' }).click();
		await expect(page.getByRole('heading', { name: 'Serien', exact: true })).toBeVisible();
		await waitForStableView(page);
	};

	// AK1 — Anlegen über TaskForm: Klick auf „Neue Serie anlegen" öffnet TaskForm-Serie-Modus.
	// ROT: aktuell zeigt SeriesFormModal kein data-testid="mode-toggle" → toBeVisible() schlägt fehl.
	test('AK1 — „Neue Serie anlegen" öffnet TaskForm im Serie-Modus (mode-toggle sichtbar, Serie aktiv)', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await waitForStableView(page);

		// TaskForm-Serie-Modus muss sichtbar sein — erkennbar am mode-toggle.
		const toggle = page.getByTestId('mode-toggle');
		await expect(toggle).toBeVisible();

		// Der „Serie"-Button im Toggle ist primär (aktiver Modus).
		await expect(toggle.getByRole('button', { name: /serie/i })).toBeVisible();

		// Serienfelder erscheinen: Startdatum + Rhythmus statt Deadline.
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByLabel('Rhythmus')).toBeVisible();
		await expect(page.getByLabel('Deadline (optional)')).toBeHidden();

		// Das alte SeriesFormModal-Heading darf NICHT mehr erscheinen.
		await expect(page.getByRole('heading', { name: 'Neue Serie anlegen' })).toBeHidden();
	});

	// AK1 Vollfluss — Speichern legt die Serie an und zeigt sie in der Liste.
	// ROT: schlägt wegen AK1-Voraussetzung (mode-toggle) fehl, bevor das Formular befüllt werden kann.
	test('AK1 — Anlegen über TaskForm-Serie-Modus: Serie wird persistiert und in der Liste angezeigt', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		const title = uniqueTitle('Anlegen');
		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await waitForStableView(page);

		// Vorbedingung: TaskForm-Serie-Modus muss aktiv sein.
		await expect(page.getByTestId('mode-toggle')).toBeVisible();

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByLabel('Startdatum').fill('2026-09-07');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await waitForStableView(page);

		// Nach dem Speichern: Formular geschlossen, Serie in der Liste sichtbar.
		await expect(page.getByTestId('mode-toggle')).toBeHidden();
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		// Persistenz-Gegenkontrolle über die API.
		const all = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(all.some((s) => s.title === title)).toBeTruthy();
	});

	// AK2 — Bearbeiten über TaskForm: Klick auf „Bearbeiten" öffnet TaskForm im gesperrten Serie-Modus.
	// ROT: aktuell öffnet SeriesManagementModal das alte SeriesFormModal ohne mode-toggle → toBeVisible() fehlschlägt.
	test('AK2 — „Bearbeiten" öffnet TaskForm im gesperrten Serie-Edit-Modus mit vorbefülltem Titel', async ({
		page,
	}) => {
		const title = uniqueTitle('Bearbeiten');
		await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Bearbeiten-Button der ersten Serie klicken.
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// TaskForm-Serie-Modus muss sichtbar sein.
		const toggle = page.getByTestId('mode-toggle');
		await expect(toggle).toBeVisible();

		// Beim Bearbeiten sind beide Toggle-Buttons gesperrt (isEdit = true).
		await expect(toggle.getByRole('button', { name: /aufgabe/i })).toBeDisabled();
		await expect(toggle.getByRole('button', { name: /serie/i })).toBeDisabled();

		// Der Titel-Wert ist vorbefüllt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);

		// Serienfelder sichtbar (Startdatum, Rhythmus), keine Deadline.
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByLabel('Deadline (optional)')).toBeHidden();
	});

	// AK2 Vollfluss — Speichern nach Bearbeiten aktualisiert den Titel in der Liste.
	test('AK2 — Bearbeiten und Speichern: neuer Titel erscheint in der Serien-Liste', async ({ page }) => {
		const titleOld = uniqueTitle('Alt');
		const titleNew = uniqueTitle('Neu');
		await createSeriesViaApi(page, { title: titleOld, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// Vorbedingung: TaskForm-Serie-Modus muss aktiv sein.
		await expect(page.getByTestId('mode-toggle')).toBeVisible();

		await page.getByRole('textbox', { name: 'Titel' }).fill(titleNew);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await waitForStableView(page);

		// Neuer Titel in der Liste sichtbar, alter nicht mehr.
		await expect(page.getByText(titleNew, { exact: true }).first()).toBeVisible();
		await expect(page.getByText(titleOld, { exact: true })).toBeHidden();
	});

	// AK3 — Verwaltungsfunktionen (Liste / Löschen / Generieren) bleiben nach dem Cleanup funktional.
	test('AK3 — Löschen aus der Serien-Liste funktioniert weiterhin', async ({ page }) => {
		const title = uniqueTitle('Loeschen');
		await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await waitForStableView(page);

		await expect(page.getByText(title, { exact: true })).toBeHidden();

		const all = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(all.some((s) => s.title === title)).toBeFalsy();
	});

	// AK5 — Mobile-First 375px: TaskForm-Serie-Flow in SeriesManagementModal ohne horizontales Scrollen.
	// ROT: schlägt durch AK1-Vorbedingung (mode-toggle nicht sichtbar) fehl.
	test('AK5 — TaskForm-Serie-Flow auf 375px Viewport ohne horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await waitForStableView(page);

		// TaskForm-Serie-Modus muss sichtbar sein.
		const toggle = page.getByTestId('mode-toggle');
		await expect(toggle).toBeVisible();

		// Kein Element überragt den 375px-Viewport.
		const toggleBox = await toggle.boundingBox();
		expect(toggleBox).not.toBeNull();
		expect(toggleBox!.x).toBeGreaterThanOrEqual(0);
		expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(375);

		const titleField = page.getByRole('textbox', { name: 'Titel' });
		await expect(titleField).toBeVisible();
		const titleBox = await titleField.boundingBox();
		expect(titleBox).not.toBeNull();
		expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(375);
	});
});
