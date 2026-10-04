import { expect, test, type Page } from './fixtures';
import { waitForStableView, fullPillarContributions } from './helpers';

/**
 * E2E-Spec für #1793 (docs/spec/issue-1793.md): Fürsorge-Hinweis auf dem Dashboard gegen das echte
 * Backend. Der Testnutzer hat gesäte Säulen ohne erledigte Aufgaben — jede Säule ist defizitär, der
 * Server liefert also Vorschläge. ROT, bis `CareHint` im Dashboard eingebunden ist.
 */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

test.describe('Dashboard — Fürsorge-Hinweis (Issue #1793)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1: genau ein Hinweis, oberhalb von „Nächste Aufgabe"', async ({ page }) => {
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #1793 Anker' } });
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toHaveCount(1);
		const hintBox = await hint.boundingBox();
		const nextBox = await page.locator('.dashboard-next-task').boundingBox();
		expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(nextBox!.y + 1);
	});

	test('AK2: Übernehmen legt genau einen Task an und blendet den Hinweis aus', async ({ page }) => {
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		const vorher = ((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length;

		await page.getByRole('button', { name: 'Vorschlag übernehmen' }).click();

		await expect(page.getByTestId('care-hint')).toHaveCount(0);
		await expect
			.poll(async () => ((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length)
			.toBe(vorher + 1);
	});

	// #2010 AK2 (docs/spec/issue-2010.md): eigener-Aufgabe-Weg gegen das echte Backend — der bislang
	// nur Unit-gemockte Pfad. Rot, wenn der Klick keine Statusänderung bewirkt oder etwas neu anlegt.
	test('#2010 AK2: Übernehmen einer eigenen Aufgabe → „In process“, keine neue Aufgabe', async ({ page }) => {
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		await page.request.post('/api/v1/tasks', {
			data: {
				title: 'E2E #2010 Fahrrad reparieren',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				// #2077: Vollverteilung mit Schwerpunkt erste Säule (Schreib-Regel des Backends).
				pillars: fullPillarContributions(pillars, 0),
			},
		});
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		// Gate: eigene Aufgaben stehen in der Auswahl vor den Vorlagen (careSuggestions.ts) — nur dann
		// löst der Klick wirklich den Task-Weg (updateTask) statt den Vorlagen-Weg aus.
		await expect(hint).toContainText('E2E #2010 Fahrrad reparieren');
		const vorher = ((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length;

		await page.getByRole('button', { name: 'Vorschlag übernehmen' }).click();

		await expect(page.getByTestId('care-hint')).toHaveCount(0);
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
			title: string;
			status: string;
		}[];
		expect(tasks).toHaveLength(vorher);
		expect(tasks.find((task) => task.title === 'E2E #2010 Fahrrad reparieren')?.status).toBe('In process');
	});

	test('AK3: Ablehnen blendet den Hinweis aus', async ({ page }) => {
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		// Das E2E-Backend läuft im Pass-Through-Modus ohne Sitzung (`userId` undefined): das echte
		// `POST …/dismissals` scheitert dort mit 500 und der Hinweis käme zurück. Nur die Ablehnung wird
		// bedient — bisher gewann der Test nur das Rennen gegen diese Antwort (CSRF-Token-Fetch im Weg).
		await page.route('**/scores/care-suggestions/dismissals', (route) => route.fulfill({ status: 204 }));

		await page.getByRole('button', { name: 'Vorschlag ablehnen' }).click();

		await expect(page.getByTestId('care-hint')).toHaveCount(0);
	});

	// Test-Pflege #1977 (docs/spec/issue-1977.md): „Nicht jetzt“ öffnet heute die Grundauswahl
	// und snoozed nur diesen Vorschlag bis Tagesende — der Hinweis verschwindet nicht mehr global,
	// der gesnoozte Vorschlag bleibt auch nach Reload weg.
	test('AK4: „Nicht jetzt“ ohne Grund snoozed nur diesen Vorschlag bis Tagesende, auch nach Reload', async ({
		page,
	}) => {
		await openDashboard(page);
		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		const vorschlagVorher = await hint.locator('p').first().textContent();

		await page.getByRole('button', { name: 'Nicht jetzt' }).click();
		await page.getByRole('button', { name: 'Ohne Grund überspringen' }).click();
		await expect(hint).not.toContainText(vorschlagVorher!);

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
		await expect(hint).not.toContainText(vorschlagVorher!);
	});

	test('AK7: bei 375 px passt der Hinweis ohne Überlauf, Aktionen ≥ 44 px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);
		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();

		const box = await hint.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		for (const name of ['Vorschlag übernehmen', 'Nicht jetzt', 'Vorschlag ablehnen']) {
			const button = await hint.getByRole('button', { name }).boundingBox();
			expect(button!.height).toBeGreaterThanOrEqual(44);
			expect(button!.x + button!.width).toBeLessThanOrEqual(375 + 1);
		}
	});

	test('#1967 AK5: TelefonSeelsorge-Link bei 375 px sichtbar, antippbar, ohne Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);
		const link = page.getByTestId('care-hint').locator('a[href="tel:08001110111"]');
		await expect(link).toBeVisible();
		const box = await link.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});
});
