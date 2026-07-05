import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #328 (AK4 — Mobile-First, 375 px): Weist der Server für eine Säule einen hohen
 * Aufmerksamkeits-Score aus („wird aktuell vernachlässigt"), rendert der Säulen-Berater dazu einen
 * Hinweis. Dieser Hinweis darf im schmalen 375-px-Viewport das Layout nicht sprengen (kein
 * horizontales Scrollen).
 *
 * **Mocks:** Der Advisor-Endpoint wird per `page.route` mit einer Antwort abgefangen, die neben den
 * Vorschlägen die Aufmerksamkeits-Daten je Säule (`attention`) mitführt und eine Säule als
 * vernachlässigt markiert. Alle übrigen Requests (insbesondere `GET /api/v1/pillars` für die
 * Säulen-Namen) gehen ans echte Backend mit den gesäten Stammdaten.
 *
 * ROT, weil weder der Server die `attention`-Daten liefert noch das Frontend den Hinweis rendert.
 */
test.describe('Säulen-Berater: Aufmerksamkeits-Hinweis (Mobile-First, #328)', () => {
	/** Öffnet den Säulen-Berater über die Header-Toolbar. */
	const openAdvisor = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Säulen-Berater' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
		await waitForStableView(page);
	};

	test('AK4: Vernachlässigungs-Hinweis bricht auf 375px nicht (kein horizontales Scrollen)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Reale Säulen-IDs holen, damit die gemockte Antwort auf die vom Frontend geladene Säulen-Liste passt.
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number; name: string }[];
		const koerper = pillars.find((pillar) => pillar.name === 'Körper');
		const beziehungen = pillars.find((pillar) => pillar.name === 'Beziehungen');
		expect(koerper).toBeDefined();
		expect(beziehungen).toBeDefined();

		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [
						{
							activity: 'Ein langes Telefonat mit einer alten Freundin führen',
							reason: 'Gemeinsame Zeit stärkt vernachlässigte soziale Kontakte.',
							pillarIds: [beziehungen!.id],
						},
					],
					// Server-seitige Aufmerksamkeits-Daten: Beziehungen ist stark vernachlässigt.
					attention: [
						{ pillarId: koerper!.id, score: 0.1, neglected: false },
						{ pillarId: beziehungen!.id, score: 0.92, neglected: true },
					],
				}),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// Der Hinweis auf die vernachlässigte Säule ist sichtbar.
		await expect(page.getByText(/wird aktuell vernachlässigt/i)).toBeVisible();

		// Kein horizontales Scrollen im 375-px-Viewport (Muster aus pillar-advisor.spec.ts / AK3 #326).
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});
});
