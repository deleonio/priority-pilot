import { expect, test, type Page } from './fixtures';
import { MOBILE, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1964 „Verpasst-Bereich“ (Spec docs/spec/issue-1964.md).
 *
 * AK2: die Section „Verpasst“ bietet je Aufgabe „Neu planen“, „Archivieren“ und „Löschen“.
 * AK3 (e2e-Teil): der Verschiebe-Zähler ist als Text-Badge sichtbar („N× verschoben“);
 *   Aufgaben ohne Verschiebung zeigen keinen Zähler.
 * AK6 (Mobile-First): bei 375 px ist der Bereich inkl. aller vier Aktionen ohne horizontalen
 *   Scroll vollständig sichtbar (Bounding-Box statt scrollWidth — die App-Shell clippt mit
 *   `overflow-x: hidden`), Touch-Targets ≥ 44 px.
 *
 * Wie crud.spec.ts laufen diese Specs gegen das echte Backend (In-Memory-DB, Vite-Proxy); der
 * überfällige Task wird direkt über die API angelegt (Deadline in der Vergangenheit ist API-
 * valide, nur das Formular verbietet sie) und abgeräumt.
 * Rot, bis `missed-section`/`missed-item` und die drei Aktionen existieren. KEIN Produktivcode.
 */

const DAY = 24 * 60 * 60 * 1000;

const createTaskViaApi = async (page: Page, data: Record<string, unknown>): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data });
	expect(response.ok()).toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

const patchTaskViaApi = async (page: Page, id: number, data: Record<string, unknown>): Promise<void> => {
	const response = await page.request.patch(`/api/v1/tasks/${id}`, { data });
	expect(response.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Balamentum — #1964: Verpasst-Bereich', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK2+AK3 — Bereich zeigt überfällige Aufgabe mit Zähler-Badge und den drei Aktionen', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		const id = await createTaskViaApi(page, { title: 'Verpasster Zahnarzt', deadline: past });
		// einmal nach hinten verschoben, dann wieder überfällig gesetzt (früher zählt nicht → Zähler 1)
		await patchTaskViaApi(page, id, { deadline: new Date(Date.now() + DAY).toISOString() });
		await patchTaskViaApi(page, id, { deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);

		const section = page.getByTestId('missed-section');
		await expect(section).toBeVisible({ timeout: 5000 });
		const item = page.getByTestId('missed-item');
		await expect(item).toHaveCount(1);
		await expect(item).toContainText('Verpasster Zahnarzt');
		await expect(item).toContainText(/1× verschoben/);
		await expect(item.getByRole('button', { name: /^erledigt$/i })).toBeVisible();
		// Test-Pflege #2524: „Neu planen"/„Archivieren"/„Löschen" liegen hinter dem „…"-Popover
		// („Weitere Aktionen") — erst öffnen, dann die Einträge prüfen (vormals direkt sichtbar).
		await item.getByRole('button', { name: /weitere aktionen/i }).click();
		const popover = item.locator('kol-popover-button').locator('.kol-popover-button__popover');
		await expect(popover).toBeVisible();
		// Test-Pflege #2524: die Toolbar-Buttons liegen NICHT im Panel-Subtree (Light-DOM-Slot,
		// Muster issue-2361) — über das Item selbst finden.
		await expect(item.getByRole('button', { name: /neu planen/i })).toBeVisible();
		await expect(item.getByRole('button', { name: /archivieren/i })).toBeVisible();
		await expect(item.getByRole('button', { name: /löschen/i })).toBeVisible();

		// AK3: ohne Verschiebung kein Zähler (0 wird nicht angezeigt)
		await createTaskViaApi(page, { title: 'Nie verschoben', deadline: past });
		await page.reload();
		await waitForStableView(page);
		const second = page.getByTestId('missed-item').filter({ hasText: 'Nie verschoben' });
		await expect(second).toHaveCount(1);
		// Test-Pflege #1964 (Umsetzung): geprüft wird das Zähler-Badge, nicht der freie Text — der
		// Task-Titel „Nie verschoben" enthielt das Wort selbst, die ursprüngliche Assertion
		// `not.toContainText(/verschoben/)` konnte dadurch nie grün sein.
		await expect(second).not.toContainText(/\d+× verschoben/);
	});

	test('Layout — Verpasst genau 1× im Dashboard-Grid, neben Deadlines; auf /aufgaben ebenfalls 1×', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await createTaskViaApi(page, { title: 'Verpasst Layout', deadline: new Date(Date.now() - DAY).toISOString() });
		await createTaskViaApi(page, { title: 'Bald fällig', deadline: new Date(Date.now() + DAY).toISOString() });

		await page.goto('/app/');
		await waitForStableView(page);
		// Test-Pflege #2476: Verpasst hängt seit der strukturellen Koppung der letzten Reihe im
		// Wrapper `.dashboard-last-row` (neben Deadlines) — kein direktes Grid-Kind mehr.
		await expect(page.locator('section.dashboard .missed-section')).toHaveCount(1);
		await expect(page.getByTestId('missed-section')).toHaveCount(1);
		await expect(page.getByTestId('missed-section')).toBeVisible();
		await expect(page.locator('.dashboard-deadlines')).toBeVisible();
		// Test-Pflege #2578: beide Oberkanten in EINEM page.evaluate-Snapshot messen (atomarer
		// Layout-Stand). Zwei sequenzielle boundingBox()-Aufrufe lassen zwischen den Messungen ein
		// Messfenster, in dem eine async nachladende Karte (z. B. CareHint ueber der letzten Reihe)
		// die Reihe verschieben kann — der gemessene Versatz war dann deren Hoehe.
		const tops = await page.evaluate(() => {
			const missed = document.querySelector('[data-testid="missed-section"]');
			const deadlines = document.querySelector('.dashboard-deadlines');
			return {
				missed: missed ? missed.getBoundingClientRect().top : null,
				deadlines: deadlines ? deadlines.getBoundingClientRect().top : null,
			};
		});
		expect(tops.missed, 'Verpasst-Block muss messbar sein').not.toBeNull();
		expect(tops.deadlines, 'Deadlines-Block muss messbar sein').not.toBeNull();
		expect(Math.abs(tops.missed! - tops.deadlines!)).toBeLessThan(2);

		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await expect(page.getByTestId('missed-section')).toHaveCount(1);
	});

	test('AK6 — 375px: Bereich inkl. vier Aktionen ohne horizontalen Scroll, Targets >= 44px', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Mobile Verpasst', deadline: past });

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const item = page.getByTestId('missed-item').first();
		await expect(item).toBeVisible({ timeout: 5000 });

		const itemBox = await item.boundingBox();
		expect(itemBox).not.toBeNull();
		expect(itemBox!.x).toBeGreaterThanOrEqual(0);
		expect(itemBox!.x + itemBox!.width).toBeLessThanOrEqual(375);

		// Test-Pflege #2524: „Erledigt" + „…"-Auslöser stehen inline, die drei übrigen Aktionen
		// liegen im „…"-Popover („Weitere Aktionen") und werden nach dem Öffnen gemessen.
		for (const name of [/^erledigt$/i, /weitere aktionen/i]) {
			const button = item.getByRole('button', { name });
			await expect(button).toBeVisible();
			// boundingBox() misst einmalig und wartet nicht nach (Memory 2026-09-14): kurze Schleife
			let box = await button.boundingBox();
			for (let i = 0; i < 30 && !box; i += 1) {
				await page.waitForTimeout(100);
				box = await button.boundingBox();
			}
			expect(box, `Aktion ${String(name)} muss messbar sein`).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}

		await item.getByRole('button', { name: /weitere aktionen/i }).click();
		const popover = item.locator('kol-popover-button').locator('.kol-popover-button__popover');
		await expect(popover).toBeVisible();
		for (const name of [/neu planen/i, /archivieren/i, /löschen/i]) {
			// Test-Pflege #2524: Buttons nicht im Panel-Subtree (Light-DOM-Slot, Muster issue-2361).
			const entry = item.getByRole('button', { name });
			await expect(entry).toBeVisible();
			let entryBox = await entry.boundingBox();
			for (let i = 0; i < 30 && !entryBox; i += 1) {
				await page.waitForTimeout(100);
				entryBox = await entry.boundingBox();
			}
			expect(entryBox, `Popover-Aktion ${String(name)} muss messbar sein`).not.toBeNull();
			expect(entryBox!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('Erledigt — „Erst jetzt erledigt": die Aufgabe verlässt den Verpasst-Bereich und gilt als verspätet', async ({
		page,
	}) => {
		const past = new Date(Date.now() - DAY).toISOString();
		const id = await createTaskViaApi(page, { title: 'Verpasst und doch erledigt', deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);
		const item = page.getByTestId('missed-item').filter({ hasText: 'Verpasst und doch erledigt' });
		await item.getByRole('button', { name: /^erledigt$/i }).click();
		await expect(page.getByText(/wann wurde die aufgabe/i)).toBeVisible();
		// #2635 AK2: der Folge-Halbsatz (Punkte/Streak) ist im Dialog sichtbar
		// (auf kol-dialog gescoped — der Onboarding-Dialog bleibt gemountet, #2070).
		const dialog = page.locator('kol-dialog:not([_label="Willkommen bei Balamentum"])');
		await expect(dialog.getByText(/punkt/i)).toBeVisible();
		await expect(dialog.getByText(/streak/i)).toBeVisible();
		await page.getByRole('button', { name: /^erst jetzt erledigt$/i }).click();

		await expect(page.getByTestId('missed-section')).toHaveCount(0);
		const scores = (await (await page.request.get('/api/v1/scores')).json()) as {
			taskId: number;
			pünktlich: boolean;
		}[];
		expect(scores.find((entry) => entry.taskId === id)?.pünktlich).toBe(false);
		await page.goto('/app/aufgaben?view=done');
		await waitForStableView(page);
		await expect(page.getByText('Verpasst und doch erledigt')).toBeVisible();
	});

	test('Erledigt — „Pünktlich erledigt": Erledigung wird zur Deadline gebucht', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		const id = await createTaskViaApi(page, { title: 'Pünktlich und nur nicht abgehakt', deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);
		await page
			.getByTestId('missed-item')
			.filter({ hasText: 'Pünktlich und nur nicht abgehakt' })
			.getByRole('button', { name: /^erledigt$/i })
			.click();
		await page.getByRole('button', { name: /^pünktlich erledigt$/i }).click();

		await expect(page.getByTestId('missed-section')).toHaveCount(0);
		const scores = (await (await page.request.get('/api/v1/scores')).json()) as {
			taskId: number;
			pünktlich: boolean;
			zeitpunkt: string;
		}[];
		const entry = scores.find((candidate) => candidate.taskId === id);
		expect(entry?.pünktlich).toBe(true);
		expect(new Date(entry!.zeitpunkt).toISOString()).toBe(past);
	});

	test('Archiv — Switch zeigt archivierte Aufgabe, Wiederherstellen holt sie zurück', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Ins Archiv und zurück', deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);
		// Test-Pflege #2524: „Archivieren" liegt hinter dem „…"-Popover — erst öffnen, dann klicken.
		const archivItem = page.getByTestId('missed-item').filter({ hasText: 'Ins Archiv und zurück' });
		await archivItem.getByRole('button', { name: /weitere aktionen/i }).click();
		// Test-Pflege #2524: Buttons nicht im Panel-Subtree (Light-DOM-Slot, Muster issue-2361).
		await archivItem.getByRole('button', { name: /archivieren/i }).click();
		await expect(page.getByTestId('missed-section')).toHaveCount(0);

		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await page.getByRole('checkbox', { name: /archivierte anzeigen/i }).check();
		const archived = page.getByTestId('archived-item').filter({ hasText: 'Ins Archiv und zurück' });
		await expect(archived).toBeVisible();

		await archived.getByRole('button', { name: /wiederherstellen/i }).click();
		await expect(archived).toHaveCount(0);
		await expect(page.getByTestId('missed-section')).toBeVisible();
	});
	test('#2635 AK4 — Nachfrage-Dialog bei 375 px ohne horizontalen Überlauf (inkl. Folge-Halbsatz)', async ({
		page,
	}) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Dialogbreite bei kleiner Sicht', deadline: past });

		await page.goto('/app/');
		await waitForStableView(page);
		// Test-Pflege #2635: verbindliche Mobile-Größe ist MOBILE (375×812, Spiegel-Test #2559).
		await page.setViewportSize(MOBILE);
		await page
			.getByTestId('missed-item')
			.filter({ hasText: 'Dialogbreite bei kleiner Sicht' })
			.getByRole('button', { name: /^erledigt$/i })
			.click();

		// Folge-Halbsatz im Dialog sichtbar (gescoped — Onboarding-Dialog bleibt gemountet, #2070).
		const dialog = page.locator('kol-dialog:not([_label="Willkommen bei Balamentum"])');
		await expect(dialog.getByText(/punkt/i)).toBeVisible();
		await expect(dialog.getByText(/streak/i)).toBeVisible();

		// Bounding-Box statt scrollWidth (App-Shell clippt overflow-x: hidden, Memory 2026-08-24);
		// native <dialog> messen — der kol-dialog-Host hat selbst keine Box (Memory 2026-10-08).
		let box = await dialog.locator('dialog').boundingBox();
		for (let i = 0; i < 30 && !box; i += 1) {
			await page.waitForTimeout(100);
			box = await dialog.locator('dialog').boundingBox();
		}
		expect(box, 'Dialog muss messbar sein').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	});
});
