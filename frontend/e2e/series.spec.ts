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
 *     ein Serien-Formular) bereitstellt (AK 1) und
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

	/**
	 * Öffnet die Serien-Verwaltung. Nach #335 liegt sie in einem eigenen Tab „Serien" (statt im alten
	 * Header-Button + Modal); der Serien-Baum (`series-tree`) ist danach sichtbar.
	 */
	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
	};

	/** Wechselt auf den „Aufgaben"-Tab (dort liegt die Task-Tabelle mit den Serien-Instanzen). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	// AK 1: Serie anlegen/bearbeiten/löschen → über `/series` persistiert und in der UI gelistet.
	// Nach #330: kein separater „Neue Serie anlegen"-Button mehr im SeriesManagementModal —
	// Anlegen läuft über QuickCapture („Neuen Task anlegen" → Überspringen → Serie-Modus).
	test('AK1 — Serie über die UI anlegen: wird persistiert und in der Serien-Liste angezeigt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Anlegen');

		// QuickCapture-Flow: „Neuen Task anlegen" → LLM-Schritt überspringen → TaskForm im Serie-Modus.
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Auf „Serie"-Modus umschalten (Switch statt Button-Paar, #334).
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		// `startDate` ist im Vertrag (`SeriesCreate`) Pflicht — Startdatum als Anker der Serie setzen.
		await page.getByLabel('Startdatum').fill('2026-09-07');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await waitForStableView(page);

		// In der UI gelistet: der Serien-Titel erscheint in der Serien-Verwaltung.
		await openSeriesManagement(page);
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
		// AK4 (#334): Der Edit-Titel nennt den Typ eindeutig („Aufgabe bearbeiten: …").
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Deadline (optional)').fill('2026-09-28');
		// AK7 (#334): Der Submit-Button im Bearbeiten-Modus heißt „Bearbeiten".
		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();

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
 * Spec-Tests für #297 (Sub-D #293): Ablösung des alten Serien-Formulars durch `TaskForm`.
 *
 * Nach dem Cleanup öffnet „Neue Serie anlegen" und „Bearbeiten" in `SeriesManagementModal`
 * nicht mehr das alte Serien-Formular-Card, sondern den bloßen `<TaskForm>`-Body im
 * Serie-Modus. Erkennbar am typspezifischen Dialogtitel „Serie bearbeiten: <title>" (#334) —
 * im Bearbeiten-Modus ist der Switch (`data-testid="mode-switch"`) nicht im DOM.
 */
test.describe('Priority Pilot — #297: Altes Serien-Formular durch TaskForm ersetzen', () => {
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

	// Nach #335: Serien-Verwaltung im eigenen Tab „Serien" statt Header-Button + Modal.
	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
	};

	// AK2 — Bearbeiten über TaskForm: Klick auf „Bearbeiten" öffnet TaskForm im gesperrten Serie-Modus.
	// (War rot, solange SeriesManagementModal das alte Serien-Formular ohne den Umschalter öffnete.)
	test('AK2 — „Bearbeiten" öffnet TaskForm im gesperrten Serie-Edit-Modus mit vorbefülltem Titel', async ({ page }) => {
		const title = uniqueTitle('Bearbeiten');
		await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Bearbeiten-Button der ersten Serie klicken.
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// AK4 (#334): Der Edit-Titel nennt den Typ eindeutig („Serie bearbeiten: <title>").
		await expect(page.getByRole('heading', { name: `Serie bearbeiten: ${title}` })).toBeVisible();

		// AK3 (#334): Im Bearbeiten-Modus ist der Switch nicht im DOM (nicht nur disabled).
		await expect(page.getByTestId('mode-switch')).not.toBeAttached();

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

		// Vorbedingung: TaskForm-Serie-Edit-Modus — der Switch ist nicht im DOM (AK3, #334).
		await expect(page.getByTestId('mode-switch')).not.toBeAttached();

		await page.getByRole('textbox', { name: 'Titel' }).fill(titleNew);
		// AK7 (#334): Der Submit-Button im Bearbeiten-Modus heißt „Bearbeiten".
		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
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
});

/**
 * Rote Spec-Tests für #330: Vereinheitlichter Anlege-Einstieg für Task und Serie.
 *
 * Der separate „Neue Serie anlegen"-Button in `SeriesManagementModal` entfällt — das Anlegen läuft
 * ausschließlich über „Neuen Task anlegen" → QuickCapture → `TaskForm` mit Mode-Toggle. Die
 * Verwaltungsfunktionen (Liste, Bearbeiten, Löschen, Generieren) bleiben im Modal erhalten.
 *
 * AK5a ist der Kern-Rot-Test: `toHaveCount(0)` schlägt aktuell fehl, weil der Button noch existiert.
 * Nach Umsetzung (Button entfernt) wird der Block grün.
 */
test.describe('Priority Pilot — #330: Vereinheitlichter Anlege-Einstieg (SeriesManagementModal ohne Anlegen-Button)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E #330 ${label} #${(runId += 1)}-${Date.now()}`;

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

	// Nach #335: Serien-Verwaltung im eigenen Tab „Serien" statt Header-Button + Modal.
	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
	};

	// AK5a — Der separate „Neue Serie anlegen"-Button ist im SeriesManagementModal entfernt.
	// ROT: schlägt aktuell fehl, weil der Button noch existiert (toHaveCount(0) → tatsächlich 1).
	test('AK5 (#330) — SeriesManagementModal enthält keinen separaten „Neue Serie anlegen"-Button', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Kern-Assertion: kein Anlegen-Button mehr in der Serien-Verwaltung.
		await expect(page.getByRole('button', { name: 'Neue Serie anlegen' })).toHaveCount(0);

		// Die Serien-Verwaltung ist trotzdem geöffnet (nach #335 der Serien-Tab mit dem Serien-Baum).
		await expect(page.getByTestId('series-tree')).toBeVisible();
	});

	// AK5b — Verwaltungsfunktionen (Liste / Bearbeiten / Löschen / Generieren) bleiben ohne Anlegen-Button erhalten.
	test('AK5 (#330) — Serien-Verwaltung zeigt Liste/Bearbeiten/Löschen/Generieren ohne Anlegen-Button', async ({
		page,
	}) => {
		const title = uniqueTitle('Verwaltung');
		await createSeriesViaApi(page, { title, startDate: '2026-09-07T00:00:00.000Z' });

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Kein Anlegen-Button.
		await expect(page.getByRole('button', { name: 'Neue Serie anlegen' })).toHaveCount(0);

		// Die Serie steht in der Liste.
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		// Verwaltungsfunktionen bleiben bedienbar.
		await expect(page.getByRole('button', { name: 'Bearbeiten' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Löschen' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /Fällige Instanzen generieren/i })).toBeVisible();
	});

	// AK5c — Mobile-First 375px: SeriesManagementModal ohne Anlegen-Button und ohne horizontales Scrollen.
	test('AK5 (#330) — SeriesManagementModal auf 375px ohne Anlegen-Button und ohne horizontales Scrollen', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesManagement(page);

		// Kein Anlegen-Button.
		await expect(page.getByRole('button', { name: 'Neue Serie anlegen' })).toHaveCount(0);

		// Kein horizontales Scrollen: die Scrollbreite überschreitet die Viewport-Breite nicht.
		const hasNoHorizontalScroll = await page.evaluate(
			() => document.scrollingElement !== null && document.scrollingElement.scrollWidth <= window.innerWidth,
		);
		expect(hasNoHorizontalScroll).toBeTruthy();
	});
});

/**
 * Rote Spec-Tests für #343 — „Serien speichern nicht die Säulenzuordnung" (Round-Trip gegen das echte
 * Backend). Beim Bearbeiten einer Serie wird die bestehende Säulenzuordnung nicht ins Formular geladen;
 * beim anschließenden Speichern (ohne Änderung) geht sie verloren.
 *
 * **Erwartetes Soll:** Nach dem Bearbeiten + Speichern ohne Änderung bleibt die Säulenzuordnung im
 * Backend erhalten, und beim erneuten Öffnen des Formulars ist die Säulen-Zeile sichtbar.
 *
 * Diese Specs sind rot, solange TaskForm `series.pillars` beim Serien-Edit ignoriert.
 */
test.describe('Priority Pilot — Serien behalten die Säulenzuordnung (#343)', () => {
	interface ApiSeries {
		id: number;
		title: string;
		pillars: Array<{ pillarId: number; share: number; confidence: number }>;
	}

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

	/** Öffnet die Serien-Verwaltung (Tab „Serien"), wartet auf den Serien-Baum. */
	const openSeriesManagement = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
	};

	test('AK3 — Bearbeiten + Speichern ohne Änderung erhält die Säulenzuordnung (Round-Trip)', async ({ page }) => {
		// 1. Erste verfügbare Säule aus dem Backend holen.
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as Array<{ id: number; name: string }>;
		expect(pillars.length).toBeGreaterThan(0);
		const pillar = pillars[0];

		// 2. Serie mit dieser Säule via API anlegen.
		const title = `E2E Serie Säulen #343-${Date.now()}`;
		const createResponse = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
				pillars: [{ pillarId: pillar.id, share: 100, confidence: 80 }],
			},
		});
		expect(createResponse.ok()).toBeTruthy();
		const created = (await createResponse.json()) as ApiSeries;
		expect(created.pillars.length).toBeGreaterThan(0);

		// 3. App laden.
		await page.goto('/');
		await waitForStableView(page);

		// 4. Serien-Tab öffnen.
		await openSeriesManagement(page);

		// 5. „Bearbeiten" klicken.
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// 6. Guard: TaskForm im Serien-Edit-Modus ist offen.
		await expect(page.getByTestId('mode-switch')).not.toBeAttached();

		// 7. Speichern ohne Änderung.
		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();

		// 8. Auf stabile Sicht nach dem Speichern warten.
		await waitForStableView(page);

		// 9. Backend-Vertrag: die Säulenzuordnung wurde NICHT gelöscht.
		const afterResponse = await page.request.get(`/api/v1/series/${created.id}`);
		expect(afterResponse.ok()).toBeTruthy();
		const after = (await afterResponse.json()) as ApiSeries;
		expect(after.pillars.length).toBeGreaterThan(0);

		// 10. Formular erneut öffnen.
		await openSeriesManagement(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// 11. Die Säulen-Zeile ist im Formular sichtbar (die Zuordnung wurde ins Formular geladen).
		await expect(page.locator('.pillar-row').first()).toBeVisible();
	});
});
