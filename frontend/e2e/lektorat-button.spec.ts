import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

// Spec-Referenz: Journey 3 & 4 in docs/spec/issue-645.md
// Akzeptanzkriterien aus Issue 680:
// 2. TaskForm zeigt an Titel-Input und Beschreibung-Textarea einen "Lektorieren"-Button
// 3. Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
// 4. Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
// 5. Button ist während des Lektorat-Calls deaktiviert (Ladezustand)

/**
 * **Mocks:** `POST /api/v1/lektorat` wird per `page.route` abgefangen (Muster:
 * `issue-620-mistral-error-handling.spec.ts`). Das E2E-Backend läuft bewusst ohne LLM-Key
 * (`playwright.config.ts` leert `MISTRAL_API_KEY`) — ein ungemockter Call antwortet in
 * Millisekunden mit 503, damit wären Ladezustand und Feldinhalt nicht deterministisch prüfbar.
 */

const LEKTORAT_URL = '**/api/v1/lektorat';

/** Mockt einen erfolgreichen Lektorat-Call mit fester Antwort. `delayMs > 0` hält die Antwort
 *  zurück (setTimeout im Handler), damit der Disabled-Zustand deterministisch beobachtbar ist —
 *  `route.fulfill` selbst hat in Playwright 1.62 KEINE delay-Option (wird still ignoriert). */
const mockLektoratSuccess = async (page: Page, text: string, delayMs = 0): Promise<void> => {
	await page.route(LEKTORAT_URL, async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => {
				setTimeout(resolve, delayMs);
			});
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ text }),
		});
	});
};

/** Mockt einen LLM-Fehler (HTTP 502, wie ein Mistral-Ausfall). */
const mockLektoratError = async (page: Page): Promise<void> => {
	await page.route(LEKTORAT_URL, (route) =>
		route.fulfill({
			status: 502,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Bad Gateway' }),
		}),
	);
};

/**
 * Öffnet den „Neuen Task anlegen"-Dialog und überbrückt den Schnellerfassungs-Schritt via
 * „Überspringen", sodass das reguläre Formular sichtbar ist.
 */
const openTaskForm = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	const titleInput = page.getByRole('textbox', { name: 'Titel' });
	await expect(titleInput).toBeVisible();
};

test.describe('Lektorat Smart Button', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		await page.goto('/');
	});

	test.describe('Journey 3: Titel lektorieren und kürzen', () => {
		test('Smart Button für Titel-Input existiert', async ({ page }) => {
			// AK 2: TaskForm zeigt an Titel-Input einen "Lektorieren"-Button
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await expect(titleInput).toBeVisible();

			// Smart Button sollte neben dem Titel-Input sichtbar sein
			const lektoratButton = page.locator('button:has-text("Lektorieren")').first();
			await expect(lektoratButton).toBeVisible();
		});

		test('Button-Label spezifisch für Titel', async ({ page }) => {
			// Spec Journey 3: Button-Label "Titel lektorieren" bei Titel-Input
			await openTaskForm(page);

			const titleLektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await expect(titleLektoratButton).toBeVisible();
		});

		test('Ladezustand wird während API-Call angezeigt', async ({ page }) => {
			// Spec Journey 3: Ladezustand wird während des API-Calls angezeigt
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await titleInput.fill('Test Titel');

			await mockLektoratSuccess(page, 'Testtitel', 2000);

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Wir prüfen, dass der Button disabled ist (Ladezustand)
			await expect(lektoratButton).toBeDisabled();
		});
	});

	test.describe('Journey 4: Beschreibung lektorieren', () => {
		test('Smart Button für Beschreibung-Textarea existiert', async ({ page }) => {
			// AK 2: TaskForm zeigt an Beschreibung-Textarea einen "Lektorieren"-Button
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await expect(descriptionTextarea).toBeVisible();

			// Smart Button sollte neben der Beschreibung-Textarea sichtbar sein
			const lektoratButtons = page.locator('button:has-text("Lektorieren")');
			await expect(lektoratButtons).toHaveCount(2); // Einer für Titel, einer für Beschreibung
		});

		test('Button-Label spezifisch für Beschreibung', async ({ page }) => {
			// Spec Journey 4: Button-Label "Beschreibung lektorieren" bei Textarea
			await openTaskForm(page);

			const descriptionLektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await expect(descriptionLektoratButton).toBeVisible();
		});
	});

	test.describe('Fehlerbehandlung', () => {
		test('Zeigt verständliche Fehlermeldung bei LLM-Fehlern', async ({ page }) => {
			// AK 4: Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
			// Spec Journey 3 & 4: Bei Fehler wird KolAlert mit verständlicher Fehlermeldung gezeigt
			// Assertion wie #620-Muster: auf den nutzerfreundlichen Text, nicht auf KolAlert-Details
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await titleInput.fill('Text mit Fehlern');

			await mockLektoratError(page);

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			await expect(page.getByText(/KI-Dienst.*nicht erreichbar/)).toBeVisible({ timeout: 10000 });
		});

		test('Kein Absturz bei LLM-Fehlern', async ({ page }) => {
			// AK 4: Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
			// Statt Absturz sollte Alert erscheinen
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await titleInput.fill('Text mit Fehlern');

			await mockLektoratError(page);

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Seite sollte noch geladen sein, kein Absturz

			// Form sollte noch interaktiv sein (Button nach Fehlerende wieder aktiv)
			await expect(lektoratButton).toBeEnabled({ timeout: 10000 });
			await expect(titleInput).toBeVisible();
		});
	});
});
