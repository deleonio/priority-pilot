import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2361 — Aufgabe als Vorlage speichern (AK1–AK5).
 * Vertrag: docs/spec/issue-2361.md. Läuft gegen das echte Backend (In-Memory-DB); 375 px.
 * Rot, bis beide Aufgaben-Aktionsmenüs „Als Vorlage speichern" führen und der Dialog
 * das Serien-Formular aus der Aufgabe vorbelegt (`POST /series`, nie `updateTask`).
 */
test.describe('Balamentum — Aufgabe als Vorlage speichern (#2361)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `${`E2E #2361 ${label}`.slice(0, 30 - tail.length)}${tail}`;
	};

	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const entry of tasks) {
			await page.request.delete(`/api/v1/tasks/${entry.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const createSourceTask = async (
		page: Page,
		title: string,
	): Promise<{ id: number; pillarA: number; pillarB: number }> => {
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		const [pillarA, pillarB] = pillars.slice(0, 2).map((entry) => entry.id);
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				description: 'Yoga für Anfänger',
				priority: 4,
				estimatedEffort: 0.75,
				address: 'Brandenburger Tor, Berlin',
				latitude: 52.5163,
				longitude: 13.3777,
				pillars: [
					{ pillarId: pillarA, share: 60, confidence: 100 },
					{ pillarId: pillarB, share: 40, confidence: 100 },
				],
			},
		});
		expect(response.ok()).toBeTruthy();
		return { id: ((await response.json()) as { id: number }).id, pillarA, pillarB };
	};

	const getTask = async (page: Page, id: number): Promise<Record<string, unknown>> =>
		(await (await page.request.get(`/api/v1/tasks/${id}`)).json()) as Record<string, unknown>;

	const listSeries = async (page: Page): Promise<Record<string, unknown>[]> =>
		(await (await page.request.get('/api/v1/series')).json()) as Record<string, unknown>[];

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	const popoverPanel = (page: Page, id: number) =>
		item(page, id).locator('kol-popover-button.task-tree-more .kol-popover-button__popover');

	const templateAction = (page: Page, id: number) =>
		popoverPanel(page, id).getByRole('button', { name: 'Als Vorlage speichern' });

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
		await expect(popoverPanel(page, id)).toBeVisible();
	};

	const openTemplateDialog = async (page: Page, id: number): Promise<void> => {
		await openActionsPopover(page, id);
		await templateAction(page, id).click();
		await expect(page.getByRole('dialog', { name: 'Vorlage erstellen' })).toBeVisible();
	};

	/** AK1-Kern: Dialog vorbelegt, Schalter aus, „Ohne Rhythmus", kein Startdatum, Akkordeon offen. */
	const expectPrefilledDialog = async (page: Page, sourceTitle: string): Promise<void> => {
		const dialog = page.getByRole('dialog', { name: 'Vorlage erstellen' });
		// UX: „Termin & Ort" ist initial aufgeklappt — der Schalter ist ohne Antippen sichtbar.
		const toggle = dialog.getByRole('checkbox', { name: 'Automatisch anlegen' });
		await expect(toggle).toBeVisible();
		await expect(toggle).not.toBeChecked();
		await expect(dialog.getByRole('textbox', { name: /titel/i })).toHaveValue(sourceTitle);
		await expect(dialog.getByRole('textbox', { name: /adresse/i })).toHaveValue('Brandenburger Tor, Berlin');
		await expect(dialog.locator('kol-input-date[_label="Startdatum"]')).toHaveCount(0);
	};

	test('AK1/AK2 — Aktion öffnet das vorbelegte Serien-Formular; Speichern legt die Vorlage an', async ({ page }) => {
		await registerOwnSession(page, 'task-template');
		const sourceTitle = uniqueTitle('Yoga');
		const source = await createSourceTask(page, sourceTitle);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, source.id)).toBeVisible();

		await openTemplateDialog(page, source.id);
		await expectPrefilledDialog(page, sourceTitle);

		await page
			.getByRole('dialog', { name: 'Vorlage erstellen' })
			.getByRole('button', { name: 'Anlegen', exact: true })
			.click();
		await expect(page.getByRole('dialog', { name: 'Vorlage erstellen' })).toHaveCount(0);

		// AK2: Die Vorlage existiert mit den vorbelegten Werten und trägt das Badge „Vorlage" (#2358).
		const series = await listSeries(page);
		expect(series).toHaveLength(1);
		const template = series[0];
		expect(template['title']).toBe(sourceTitle);
		expect(template['description']).toBe('Yoga für Anfänger');
		expect(template['priority']).toBe(4);
		expect(template['estimatedEffort']).toBe(0.75);
		expect(template['address']).toBe('Brandenburger Tor, Berlin');
		expect(template['autoCreate']).toBe(false);
		expect(template['rhythm']).toBe('none');
		expect(template['startDate'] ?? null).toBeNull();
		const shares = (template['pillars'] as Array<{ pillarId: number; share: number }>)
			.map((entry) => [entry.pillarId, entry.share] as const)
			.sort((a, b) => a[0] - b[0]);
		expect(shares).toEqual([
			[source.pillarA, 60],
			[source.pillarB, 40],
		]);

		await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await expect(
			page.getByTestId(`series-tree-item-${template['id']}`).getByText('Vorlage', { exact: true }),
		).toBeVisible();

		// AK3-Teil: Die Ausgangsaufgabe ist nach dem Speichern unverändert.
		const task = await getTask(page, source.id);
		expect(task['title']).toBe(sourceTitle);
		expect(task['description']).toBe('Yoga für Anfänger');
		expect(task['address']).toBe('Brandenburger Tor, Berlin');
		expect(task['latitude']).toBe(52.5163);
		expect(task['longitude']).toBe(13.3777);
		const taskPillars = (task['pillars'] as Array<{ pillarId: number; share: number }>)
			.map((entry) => [entry.pillarId, entry.share] as const)
			.sort((a, b) => a[0] - b[0]);
		expect(taskPillars).toEqual([
			[source.pillarA, 60],
			[source.pillarB, 40],
		]);
	});

	test('AK3 — Abbrechen legt nichts an; die Ausgangsaufgabe bleibt unverändert', async ({ page }) => {
		await registerOwnSession(page, 'task-template-cancel');
		const sourceTitle = uniqueTitle('Abbruch');
		const source = await createSourceTask(page, sourceTitle);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, source.id)).toBeVisible();

		await openTemplateDialog(page, source.id);
		await page
			.getByRole('dialog', { name: 'Vorlage erstellen' })
			.getByRole('button', { name: 'Abbrechen', exact: true })
			.click();
		await expect(page.getByRole('dialog', { name: 'Vorlage erstellen' })).toHaveCount(0);

		expect(await listSeries(page)).toHaveLength(0);
		expect((await getTask(page, source.id))['title']).toBe(sourceTitle);
	});

	test('AK4 — Aktion ist per Tastatur erreichbar und auslösbar', async ({ page }) => {
		await registerOwnSession(page, 'task-template-kbd');
		const sourceTitle = uniqueTitle('Tastatur');
		const source = await createSourceTask(page, sourceTitle);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, source.id)).toBeVisible();

		const moreButton = item(page, source.id).getByRole('button', { name: /Weitere Aktionen/i });
		await moreButton.focus();
		await page.keyboard.press('Enter');
		await expect(popoverPanel(page, source.id)).toBeVisible();

		await templateAction(page, source.id).focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog', { name: 'Vorlage erstellen' })).toBeVisible();
	});

	test('AK5 — bei 375 px: Touch-Höhe der Aktion ≥ 44 px, Formular ohne horizontales Überlaufen', async ({ page }) => {
		await registerOwnSession(page, 'task-template-mobile');
		const sourceTitle = uniqueTitle('Mobil');
		const source = await createSourceTask(page, sourceTitle);

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, source.id)).toBeVisible();

		await openActionsPopover(page, source.id);
		const actionBox = await templateAction(page, source.id).boundingBox();
		expect(actionBox?.height ?? 0, 'Aktion ≥ 44 px Touch-Höhe').toBeGreaterThanOrEqual(44);

		await templateAction(page, source.id).click();
		const dialog = page.getByRole('dialog', { name: 'Vorlage erstellen' });
		await expect(dialog).toBeVisible();
		const dialogBox = await dialog.boundingBox();
		expect(dialogBox).not.toBeNull();
		expect(dialogBox?.x ?? 0).toBeGreaterThanOrEqual(0);
		expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 999)).toBeLessThanOrEqual(376);
	});
});
