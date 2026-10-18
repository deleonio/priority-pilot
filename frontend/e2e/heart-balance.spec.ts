import { expect, test, type Page } from './fixtures';
import { waitForStableView, fullPillarContributions, registerOwnSession, MOBILE } from './helpers';

/**
 * E2E-Spec für das Balance-Bild der Startseite (Lebensbalance).
 *
 * Nagelt den Kernpunkt fest, den nur die echte Seite belegen kann: Das Bild steht als erstes Widget
 * des Dashboards, ist horizontal mittig und bleibt auf schmalen Viewports innerhalb der Seite. Die
 * Segmentierung je Säule und die Rechnung prüfen die Komponenten- und Unit-Tests. Geprüft wird die
 * Standard-Variante „Herz" (`docs/zifferblatt-konzept.md`); die übrigen Bilder teilen sich
 * Bühne und Layout mit ihr.
 *
 * Die Breiten-Prüfung misst **Bounding-Boxen**, nicht `documentElement.scrollWidth`: Die App-Shell
 * clippt mit `overflow-x: hidden`, `scrollWidth` bleibt dadurch strukturell unter der Viewport-Breite
 * und eine Assertion darauf kann gar nicht fehlschlagen (Memory 2026-08-24, dort mit Mutationssonde
 * belegt). Geprüft wird zusätzlich bei 320 px, weil das Karten-Padding auf 375 px genug Überlauf
 * schluckt, um einen echten Fehler zu verstecken.
 */
test.describe('Dashboard — Herz der Lebensbalance', () => {
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	/** Bringt das Dashboard mit mindestens einem Task in den Blick (sonst fehlt der Tab). */
	const openDashboard = async (page: Page): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Herz Balance' } });
		// Bildwahl liegt am Konto (#2009): Andere Specs (z. B. `balance-variant.spec.ts`) lassen sonst ihre Wahl zurück.
		const token = (await page.request.get('/api/v1/balance-variant')).headers()['x-csrf-token'];
		await page.request.put('/api/v1/balance-variant', {
			data: { variant: 'herz' },
			headers: token ? { 'x-csrf-token': token } : {},
		});

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('zeigt bis zur ersten Server-Antwort den Ladeindikator auf der Bühne', async ({ page }) => {
		// Erster Start ohne gerätelokalen Spiegel (frische Session): Die Balance-Antwort bleibt
		// bewusst aus — erst der Block macht das Warten deterministisch, sonst rennt die Assertion
		// gegen die Netzantwort. Geprüft wird die Sichtbarkeit, nicht nur DOM-Präsenz: Der Melder
		// sitzt in der per Inline-Style verborgenen Bühne und hebt die geerbte Unsichtbarkeit nur
		// mit eigenem `visibility: visible` auf (Kreuzverhör #2740).
		await page.route('**/scores/balance?*', () => new Promise(() => undefined));
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		const loading = page.locator('.heart-balance-loading');
		await expect(loading).toBeVisible();

		// Erste Antwort: Der Indikator entfällt wieder.
		await page.unroute('**/scores/balance?*');
		await page.reload();
		await waitForStableView(page);
		await expect(loading).toBeHidden();
	});

	test('steht als erstes Widget und mittig in seiner Karte (375×812)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);

		const heart = page.getByTestId(/heart-balance-(canvas|svg)/);
		await expect(heart).toBeVisible();

		// Je Säule eine Zeile in der Legende — ohne gepflegte Säulen gäbe es die Karte gar nicht.
		expect(await page.getByTestId('heart-balance-legend-row').count()).toBeGreaterThan(0);

		// Horizontal mittig: die Grafik-Mitte liegt auf der Mitte ihrer Karte (1 px Toleranz für
		// subpixelgenaues Layout).
		const heartBox = await heart.boundingBox();
		const cardBox = await page.locator('.dashboard-heart').boundingBox();
		expect(heartBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		const heartCenter = heartBox!.x + heartBox!.width / 2;
		const cardCenter = cardBox!.x + cardBox!.width / 2;
		expect(Math.abs(heartCenter - cardCenter)).toBeLessThanOrEqual(1);

		// Das Herz ist das erste Widget unter der Begrüßung — es steht über den Statuskacheln.
		const cardsBox = await page.locator('.dashboard-cards').boundingBox();
		expect(cardsBox).not.toBeNull();
		expect(cardBox!.y).toBeLessThan(cardsBox!.y);
	});

	// Die Grafik rendert mit `overflow: visible` und der Herzschlag skaliert über die Viewbox hinaus —
	// genau die Kombination, die auf schmalen Geräten überläuft, wenn eine Breite einmal absolut
	// statt relativ gesetzt wird.
	for (const width of [375, 320]) {
		test(`bleibt bei ${width} px innerhalb der Seitenbreite`, async ({ page }) => {
			await page.setViewportSize({ width, height: 812 });
			await openDashboard(page);

			await expect(page.getByTestId(/heart-balance-(canvas|svg)/)).toBeVisible();

			for (const selector of ['.dashboard-heart', '.heart-balance-stage', '.heart-balance-legend']) {
				const box = await page.locator(selector).boundingBox();
				expect(box, `${selector} hat keine Bounding-Box`).not.toBeNull();
				expect(box!.x, `${selector} ragt links aus der Seite`).toBeGreaterThanOrEqual(-1);
				expect(box!.x + box!.width, `${selector} ragt rechts aus der Seite`).toBeLessThanOrEqual(width + 1);
			}
		});
	}

	// #2645 (docs/spec/issue-2645.md): Auf leerem Konto (0 Erledigungen) steht der Einstiegssatz
	// genau einmal — CareHint (`anlass 'einstieg'`) UND Begründungszeile der nächsten Aufgabe
	// (`reasons.einstieg`) sind aktuell inhaltsgleich doppelt sichtbar. Die Karten bleiben bei
	// 375 px in der Seitenbreite (Bounding-Box statt scrollWidth — App-Shell clippt, Memory 2026-08-24).
	test('Einstiegssatz genau einmal, Karten bleiben bei 375 px in der Seite (#2645/AK3+AK4)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		// Eigene Session (Muster #2132-Fixup): frisches Konto = genau fünf gewichtete Standard-Säulen,
		// 0 Erledigungen — CareHint (`anlass 'einstieg'`) und `/next` (`reasons.einstieg`) greifen
		// beide deterministisch.
		await registerOwnSession(page, 'issue-2645');
		const pillars = (
			(await (await page.request.get('/api/v1/pillars')).json()) as { id: number; weight: number }[]
		).filter((kontoSaeule) => kontoSaeule.weight > 0);
		const created = await page.request.post('/api/v1/tasks', {
			data: {
				title: 'E2E Herz Balance 2645',
				priority: 1,
				estimatedEffort: 1,
				// Vollverteilung (#2077): ohne Beitrag bliebe `reasons.einstieg` aus — `defizitSaeulen`
				// folgt den Task-Beiträgen, nicht den Konto-Säulen.
				pillars: fullPillarContributions(pillars, 0, 80),
			},
		});
		expect(created.status(), 'Setup: Task-Anlage muss 201 liefern').toBe(201);

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		const satz = 'Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt.';
		const hinweis = page.getByTestId('care-hint');
		await expect(hinweis).toBeVisible();
		await expect(hinweis).toContainText('Such dir eine kleine Aufgabe');

		// Genau einmal im ganzen Dashboard: die inhaltsgleiche Begründungszeile entfällt daneben.
		await expect(page.getByText(satz, { exact: true })).toHaveCount(1);

		for (const selector of ['.care-hint', '.dashboard-next-task']) {
			const box = await page.locator(selector).boundingBox();
			expect(box, `${selector} hat keine Bounding-Box`).not.toBeNull();
			expect(box!.x, `${selector} ragt links aus der Seite`).toBeGreaterThanOrEqual(-1);
			expect(box!.x + box!.width, `${selector} ragt rechts aus der Seite`).toBeLessThanOrEqual(375 + 1);
		}
	});

	test('Höhen-Deckel: Bühne bleibt auf kurzem Viewport lesbar (844×390)', async ({ page }) => {
		await page.setViewportSize({ width: 844, height: 390 });
		await openDashboard(page);

		const box = await page.locator('.heart-balance-stage').boundingBox();
		expect(box, 'Bühne vorhanden').not.toBeNull();
		expect(box!.width, 'Bühne mindestens 12rem breit').toBeGreaterThanOrEqual(192 - 1);
	});

	test('Höhen-Deckel: Ablesewert liegt im Viewport (375×812)', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await openDashboard(page);

		const box = await page.locator('.heart-balance-readout').boundingBox();
		expect(box, 'Ablesewert vorhanden').not.toBeNull();
		expect(box!.y + box!.height, 'Ablesewert unterhalb des Viewports').toBeLessThanOrEqual(MOBILE.height);
	});
});
