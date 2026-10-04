import { expect, test, type Locator, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #1984 — Expertenmodus: Prozent- und Gewichtspflege hinter einer Einstellung
 * (Spec: docs/spec/issue-1984.md).
 *
 * - AK1: Standardmodus (kein localStorage-Eintrag) ohne Säulen-Prozentregler (Aufgabendialog), ohne
 *   Säulen-Gewichtungspflege und ohne Standort-Regler (Reichweite und Intervall).
 * - AK2: Abhängigkeit im Standardmodus allein über die Aufgaben-Auswahl — POST mit Gewicht 1.
 * - AK3: Schalter „Expertenmodus" blendet ein/aus und überlebt ein Neuladen.
 * - AK4: Gewicht 0,5 bleibt gespeichert — der Standardmodus blendet nur aus.
 * - AK5 (375 px): Standardmodus ohne Regler; der Schalter ist bedienbar.
 *
 * Isolation: Tasks laufen über die echte API; afterEach räumt ab (Muster task-graph.spec.ts).
 */
test.describe('#1984 Expertenmodus', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E 1984 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
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

	/** Schalter „Expertenmodus" — Rolle-Fallback (KoliBri-Adapter, Muster ai-disable.spec.ts). */
	const expertToggle = (page: Page): Locator =>
		page.getByRole('switch', { name: 'Expertenmodus' }).or(page.getByRole('checkbox', { name: 'Expertenmodus' }));

	/** Öffnet den Anlege-Dialog bis zum Formular (Muster issue-1962-hauptsaule.spec.ts). */
	const openNewTaskForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
	};

	/** Öffnet den Abhängigkeiten-Dialog des Tasks (Muster input-range-fields.spec.ts). */
	const openDependencies = async (page: Page, taskId: number): Promise<void> => {
		const item = page.getByTestId(`task-list-item-${taskId}`);
		await item.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await item.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
	};

	/** Öffnet den Abhängigkeiten-Dialog über den Graphen — der Ziel-Task ist nach seiner ersten
	 *  Abhängigkeit eine Unteraufgabe und damit aus der flachen Aufgabenliste ausgeblendet. */
	const openDependenciesViaGraph = async (page: Page, taskId: number): Promise<void> => {
		await page.getByRole('tab', { name: 'Graph', exact: true }).click();
		await waitForStableView(page);
		await page.getByTestId(`graph-node-${taskId}`).click();
		await page.getByRole('button', { name: 'Abhängigkeiten bearbeiten', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
	};

	/** Navigiert in die Einstellungen (Allgemein) und wartet auf die stabile Ansicht. */
	const openGeneralSettings = async (page: Page): Promise<void> => {
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');
	};

	test('AK1 — Standardmodus: keine Regler im Aufgabendialog, Gewichtspflege und Standort-Regler nicht erreichbar', async ({
		page,
	}) => {
		await createTask(page, uniqueTitle('Basis'));
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await openNewTaskForm(page);

		await expect(page.locator('.pillar-row input[type="range"]')).toHaveCount(0);

		// Die Säulen-Gewichtungspflege bleibt im Standardmodus ausgeblendet.
		await openGeneralSettings(page);
		await page.goto('/app/settings/pillars');
		await waitForStableView(page, 'Balamentum');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toHaveCount(0);
		await expect(page.locator('.pillar-weights-grid')).toHaveCount(0);

		// Die Standort-Regler (Reichweite und Intervall) bleiben ebenfalls ausgeblendet.
		await page.goto('/app/settings/ortung');
		await waitForStableView(page, 'Balamentum');
		await expect(page.locator('.geo-range-field')).toHaveCount(0);
	});

	test('AK2 — Standardmodus: Anlegen über die Auswahl, POST mit Gewicht 1', async ({ page }) => {
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorTitle = uniqueTitle('Vorgänger');
		const predecessorId = await createTask(page, predecessorTitle);
		await page.goto('/app/');
		await waitForStableView(page);
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await openDependencies(page, targetId);

		// Kein Gewicht-Regler im ganzen Dialog (weder Bestandsliste noch Anlage-Block).
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveCount(0);

		const depRequest = page.waitForRequest(
			(request) => request.url().includes(`/api/v1/tasks/${targetId}/dependencies`) && request.method() === 'POST',
		);
		await page.getByLabel('Vorgänger-Task').click();
		await page.getByRole('option', { name: new RegExp(predecessorTitle) }).click();
		await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
		const request = await depRequest;
		expect(request.postDataJSON()).toMatchObject({ dependingTaskId: predecessorId, weight: 1 });

		// Der Vorgänger erscheint in der Liste — der Anlege-Flow ist ohne Zahleneingabe vollständig.
		await expect(page.locator('.dependency-list li > span').filter({ hasText: predecessorTitle })).toBeVisible();
	});

	test('AK3 — Schalter blendet ein/aus und überlebt das Neuladen', async ({ page }) => {
		await openGeneralSettings(page);
		const toggle = expertToggle(page);
		await expect(toggle).not.toBeChecked();

		await toggle.click();
		await expect(toggle).toBeChecked();
		expect(await page.evaluate(() => localStorage.getItem('pp-expert-mode'))).toBe('true');

		await page.reload();
		await waitForStableView(page, 'Balamentum');
		await expect(expertToggle(page)).toBeChecked();

		await expertToggle(page).click();
		await expect(expertToggle(page)).not.toBeChecked();
		expect(await page.evaluate(() => localStorage.getItem('pp-expert-mode'))).toBe('false');
	});

	test('AK4 — Gewicht 0,5 bleibt erhalten; Standardmodus blendet nur aus', async ({ page }) => {
		const targetId = await createTask(page, uniqueTitle('Ziel'));
		const predecessorTitle = uniqueTitle('Vorgänger');
		await createTask(page, predecessorTitle);
		await page.goto('/app/');
		await waitForStableView(page);
		// Expertenmodus für den Anlage-Teil einschalten (nach dem ersten Load, damit der
		// localStorage-Wert später über den Schalter umgelegt werden kann).
		await page.evaluate(() => localStorage.setItem('pp-expert-mode', 'true'));
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await openDependencies(page, targetId);

		const weightSlider = page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]');
		await expect(weightSlider).toBeVisible();
		await page.getByLabel('Vorgänger-Task').click();
		await page.getByRole('option', { name: new RegExp(predecessorTitle) }).click();
		// Slider auf 0,5: Home (→ 0,1) + 4× ArrowRight (Muster input-range-fields.spec.ts).
		await weightSlider.press('Home');
		for (let step = 0; step < 4; step += 1) {
			await weightSlider.press('ArrowRight');
		}
		await expect(weightSlider).toHaveValue('0.5');
		await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
		await expect(page.locator('.dependency-list li > span').filter({ hasText: predecessorTitle })).toBeVisible();
		// Dialog per Navigation schließen (zwei „Schließen“-Buttons der App wären mehrdeutig).

		// Expertenmodus aus — der Dialog zeigt keinen Regler mehr, der Eintrag bleibt.
		await openGeneralSettings(page);
		await expertToggle(page).click();
		await expect(expertToggle(page)).not.toBeChecked();
		await page.goto('/app/');
		await waitForStableView(page);
		await openDependenciesViaGraph(page, targetId);
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveCount(0);
		await expect(page.locator('.dependency-list li > span').filter({ hasText: predecessorTitle })).toBeVisible();

		// Wiedereinschalten — das Gewicht 0,5 ist wieder sichtbar (nichts wurde gelöscht).
		await openGeneralSettings(page);
		await expertToggle(page).click();
		await expect(expertToggle(page)).toBeChecked();
		await page.goto('/app/');
		await waitForStableView(page);
		await openDependenciesViaGraph(page, targetId);
		// Der Anlage-Block führt im Expertenmodus ebenfalls einen Regler — deshalb auf die
		// Bestandsliste scopen (AK4: genau dieser trägt das erhaltene Gewicht 0,5).
		const listSlider = page.locator('.dependency-list input[type="range"]');
		await expect(listSlider).toBeVisible();
		await expect(listSlider).toHaveValue('0.5');
	});

	test('AK5 — 375 px: Standardmodus ohne Regler, Schalter bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createTask(page, uniqueTitle('Mobil'));
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await openNewTaskForm(page);
		await expect(page.locator('.pillar-row input[type="range"]')).toHaveCount(0);

		await openGeneralSettings(page);
		const toggle = expertToggle(page);
		await expect(toggle).toBeVisible();
		await toggle.click();
		await expect(toggle).toBeChecked();
	});
});
