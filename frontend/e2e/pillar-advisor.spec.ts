import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für den Säulen-Berater (Aktivitäten-Ratgeber): Über das Glühbirnen-Symbol im Header
 * öffnet sich ein Modal, das per `POST /api/v1/pillars/advisor` (Mistral) konkrete Aktivitäten
 * vorschlägt und zeigt, auf welche Säulen sie einzahlen würden.
 *
 * **Mocks:** Der Advisor-Endpoint wird gezielt per `page.route` abgefangen (kein echtes LLM im
 * Test — analog `quick-capture.spec.ts`). Alle übrigen Requests (insbesondere `GET /api/v1/pillars`
 * für die Säulen-Namen der Badges) gehen unverändert an das echte Backend mit den gesäten
 * Säulen-Stammdaten.
 */
test.describe('Säulen-Berater (Aktivitäten-Ratgeber)', () => {
	/** Öffnet den Säulen-Berater über die Header-Toolbar. */
	const openAdvisor = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Säulen-Berater' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
		await waitForStableView(page);
	};

	test('Toolbar-Button öffnet das Berater-Modal mit Fragefeld und CTA', async ({ page }) => {
		await openAdvisor(page);

		await expect(page.getByRole('textbox', { name: /Deine Frage oder Situation/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toBeVisible();
	});

	test('zeigt Vorschläge mit Aktivität, Säulen-Badges und Begründung an', async ({ page }) => {
		// Die realen Säulen-IDs aus dem Backend holen, damit die gemockte Antwort auf die vom
		// Frontend geladene Säulen-Liste passt (die Badges lösen pillarIds zu Namen auf).
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
							activity: 'Spaziergang mit einem Freund',
							reason: 'Bewegung und gemeinsame Zeit in einem.',
							pillarIds: [koerper!.id, beziehungen!.id],
						},
					],
				}),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir am Wochenende gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// Bewusst NICHT auf role=dialog gescoped: der Modal-Inhalt ist ge-slottetes Light-DOM des
		// <kol-dialog>-Hosts und damit kein DOM-Nachfahre des nativen <dialog> im Shadow-DOM.
		const results = page.locator('.advisor-results');
		await expect(results.getByText('Spaziergang mit einem Freund')).toBeVisible();
		await expect(results.getByText('Bewegung und gemeinsame Zeit in einem.')).toBeVisible();
		// Die pillarIds werden zu den Säulen-Namen aufgelöst (Badges).
		await expect(results.getByText('Körper')).toBeVisible();
		await expect(results.getByText('Beziehungen')).toBeVisible();
	});

	test('zeigt die Fehlermeldung des Servers, wenn die Beratung fehlschlägt', async ({ page }) => {
		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'MISTRAL_API_KEY ist nicht gesetzt.' }),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		await expect(page.getByText('Beratung fehlgeschlagen')).toBeVisible();
	});
});
