import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #390: Dashboard zeigt genau drei Statuskacheln (Gesamt, Offen, Erledigt);
 * die Kachel „In Bearbeitung" ist entfernt. Bei Mobilbreite 375×812 passen alle drei Kacheln
 * ohne horizontalen Overflow in eine Reihe (AK3, Mobile-First).
 */
test.describe('Dashboard — drei Statuskacheln (Issue #390)', () => {
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

	test('AK3: genau drei Kacheln bei 375×812, kein horizontaler Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Mindestens ein Task anlegen, damit die Tab-Ansicht (inkl. Dashboard-Tab) erscheint.
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #390 Kachel-Test' } });

		await page.reload();
		await waitForStableView(page);

		// Zum Dashboard-Tab wechseln.
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		// Genau drei Kacheln sichtbar (Gesamt, Offen, Erledigt).
		await expect(page.locator('.dashboard-cards > li')).toHaveCount(3);

		// Keine InProcess-Akzentkachel vorhanden.
		await expect(page.locator('.dashboard-cards .dashboard-card-accent.inprocess')).toHaveCount(0);

		// Kein horizontaler Overflow bei 375 px.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	// Mobile-Optimierung des Dashboards: Kacheln 3er-Reihe statt 2+1-Versatz, „Was ist jetzt dran?"
	// als Panel, Gesamtguthaben mit Wert-rechts-Zeilen — alles muss bei 375 px ohne Overflow passen.
	test('AK4: gestylte Dashboard-Sektionen bei 375×812 in einer Kachelreihe, kein Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Zwei offene Tasks (einer wird zur „Nächste Aufgabe", der andere bleibt als Vorschlag)
		// und ein erledigter Task (füllt Gesamtguthaben).
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Mobile offener Task 1', priority: 2 } });
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Mobile offener Task 2', priority: 3 } });
		const doneResponse = await page.request.post('/api/v1/tasks', { data: { title: 'E2E Mobile erledigt' } });
		const doneTask = (await doneResponse.json()) as { id: number };
		await page.request.patch(`/api/v1/tasks/${doneTask.id}`, { data: { status: 'Done' } });

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		// Alle drei Kacheln sitzen in einer Reihe (gleiche Y-Position) statt 2+1-Versatz.
		const cardTopPositions = await page
			.locator('.dashboard-cards > li')
			.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
		expect(cardTopPositions).toHaveLength(3);
		expect(new Set(cardTopPositions).size).toBe(1);

		// Vorschlagsliste und Guthaben sind gerendert und sichtbar (neu gestylte Sektionen).
		await expect(page.locator('.dashboard-suggestions .dashboard-suggestion').first()).toBeVisible();
		await expect(page.locator('[data-testid="balance-total"]')).toBeVisible();

		// Kein horizontaler Overflow bei 375 px.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * Roter Spec-Test für #1985 (TF5 — docs/spec/issue-1985.md): die Karte „Nächste Aufgabe“
	 * trägt künftig die Begründungssätze; sie muss mit dieser Zusatzlänge bei 375 px UND 320 px
	 * innerhalb des Viewports bleiben (Bounding-Box, nicht scrollWidth — die App-Shell clippt),
	 * und die Aktionszeile darf nicht umbrechen. Rot, weil die Begründungsliste (Server→Karte,
	 * echte Kette) heute noch nicht gerendert wird.
	 */
	test('#1985 AK5: „Nächste Aufgabe“-Karte mit Begründungen bei 375/320 px im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', {
			data: {
				title: 'E2E #1985 Begründung',
				priority: 2,
				deadline: new Date(Date.now() + 2 * 86_400_000).toISOString(),
			},
		});
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		const karte = page.locator('.dashboard-next-task');
		await expect(karte).toBeVisible();

		// Begründungskette Ende-zu-Ende: der Task (Prio 2, Frist in zwei Tagen) bekommt mindestens einen Satz — die Priorität steht in der Meta-Zeile.
		const begruendungsSaetze = page.locator('.dashboard-next-task-reasons li');
		await expect(begruendungsSaetze.first()).toBeVisible();

		for (const breite of [375, 320]) {
			await page.setViewportSize({ width: breite, height: 812 });
			await waitForStableView(page);

			// Karte vollständig im Viewport (links und rechts), gemessen per Bounding-Box.
			const box = await karte.evaluate((el) => {
				const r = el.getBoundingClientRect();
				return { left: r.left, right: r.right };
			});
			expect(box.left, `linke Kante bei ${breite} px`).toBeGreaterThanOrEqual(-1);
			expect(box.right, `rechte Kante bei ${breite} px`).toBeLessThanOrEqual(breite + 1);

			// Aktionszeile in einer Zeile: alle Buttons auf gleicher Y-Höhe, Zeile im Viewport.
			const aktionen = page.locator('.dashboard-next-task-actions');
			const knopfTops = await aktionen
				.locator('kol-button')
				.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
			expect(knopfTops.length, 'Aktionszeile muss beide Buttons tragen').toBeGreaterThanOrEqual(2);
			expect(
				Math.max(...knopfTops) - Math.min(...knopfTops),
				`Aktionszeile umgebrochen bei ${breite} px`,
			).toBeLessThanOrEqual(2);
			const aktionenRechts = await aktionen.evaluate((el) => el.getBoundingClientRect().right);
			expect(aktionenRechts, `Aktionszeile rechts bei ${breite} px`).toBeLessThanOrEqual(breite + 1);
		}
	});
});
