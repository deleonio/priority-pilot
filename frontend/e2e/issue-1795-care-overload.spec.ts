import { expect, test, type Locator, type Page } from './fixtures';
import { waitForStableView, fullPillarContributions } from './helpers';

/**
 * E2E-Spec für #1795 (docs/spec/issue-1795.md): Bei Überlast einer Säule zeigt der Fürsorge-Hinweis
 * einen Erholungsvorschlag statt „… kam diese Woche zu kurz". Echtes Backend; Überlast entsteht durch
 * eine einzige erledigte Aufgabe der Säule „Wirksamkeit" (100 % des Aufwands im jüngeren Fenster).
 * ROT, bis Server `anlass` liefert und `CareHint` danach rahmt.
 */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const erzeugeUeberlast = async (page: Page): Promise<void> => {
	// Setup-Assertions: ein still fehlgeschlagener Aufruf ergäbe einen nicht überlasteten Nutzer
	// und der Test würde später mit leerem Fürsorge-Hinweis („keinen Vorschlag“) ohne Aussage
	// scheitern (#2188-Fixup, Shard-4-Reproduktion).
	const pillarsResponse = await page.request.get('/api/v1/pillars');
	expect(pillarsResponse.ok(), 'GET /pillars für die Vollverteilung').toBe(true);
	const alleSaeulen = (await pillarsResponse.json()) as { id: number; key: string; name: string }[];
	// Auf die Stammsäulen deduplizieren (erster Satz je key): nutzererzeugende Specs im Shard
	// (Gruppen/Admin/Rollen) lassen GET /pillars die Säulen-Seed-Sätze weiterer Konten mitliefern —
	// mit 15 Säulen cappt fullPillarContributions den Schwerpunkt auf 30 % (< UEBERLAST_ANTEIL 0.5),
	// die Überlast entsteht nie und der Hinweis bleibt leer (#2188-Fixup, CI e2e (4)).
	const pillars = alleSaeulen.filter(
		(pillar, index) => alleSaeulen.findIndex((andere) => andere.key === pillar.key) === index,
	);
	const wirksamkeitIndex = pillars.findIndex((pillar) => pillar.name === 'Wirksamkeit');
	expect(wirksamkeitIndex, 'Säule „Wirksamkeit“ muss existieren, sonst entsteht keine Überlast').toBeGreaterThanOrEqual(
		0,
	);
	const created = await page.request.post('/api/v1/tasks', {
		// #2077: Vollverteilung mit Schwerpunkt Wirksamkeit (80 % > UEBERLAST_ANTEIL 0.5).
		data: {
			title: 'E2E #1795 Überlast',
			estimatedEffort: 1,
			pillars: fullPillarContributions(pillars, wirksamkeitIndex),
		},
	});
	expect(created.ok(), 'POST /tasks (Überlast-Aufgabe)').toBe(true);
	const { id } = (await created.json()) as { id: number };
	const done = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
	expect(done.ok(), 'PATCH /tasks/:id → Done').toBe(true);
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

/**
 * Misst die Box erst nach Sichtbarkeits-Gate und stabilisierender Nachmessung (Muster `stableBox`
 * aus issue-1622-header-focus-outline.spec.ts): die Einmal-`boundingBox()` hängt im Auto-Wait
 * 30 s, wenn das KoliBri-Shadow-DOM der Aktionen sich gerade aufbaut (CI-Run 37233994408) —
 * das Gate scheitert stattdessen klar und die Nachmessung fängt CI-Umrenders ab.
 */
const stableBox = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
	await expect(locator).toBeVisible();
	let box = await locator.boundingBox();
	for (let attempt = 0; attempt < 10 && box !== null; attempt += 1) {
		const recheck = await locator.boundingBox();
		if (recheck !== null && recheck.x === box.x && recheck.y === box.y) break;
		box = recheck;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	expect(box, 'Element muss messbar sein').not.toBeNull();
	return box!;
};

test.describe('Dashboard — Fürsorge-Hinweis bei Überlast (Issue #1795)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1/AK4: Überlast → Erholungsvorschlag, kein „kam diese Woche zu kurz"', async ({ page }) => {
		await erzeugeUeberlast(page);
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		await expect(hint).not.toContainText('zu kurz');
	});

	test('AK5: bei 375 px vollständig sichtbar, ohne Überlauf, Aktionen bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await erzeugeUeberlast(page);
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).not.toContainText('zu kurz');
		const box = await stableBox(hint);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
		for (const name of ['Vorschlag übernehmen', 'Nicht jetzt', 'Vorschlag ablehnen']) {
			const button = await stableBox(hint.getByRole('button', { name }));
			expect(button.height).toBeGreaterThanOrEqual(44);
			expect(button.x + button.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
