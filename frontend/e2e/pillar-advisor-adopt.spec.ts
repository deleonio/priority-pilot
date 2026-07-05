import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #327 — „Berater-Vorschlag per Aktion direkt in Quick Capture übernehmen (Freitext
 * vorbelegt)".
 *
 * Vertrag: Jeder Vorschlag im Säulen-Berater bekommt eine Aktion „Als Aufgabe übernehmen". Ihr Klick
 * öffnet die Schnellerfassung ({@link QuickCaptureModal}) mit dem Vorschlagstext (`entry.activity`)
 * bereits im Freitextfeld — der Nutzer kann direkt „Verarbeiten und weiter" oder „Überspringen".
 *
 * **Mocks:** Der Advisor-Endpoint (`POST /api/v1/pillars/advisor`) wird gezielt per `page.route`
 * abgefangen (kein echtes LLM). AK4 mockt zusätzlich `POST /api/v1/tasks/parse-text` — analog
 * `pillar-advisor.spec.ts` / `quick-capture.spec.ts`. Alle übrigen Requests (`GET /api/v1/pillars`,
 * Anlegen/Löschen von Tasks) gehen unverändert an das echte Backend.
 *
 * **Isolation:** AK4 legt einen Task an; `afterEach` räumt alle Tasks über die echte API ab.
 */
test.describe('Berater-Vorschlag in Quick Capture übernehmen (#327)', () => {
	let runId = 0;
	const uniqueSuffix = (): string => `#${(runId += 1)}-${Date.now()}`;

	/** Löscht alle aktuell vorhandenen Tasks über die echte API (Vite-Proxy → Backend). */
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

	/**
	 * Mockt den Advisor mit einem einzelnen Vorschlag und öffnet den Berater. Die Säulen-IDs werden aus
	 * dem echten Backend geholt, damit die gemockte Antwort zur geladenen Säulen-Liste passt.
	 */
	const openAdvisorWithSuggestion = async (page: Page, activity: string): Promise<void> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number; name: string }[];
		expect(pillars.length).toBeGreaterThan(0);

		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [
						{
							activity,
							reason: 'Ein guter Ausgleich am Wochenende.',
							pillarIds: [pillars[0].id],
						},
					],
				}),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Säulen-Berater' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir am Wochenende gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// Auf das gemockte Ergebnis warten.
		await expect(page.locator('.advisor-results').getByText(activity)).toBeVisible();
	};

	test('AK3: „Als Aufgabe übernehmen" öffnet die Schnellerfassung mit dem Vorschlagstext', async ({ page }) => {
		await openAdvisorWithSuggestion(page, 'Joggen im Park');

		await page.getByRole('button', { name: 'Als Aufgabe übernehmen' }).click();
		await waitForStableView(page);

		// Der Berater-Dialog weicht der Schnellerfassung: der „Neuen Task anlegen"-Heading erscheint.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();

		// Der Vorschlagstext ist im Freitextfeld vorbelegt.
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveValue('Joggen im Park');

		// Der Primär-CTA ist ohne weitere Eingabe aktiv (vorbelegter Text zählt als Eingabe).
		await expect(page.getByRole('button', { name: 'Verarbeiten und weiter' })).toBeEnabled();
	});

	test('AK4: der Quick-Capture-Flow legt aus dem übernommenen Vorschlag einen Task an', async ({ page }) => {
		// „Verarbeiten und weiter" gezielt mocken, damit kein echtes LLM nötig ist. Der Titel wird
		// eindeutig gemacht, damit er in der Liste zweifelsfrei wiedergefunden wird.
		const title = `Joggen im Park ${uniqueSuffix()}`;
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ title }),
			}),
		);

		await openAdvisorWithSuggestion(page, 'Joggen im Park');

		await page.getByRole('button', { name: 'Als Aufgabe übernehmen' }).click();
		await waitForStableView(page);

		// Vorbelegter Text → „Verarbeiten und weiter" ohne weitere Eingabe.
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();
		await waitForStableView(page);

		// Das reguläre Formular erscheint mit dem gemockten Titel; speichern schließt den Dialog.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Der Task erscheint in der Aufgaben-Liste.
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AK5-Mobile: „Als Aufgabe übernehmen" ist auf 375-px-Viewport bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openAdvisorWithSuggestion(page, 'Joggen im Park');

		const adopt = page.getByRole('button', { name: 'Als Aufgabe übernehmen' });
		await expect(adopt).toBeVisible();

		// Kein horizontaler Overflow durch die Aktion auf schmalem Viewport.
		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);

		// Die Aktion ist klickbar und öffnet die Schnellerfassung mit vorbelegtem Text.
		await adopt.click();
		await waitForStableView(page);
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveValue('Joggen im Park');
	});
});
