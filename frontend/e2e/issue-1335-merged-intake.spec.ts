import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1335 — „Schnellerfassung und Berater verschmelzen".
 *
 * Spezifikation: docs/spec/issue-1335.md
 *
 * Vertrag: „Neuen Task anlegen" ist bei aktiver KI der EINZIGE Einstieg. Der Dialog bietet im
 * selben Textfeld drei Wege — „Verarbeiten und weiter" (LLM-Vorbelegung), „Beraten lassen"
 * (Aktivitäten-Vorschläge im selben Dialog) und „Überspringen" (leeres Formular). Ein übernommener
 * Berater-Vorschlag landet im Textfeld desselben Dialogs, ohne dass er sich schließt oder ein
 * zweiter Dialog entsteht. Der eigenständige „Säulen-Berater"-Button entfällt ersatzlos (AK1).
 *
 * **Mocks:** `POST /api/v1/pillars/advisor` wird per `page.route` abgefangen (kein echtes LLM,
 * Muster `pillar-advisor.spec.ts`, das dieser Datei als Vorlage diente). `GET /api/v1/pillars`
 * geht unverändert ans echte Backend (Säulen-IDs für die Badge-Auflösung).
 */
test.describe('#1335 Verschmolzener Anlege-Dialog (Schnellerfassung + Berater)', () => {
	/** Öffnet den Anlege-Dialog und bleibt im Capture-Schritt. */
	const openIntakeDialog = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await (await headerAction(page, 'Neuen Task anlegen')).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
	};

	/** Mockt den Advisor mit einem einzelnen Vorschlag; Säulen-IDs kommen vom echten Backend. */
	const mockAdvisorSuggestion = async (page: Page, activity: string): Promise<number> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number }[];
		expect(pillars.length).toBeGreaterThan(0);

		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [{ activity, reason: 'Ein guter Ausgleich.', pillarIds: [pillars[0].id] }],
				}),
			}),
		);
		return pillars[0].id;
	};

	test('AK1: der Toolbar-Button „Säulen-Berater" ist im Accessibility-Baum nicht auffindbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('button', { name: 'Säulen-Berater' })).toHaveCount(0);
	});

	test('AK2: „Beraten lassen" zeigt die Vorschlagsliste im selben Dialog — kein zweiter Dialog, kein Wechsel', async ({
		page,
	}) => {
		await mockAdvisorSuggestion(page, 'Spaziergang mit einem Freund');
		await openIntakeDialog(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Was tut mir am Wochenende gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		await expect(page.locator('.advisor-results').getByText('Spaziergang mit einem Freund')).toBeVisible();

		// Genau EIN Dialog — keine zweite Instanz, kein Heading-Wechsel.
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		// Das Textfeld bleibt im DOM und mit dem eingegebenen Text erhalten.
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveValue('Was tut mir am Wochenende gut?');
	});

	test('AK3: „Als Aufgabe übernehmen" übernimmt den Vorschlagstext ins Textfeld, ohne den Dialog zu schließen', async ({
		page,
	}) => {
		await mockAdvisorSuggestion(page, 'Joggen im Park');
		await openIntakeDialog(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Was tut mir am Wochenende gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();
		await expect(page.locator('.advisor-results').getByText('Joggen im Park')).toBeVisible();

		await page.getByRole('button', { name: 'Als Aufgabe übernehmen' }).click();
		await waitForStableView(page);

		// Der Dialog bleibt derselbe (kein Wechsel, kein Schließen).
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveValue('Joggen im Park');

		// „Verarbeiten und weiter" führt von dort ins vorbelegte Formular.
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ title: 'Joggen im Park' }),
			}),
		);
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Joggen im Park');
	});

	test('AK7: auf 375px sind Textfeld, alle Wege und die Vorschlagsliste innerhalb des Viewports bedienbar', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockAdvisorSuggestion(page, 'Spaziergang mit einem Freund');
		await openIntakeDialog(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Was tut mir gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();
		await expect(page.locator('.advisor-results').getByText('Spaziergang mit einem Freund')).toBeVisible();

		const locators = [
			page.getByRole('textbox', { name: /Beschreibe/ }),
			page.getByRole('button', { name: 'Verarbeiten und weiter' }),
			page.getByRole('button', { name: 'Beraten lassen' }),
			page.getByRole('button', { name: 'Überspringen' }),
			page.locator('.advisor-results'),
		];
		for (const locator of locators) {
			const box = await locator.boundingBox();
			expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
			if (box) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
			}
		}

		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});
});
