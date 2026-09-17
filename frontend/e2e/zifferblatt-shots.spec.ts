import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

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

const VARIANTEN = ['herz', 'blasen', 'scheiben', 'ringe', 'strahlen', 'bluete', 'kristall'] as const;

/** Säulen mit gleichem Ziel und ungleichem Ist — die Schieflage, an der man die Bilder liest. */
const SAEULEN = [
	{ name: 'Körper', weight: 20, tasks: 6 },
	{ name: 'Geist', weight: 20, tasks: 3 },
	{ name: 'Arbeit', weight: 20, tasks: 3 },
	{ name: 'Familie', weight: 20, tasks: 2 },
	{ name: 'Freunde', weight: 20, tasks: 1 },
];

test.describe('Zifferblätter — Bilder fürs Auge', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten (siehe Kopfkommentar).');

	test('legt von jeder Variante einen Screenshot ab', async ({ page }) => {
		// Echte Session, unabhängig von der lokalen `.env` (siehe Kopfkommentar).
		const login = await page.request.post('/auth/test-login', {
			data: { email: 'shots@example.com', displayName: 'Zifferblatt' },
		});
		expect(login.ok(), 'test-login muss eine Session liefern').toBeTruthy();

		await page.goto('/');
		await waitForStableView(page);

		// Säulen anlegen und gewichten, dann je Säule erledigte Tasks — daraus entsteht die Verteilung.
		for (const saeule of SAEULEN) {
			const created = await page.request.post('/api/v1/pillars', {
				data: { name: saeule.name, description: '', weight: saeule.weight },
			});
			const pillar = (await created.json()) as { id: number };
			for (let index = 0; index < saeule.tasks; index += 1) {
				// Punkte je Säule sind der **erledigte geschätzte Aufwand** (`doneEstimatedEffort`,
				// siehe `Dashboard.tsx`) — ein Task ohne Aufwand oder ohne Status `Done` trägt nichts bei.
				const task = await page.request.post('/api/v1/tasks', {
					data: {
						title: `${saeule.name} ${index + 1}`,
						estimatedEffort: 1,
						pillars: [{ pillarId: pillar.id, share: 100, confidence: 80 }],
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
			 * Wahl über `evaluate` + `reload`, nicht über `addInitScript`: Ein Init-Skript je Durchlauf
			 * zu registrieren staffelt sie auf, und es gewänne nur deshalb die richtige Variante, weil
			 * das zuletzt registrierte zuletzt läuft — eine Reihenfolge-Eigenschaft, auf die sich
			 * niemand festlegt.
			 */
			await page.evaluate((value) => localStorage.setItem('pp-balance-variant', value), variante);
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
