import { expect, test } from './fixtures';
import { waitForStableView, fullPillarContributions } from './helpers';

/**
 * **Kein Prüf-Spec, sondern ein Bildmacher.** Er fährt das Dashboard mit einer echten Session hoch,
 * schaltet die Zifferblätter durch (`docs/zifferblatt-konzept.md`) und legt von jedem einen
 * Screenshot in `e2e/__shots__/` ab — zum Anschauen, nicht zum Vergleichen.
 *
 * **Läuft nur mit gesetztem `SHOTS`:**
 *
 * ```
 * SHOTS=1 pnpm exec playwright test e2e/zifferblatt-shots.spec.ts
 * ```
 *
 * Ohne die Variable überspringt er sich. Der Grund ist nicht Geschmack: Er nagelt nichts fest, was
 * in CI fehlschlagen dürfte, kostet dort aber eine halbe Minute — und liegt als `.spec.ts` sonst
 * mitten im normalen Lauf (`testDir: 'e2e'` greift jede Datei). Ein `testIgnore` in der Config
 * schiede ihn auch beim ausdrücklichen Aufruf aus; das Env-Gate lässt ihn starten, wenn man ihn
 * will.
 *
 * **Warum `POST /auth/test-login` und nicht die Fixture allein:** Die Fixture mockt `/auth/me` nur
 * im Browser. Sobald in einer lokalen `server/.env` ein `SESSION_SECRET` steht, ist `isAuthActive()`
 * scharf (`server/src/express/requireAuth.ts`) und jede API-Route antwortet 401 — die App zeigt dann
 * „Session abgelaufen" statt des Dashboards. Der Test-Login erzeugt eine echte Session und ist damit
 * unabhängig davon, was auf dem jeweiligen Rechner in der `.env` steht.
 */

const VARIANTEN = ['strahlen', 'bluete', 'kristall', 'zeiger'] as const;

test.describe('Zifferblätter — Bilder fürs Auge', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten (siehe Kopfkommentar).');

	// Vier Varianten je mit Reload, Auftakt und Wartezeit — der Default-Timeout (30 s) reicht dafür nicht.
	test.setTimeout(180_000);

	test('legt von jeder Variante einen Screenshot ab', async ({ page }) => {
		/*
		 * Echtes Konto mit den fünf festen Seed-Säulen: Der Test-Login (`/auth/test-login`) legt
		 * Konten OHNE Säulen-Saat an — nur die Registrierung säht die fünf Standard-Säulen (#1521).
		 * Deshalb registrieren + einloggen statt test-login.
		 */
		const konto = { email: 'shots@example.com', password: 'shots-1234' };
		await page.request.post('/auth/register', { data: konto });
		const login = await page.request.post('/auth/login', { data: konto });
		expect(login.ok(), 'login muss eine Session liefern').toBeTruthy();

		await page.goto('/app/');
		await waitForStableView(page);

		// Die fünf Seed-Säulen sind fest (#1521): angelegt wird nichts mehr. Die Schieflage entsteht
		// über ungleiche Erledigungs-Zahlen je bestehender Säule — daraus entsteht die Verteilung.
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as {
			id: number;
		}[];
		expect(pillars.length, 'Registrierung muss die fünf Seed-Säulen säen').toBe(5);
		const erledigtJeSaeule = [6, 3, 3, 2, 1];
		for (const [index] of pillars.slice(0, erledigtJeSaeule.length).entries()) {
			for (let i = 0; i < erledigtJeSaeule[index]; i += 1) {
				// Punkte je Säule sind der **erledigte geschätzte Aufwand** (`doneEstimatedEffort`,
				// siehe `Dashboard.tsx`) — ein Task ohne Aufwand oder ohne Status `Done` trägt nichts bei.
				const task = await page.request.post('/api/v1/tasks', {
					data: {
						title: `Aufgabe ${index + 1}.${i + 1}`,
						estimatedEffort: 1,
						pillars: fullPillarContributions(pillars, index, 80),
					},
				});
				const { id } = (await task.json()) as { id: number };
				const done = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
				expect(done.ok(), `Task ${id} konnte nicht erledigt werden`).toBeTruthy();
			}
		}

		// Animationen an, damit die Bilder in Bewegung gezeigt werden (Master ist per Default aus).
		await page.addInitScript(() => {
			localStorage.setItem('pp-animations-enabled', 'true');
			localStorage.setItem('pp-heart-animation-enabled', 'true');
		});

		for (const variante of VARIANTEN) {
			/*
			 * Wahl am Konto (#2009), nicht im localStorage: Beim Laden zieht die App die Konto-Wahl nach
			 * und überschreibt den Gerätespiegel. Der GET liefert den CSRF-Token für den PUT.
			 */
			const token = (await page.request.get('/api/v1/balance-variant')).headers()['x-csrf-token'];
			const gewaehlt = await page.request.put('/api/v1/balance-variant', {
				data: { variant: variante },
				headers: token ? { 'x-csrf-token': token } : {},
			});
			expect(gewaehlt.ok(), `Bildwahl ${variante} muss gespeichert werden`).toBeTruthy();
			await page.reload();
			await waitForStableView(page);
			await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
			await waitForStableView(page);

			const bild = page.getByTestId(/heart-balance-(canvas|svg)/);
			await expect(bild).toBeVisible();
			// Kurz laufen lassen: Auftakt (1,4 s) plus ein Stück Schwingung.
			await page.waitForTimeout(2500);
			// `animations: 'disabled'` ist Pflicht, nicht Kosmetik: Der Ruhepuls skaliert dauerhaft,
			// ohne das Einfrieren wartet Playwright ewig darauf, dass das Element „stabil" wird.
			await page.locator('.dashboard-heart').screenshot({
				path: `e2e/__shots__/${variante}.png`,
				animations: 'disabled',
			});
		}
	});
});
