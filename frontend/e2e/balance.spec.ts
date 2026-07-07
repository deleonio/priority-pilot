import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für das Dashboard-Widget „Gesamtguthaben" (Gamification-Balance, Issue #184).
 *
 * Getestet wird gegen das echte Backend (In-Memory-DB, kein Mock). Die Tests sind bewusst **rot**
 * — das Widget existiert noch nicht; sie werden grün, sobald die Implementierung folgt.
 *
 * Abgedeckte Akzeptanzkriterien:
 *   AK 1 — Gesamtguthaben > 0 nach Task-Abschluss (Dashboard-Widget sichtbar)
 *   AK 2 — Säulen-Aufschlüsselung korrekt (je Säule Punkte + Anteil sichtbar)
 *   AK 3 — Leerstand-Text bei 0 erledigten Tasks
 *   AK 4 — Punkte steigen nach Task-Abschluss sichtbar an (Zustandswechsel im Dashboard)
 */
test.describe('Dashboard — Gesamtguthaben (Issue #184)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E Balance ${label} #${(runId += 1)}-${Date.now()}`;

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

	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	const openDashboardTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	};

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Klickt den „Erledigt"-Toggle des ersten Tasks und wartet auf den Seiten-Reload. */
	const setFirstTaskDone = async (page: Page): Promise<void> => {
		await openTasksTab(page);
		await page.getByRole('button', { name: 'Erledigt' }).first().click();
		await waitForStableView(page);
	};

	// AK 3 — Leerstand-Text bei 0 erledigten Tasks
	test('AK 3: zeigt Leerstand-Text im Gesamtguthaben-Widget, wenn keine Tasks erledigt sind', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Task anlegen, aber NICHT auf „Erledigt" setzen → 0 Punkte
		await createTaskViaUi(page, uniqueTitle('Leerstand'));
		await waitForStableView(page);

		await openDashboardTab(page);

		// Überschrift des neuen Widgets
		await expect(page.getByRole('heading', { name: 'Gesamtguthaben' })).toBeVisible();

		// Leerstand-Text gemäß Konzept (§4.4)
		await expect(
			page.getByText('Noch keine Punkte vergeben — schließe Tasks ab, um dein Guthaben aufzubauen.'),
		).toBeVisible();
	});

	// AK 1 — Gesamtguthaben > 0 nach Task-Abschluss
	test('AK 1: zeigt Gesamtguthaben > 0, nachdem mindestens ein Task erledigt wurde', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, uniqueTitle('Guthaben'));
		await setFirstTaskDone(page);

		await openDashboardTab(page);

		// Widget-Überschrift muss sichtbar sein
		await expect(page.getByRole('heading', { name: 'Gesamtguthaben' })).toBeVisible();

		// Gesamtpunkte-Anzeige: data-testid="balance-total" mit positivem Wert
		const totalEl = page.locator('[data-testid="balance-total"]');
		await expect(totalEl).toBeVisible();
		const totalText = (await totalEl.textContent()) ?? '';
		expect(Number.parseFloat(totalText.replace(',', '.'))).toBeGreaterThan(0);
	});

	// AK 2 — Säulen-Aufschlüsselung korrekt
	test('AK 2: zeigt Säulen-Aufschlüsselung mit Punkten und Anteil nach Task-Abschluss', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, uniqueTitle('Säulen'));
		await setFirstTaskDone(page);

		await openDashboardTab(page);

		// Säulen-Liste im Gesamtguthaben-Widget
		const pillarList = page.locator('[data-testid="balance-pillar-list"]');
		await expect(pillarList).toBeVisible();

		// Mindestens eine Säulen-Zeile vorhanden
		const pillarRows = pillarList.locator('[data-testid="balance-pillar-row"]');
		await expect(pillarRows.first()).toBeVisible();

		// Jede Zeile enthält einen %-Anteil (Format: „NN %") — auch 0 % ist ein gültiger Anteil
		const firstRowText = (await pillarRows.first().textContent()) ?? '';
		expect(firstRowText).toMatch(/%/);
	});

	// AK 4 — Punkte steigen nach Task-Abschluss
	test('AK 4: Gesamtpunkte-Widget wechselt von Leerstand auf sichtbare Punkte nach Task-Abschluss', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, uniqueTitle('Aktualisierung'));

		// Vorher: Leerstand-Text muss sichtbar sein
		await openDashboardTab(page);
		await expect(page.getByRole('heading', { name: 'Gesamtguthaben' })).toBeVisible();
		await expect(
			page.getByText('Noch keine Punkte vergeben — schließe Tasks ab, um dein Guthaben aufzubauen.'),
		).toBeVisible();

		// Task auf „Erledigt" setzen (löst Reload aus)
		await setFirstTaskDone(page);

		// Nachher: Leerstand-Text verschwunden, Punkte-Anzeige sichtbar
		await openDashboardTab(page);
		await expect(
			page.getByText('Noch keine Punkte vergeben — schließe Tasks ab, um dein Guthaben aufzubauen.'),
		).toBeHidden();
		await expect(page.locator('[data-testid="balance-total"]')).toBeVisible();
	});
});
