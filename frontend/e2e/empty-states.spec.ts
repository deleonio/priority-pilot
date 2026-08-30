import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #440 (AK5): Empty-States erscheinen, wenn alle Säulen gelöscht sind,
 * und verschwinden, sobald mindestens eine Säule existiert.
 *
 * Läuft ROT, solange die betroffenen Komponenten (Dashboard, TaskForm, PillarAdvisorModal)
 * bei pillars=[] keine gestalteten Empty-States anzeigen.
 *
 * DB_SEED=false → keine Demo-Tasks, aber Säulen-Stammdaten sind vorhanden. Daher werden
 * alle Säulen vor dem eigentlichen Test per API gelöscht und nach dem Test wiederhergestellt.
 */
test.describe('Empty-States bei 0 Säulen — Übergang (Issue #440, AK5)', () => {
	/** Holt die aktuelle Säulen-Liste per API. */
	const getPillars = async (
		page: Page,
	): Promise<Array<{ id: number; name: string; description: string; weight: number }>> => {
		const response = await page.request.get('/api/v1/pillars');
		return response.json();
	};

	/** Löscht eine Säule per API. */
	const deletePillar = async (page: Page, id: number): Promise<void> => {
		await page.request.delete(`/api/v1/pillars/${id}`);
	};

	/** Legt eine Säule per API an. */
	const createPillar = async (page: Page, name: string, description: string): Promise<{ id: number }> => {
		const response = await page.request.post('/api/v1/pillars', {
			data: { name, description },
		});
		return response.json();
	};

	/** Setzt die Gewichte aller vorhandenen Säulen auf 100%-Verteilung. */
	const setWeights = async (page: Page, weights: Array<{ id: number; weight: number }>): Promise<void> => {
		await page.request.put('/api/v1/pillars/weights', { data: weights });
	};

	/**
	 * Bevor der eigentliche Test läuft: alle bestehenden Säulen merken, dann löschen.
	 * Nach dem Test: die gemerkten Säulen wiederherstellen.
	 */
	let savedPillars: Array<{ id: number; name: string; description: string; weight: number }> = [];

	test.beforeEach(async ({ page }) => {
		savedPillars = await getPillars(page);
		// Alle vorhandenen Säulen löschen.
		for (const p of savedPillars) {
			await deletePillar(page, p.id);
		}
	});

	test.afterEach(async ({ page }) => {
		// Gelöschte Säulen wiederherstellen (in umgekehrter Reihenfolge, IDs können neu sein).
		// Zuerst alle evtl. im Test angelegten Säulen löschen.
		const current = await getPillars(page);
		for (const p of current) {
			await deletePillar(page, p.id);
		}
		// Dann die original gespeicherten neu anlegen.
		for (const p of savedPillars) {
			const created = await createPillar(page, p.name, p.description);
			// weight wird später gesetzt
			p.id = created.id;
		}
		if (savedPillars.length > 0) {
			await setWeights(
				page,
				savedPillars.map((p) => ({ id: p.id, weight: p.weight })),
			);
		}
	});

	test('AK5: Dashboard zeigt Empty-State, wenn keine Säulen existieren', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Zum Dashboard-Tab navigieren.
		const dashboardTab = page.getByRole('tab', { name: 'Dashboard', exact: true });
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Bei 0 Säulen soll im „Meine Themen"-Widget der Empty-State mit KolCard erscheinen.
		const pillarsSection = page.locator('.dashboard-pillars');
		await expect(pillarsSection).toBeVisible();

		// Der alte Plain-Text (<p>Keine Säulen vorhanden.</p>) darf nicht existieren.
		// Die neue KolCard enthält ein <p> im Slot — nur der alte direkte Plain-Text ist verboten.
		await expect(pillarsSection.locator('p:has-text("Keine Säulen vorhanden.")')).toHaveCount(0);

		// Stattdessen die KolCard — seit #1118-Folge ist die Sektion selbst der Card-Host.
		const card = pillarsSection;
		await expect(card).toBeVisible();
		await expect(card).toContainText('in den Einstellungen');
	});

	test('AK5: Nach Anlegen der ersten Säule verschwindet der Dashboard-Empty-State', async ({ page }) => {
		// Erste Säule anlegen.
		const created = await createPillar(page, 'Test-Säule', 'Zum Testen');
		await setWeights(page, [{ id: created.id, weight: 100 }]);

		await page.goto('/');
		await waitForStableView(page);

		// Zum Dashboard-Tab navigieren.
		const dashboardTab = page.getByRole('tab', { name: 'Dashboard', exact: true });
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Die Säulen-Liste soll erscheinen, nicht der Empty-State.
		await expect(page.locator('.dashboard-pillars-list')).toBeVisible();
		await expect(page.locator('.dashboard-pillar')).toHaveCount(1);

		// Kein Empty-State-KolCard.
		const emptyCard = page.locator('kol-card').filter({ hasText: 'Keine Säulen vorhanden' });
		await expect(emptyCard).toHaveCount(0);
	});

	test('AK5: Nach Löschen der letzten Säule erscheint der Empty-State wieder', async ({ page }) => {
		// Keine Säulen → Empty-State.
		await page.goto('/');
		await waitForStableView(page);

		const dashboardTab = page.getByRole('tab', { name: 'Dashboard', exact: true });
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Empty-State ist sichtbar.
		await expect(page.locator('.dashboard-pillars')).toBeVisible();

		// Erste Säule anlegen.
		const created = await createPillar(page, 'Test-Säule', 'Zum Testen');
		await setWeights(page, [{ id: created.id, weight: 100 }]);

		await page.reload();
		await waitForStableView(page);
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Jetzt ist die Säulen-Liste sichtbar.
		await expect(page.locator('.dashboard-pillars-list')).toBeVisible();

		// Letzte Säule wieder löschen.
		await deletePillar(page, created.id);

		await page.reload();
		await waitForStableView(page);
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Empty-State erscheint wieder.
		await expect(page.locator('.dashboard-pillars')).toBeVisible();
	});
});
