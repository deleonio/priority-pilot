import { expect, test } from './fixtures';
import { waitForStableView, fullPillarContributions } from './helpers';

/**
 * **Bildmacher für die Marketing-Artikel** (docs/marketing/artikel/), gleiche Mechanik wie
 * `zifferblatt-shots.spec.ts`: echte Session über `/auth/test-login`, Schieflage über ungleiche
 * Erledigungs-Zahlen je fester Seed-Säule. Läuft nur mit `SHOTS`:
 *
 * ```
 * SHOTS=1 pnpm exec playwright test e2e/artikel-shots.spec.ts
 * ```
 *
 * Ablagen unter `e2e/__shots__/artikel/`.
 */

const ERLEDIGT_JE_SAEULE = [5, 2, 3, 2, 1];
const OFFENE_AUFGABEN = ['Steuerunterlagen sortieren', 'Zahnarzttermin vereinbaren', 'Laufplan für die Woche'];

const OUT = 'e2e/__shots__/artikel';

test.describe('Artikel-Screenshots — Bilder fürs Auge', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten.');

	// Viele Reloads und Wartezeiten (Auftakt der Figur) — der Default-Timeout reicht nicht.
	test.setTimeout(180_000);

	test('Dashboard, Streak, Fürsorge, Bildwahl — Desktop und mobil', async ({ page }) => {
		// Registrieren (säht die fünf festen Seed-Säulen, #1521) + einloggen — der Test-Login säht
		// keine Säulen, das Dashboard braucht sie aber (Herz-Karte, Streak, Fürsorge).
		const konto = { email: 'artikel@example.com', password: 'artikel-1234' };
		await page.request.post('/auth/register', { data: konto });
		const login = await page.request.post('/auth/login', { data: konto });
		expect(login.ok(), 'login muss eine Session liefern').toBeTruthy();

		await page.goto('/app/');
		await waitForStableView(page);

		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		for (const [index] of pillars.slice(0, ERLEDIGT_JE_SAEULE.length).entries()) {
			for (let i = 0; i < ERLEDIGT_JE_SAEULE[index]; i += 1) {
				const task = await page.request.post('/api/v1/tasks', {
					data: {
						title: `Aufgabe ${index + 1}.${i + 1}`,
						estimatedEffort: 1,
						pillars: fullPillarContributions(pillars, index, 80),
					},
				});
				const { id } = (await task.json()) as { id: number };
				expect((await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } })).ok()).toBeTruthy();
			}
		}
		for (const titel of OFFENE_AUFGABEN) {
			const task = await page.request.post('/api/v1/tasks', {
				data: { title: titel, estimatedEffort: 0.5, priority: 3 },
			});
			expect(task.ok()).toBeTruthy();
		}

		await page.addInitScript(() => {
			localStorage.setItem('pp-animations-enabled', 'true');
			localStorage.setItem('pp-heart-animation-enabled', 'true');
		});

		// Desktop-Dashboard
		await page.setViewportSize({ width: 1280, height: 860 });
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
		await page.waitForTimeout(2500);
		await page.screenshot({ path: `${OUT}/dashboard-desktop.png`, animations: 'disabled' });

		// Streak-Card und Fürsorge-Hinweis als Element-Shots
		await page.getByTestId('streak-card').screenshot({ path: `${OUT}/streak-card.png`, animations: 'disabled' });
		const care = page.getByTestId('care-hint').first();
		if (await care.isVisible()) {
			await care.screenshot({ path: `${OUT}/care-hint.png`, animations: 'disabled' });
		}

		// „Tag geschafft": Restaufgaben erledigen, dann erneut laden
		for (const titel of OFFENE_AUFGABEN) {
			const liste = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number; title: string }[];
			const offen = liste.find((t) => t.title === titel);
			if (offen) await page.request.patch(`/api/v1/tasks/${offen.id}`, { data: { status: 'Done' } });
		}
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
		await page.waitForTimeout(2000);
		const dayDone = page.getByTestId('day-done');
		if (await dayDone.isVisible()) {
			await dayDone.screenshot({ path: `${OUT}/tag-geschafft.png`, animations: 'disabled' });
		}

		// Mobil-Dashboard (375×812, Referenzbreite des Repos)
		await page.setViewportSize({ width: 375, height: 812 });
		await page.reload();
		await waitForStableView(page);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${OUT}/dashboard-mobil.png`, animations: 'disabled' });

		// Bildwahl in den Einstellungen — hier nicht `waitForStableView` (wartet auf „Dashboard",
		// das es auf der Settings-Seite nicht gibt), sondern direkt auf das Zielfeld.
		await page.goto('/app/settings/general');
		const wahl = page.getByTestId('balance-variant-setting');
		await expect(wahl).toBeVisible();
		await wahl.scrollIntoViewIfNeeded();
		await wahl.screenshot({ path: `${OUT}/bildwahl.png`, animations: 'disabled' });
	});
});
