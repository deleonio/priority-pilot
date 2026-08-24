import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #620 — Frontend-Error-Handling für LLM-Calls bei Mistral-Ausfall/Timeout.
 *
 * Vertrag: Bei Ausfall/Timeout des Mistral-Dienstes zeigt das Frontend eine verständliche
 * Fehlermeldung für Nutzer statt roher HTTP 502/503-Fehlercodes. Optional wird bei
 * transienten 5xx-Fehlern ein Retry versucht.
 *
 * **Spec-Bezug:** docs/spec/issue-620.md — Journey "KI-Dienst-Ausfall behandeln"
 *
 * **Akzeptanzkriterien:**
 * - AK1: Bei HTTP 502/503 wird verständliche Fehlermeldung statt rohem Fehlercode angezeigt
 * - AK2: Fehlermeldung ist nutzerfreundlich formuliert (z.B. "KI-Dienst gerade nicht erreichbar")
 * - AK3: Optionaler Retry bei transienten 5xx-Fehlern
 *
 * **Mocks:** Die LLM-Endpoints werden gezielt per `page.route` abgefangen (kein echtes LLM).
 * Parse-text (`POST /api/v1/tasks/parse-text`) und Advisor (`POST /api/v1/pillars/advisor`).
 *
 * **Isolation:** Keine Persistenz — Fehlerzustand wird nicht gespeichert, Nutzer kann es erneut versuchen.
 */
test.describe('Frontend-Error-Handling für LLM-Calls (#620)', () => {
	/** Öffnet den Quick-Capture-Dialog über die Toolbar. */
	const openQuickCapture = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
	};

	/** Öffnet den Säulen-Berater über die Header-Toolbar. */
	const openAdvisor = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Säulen-Berater' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
		await waitForStableView(page);
	};

	test('AK1: HTTP 502 bei parse-text zeigt verständliche Fehlermeldung statt rohem Fehlercode', async ({ page }) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 2-3
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Bad Gateway' }),
			}),
		);

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für Mistral-Ausfall');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Verständliche Meldung statt technischem "502 Bad Gateway"
		await expect(page.getByText(/KI-Dienst.*nicht erreichbar/)).toBeVisible();
	});

	test('AK1: HTTP 503 bei parse-text zeigt verständliche Fehlermeldung statt rohem Fehlercode', async ({ page }) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 2-3
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Service Unavailable' }),
			}),
		);

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für Service Unavailable');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Verständliche Meldung statt technischem "503 Service Unavailable"
		await expect(page.getByText(/KI-Dienst.*nicht erreichbar/)).toBeVisible();
	});

	test('AK1: HTTP 502 bei Säulen-Berater zeigt verständliche Fehlermeldung statt rohem Fehlercode', async ({
		page,
	}) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 2-3
		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Bad Gateway' }),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// Vertrag: Verständliche Meldung statt technischem "502 Bad Gateway"
		await expect(page.getByText(/KI-Dienst.*nicht erreichbar/)).toBeVisible();
	});

	test('AK2: Fehlermeldung ist nutzerfreundlich formuliert (keine technischen Fehlercodes)', async ({ page }) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 3
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Bad Gateway: Mistral API timeout' }),
			}),
		);

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für nutzerfreundliche Fehlermeldung');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Klartext-Text wie "KI-Dienst gerade nicht erreichbar, bitte später erneut"
		// NEGATIV-Test: In der FEHLERMELDUNG (KolAlert) dürfen keine technischen Begriffe
		// wie "502", "Bad Gateway", "timeout" stehen. Bewusst auf das Alert gescoped: Ein
		// seitenweiter getByText-Match trifft auch die Footer-Versionsanzeige —
		// „Version 0.1.502" matcht /502/ und färbte ab Release v0.1.502 die CI rot.
		// Anchor ist der kol-alert-Host (Slot-Text ist Light-DOM), nicht getByRole('alert') —
		// KolAlert exponiert die Rolle nicht zuverlässig (gleiches Muster wie geolocation.spec).
		// Die positive Assertion auf DEMSELBEN Anchor verhindert ein vakuum-grünes Negativ.
		const meldung = page.locator('kol-alert');
		await expect(meldung).toContainText(/KI-Dienst.*nicht erreichbar/);
		await expect(meldung.getByText(/502|503|Bad Gateway|timeout|Service Unavailable/i)).not.toBeVisible();
	});

	test('AK3: Optionaler Retry bei transienten 5xx-Fehlern (parse-text)', async ({ page }) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 2 (optionaler Retry)
		let attemptCount = 0;
		await page.route('**/api/v1/tasks/parse-text', (route: Route) => {
			attemptCount++;
			if (attemptCount === 1) {
				// Erster Versuch: 502
				return route.fulfill({
					status: 502,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Bad Gateway' }),
				});
			}
			// Zweiter Versuch: Erfolg
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					title: 'Nach Retry erfolgreicher Task',
					description: 'Beschreibung nach Retry',
					priority: 3,
				}),
			});
		});

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für Retry-Logik');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Bei transientem Fehler wird Retry versucht, bei Erfolg erscheint das Formular
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Nach Retry erfolgreicher Task');
		expect(attemptCount).toBe(2);
	});

	test('AK3: Optionaler Retry bei persistenten Fehlern zeigt Fehlermeldung nach Retry-Erschöpfung', async ({
		page,
	}) => {
		// Spec-Bezug: Journey "KI-Dienst-Ausfall behandeln" → Schritt 2 (Retry-Erschöpfung)
		let attemptCount = 0;
		await page.route('**/api/v1/tasks/parse-text', (route: Route) => {
			attemptCount++;
			// Alle Versuche fehlschlagen mit 502
			return route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Bad Gateway' }),
			});
		});

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für persistente Fehler');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Nach Retry-Erschöpfung wird verständliche Fehlermeldung angezeigt
		await expect(page.getByText(/KI-Dienst.*nicht erreichbar/)).toBeVisible();
		// Retry sollte begrenzt sein (z.B. 2 Versuche)
		expect(attemptCount).toBeGreaterThan(1);
		expect(attemptCount).toBeLessThanOrEqual(3);
	});

	test('Edge-Case: API-Key ungültig zeigt verständliche Fehlermeldung', async ({ page }) => {
		// Spec-Bezug: Randfälle & Fehler → "API-Key ungültig"
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unauthorized: Invalid API key' }),
			}),
		);

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für ungültigen API-Key');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Verständliche Meldung über Konfigurationsproblem
		await expect(page.getByText(/Konfiguration|API.*Key|ungültig/i)).toBeVisible();
	});

	test('Edge-Case: Client-seitige Netzwerkprobleme zeigen verständliche Fehlermeldung', async ({ page }) => {
		// Spec-Bezug: Randfälle & Fehler → "Netzwerkprobleme (Client-seitig)"
		await page.route(
			'**/api/v1/tasks/parse-text',
			(route: Route) => route.abort('failed'), // Simuliert Netzwerkfehler
		);

		await openQuickCapture(page);
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Test für Netzwerkprobleme');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Vertrag: Verständliche Meldung über Netzwerkprobleme
		await expect(page.getByText(/Netzwerk|Verbindung|keine Internet/i)).toBeVisible();
	});
});
