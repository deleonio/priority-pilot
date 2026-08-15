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

		test('Lektorat-Aufruf aktualisiert Titel-Feld', async ({ page }) => {
			// AK 3: Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
			// Spec Journey 3: Feldwert wird mit lektoriertem Titel überschrieben
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			// ≤30 Zeichen (TITLE_MAX_LENGTH), sonst trunkiert der native maxlength-Attribute den
			// Fill und der Test prüft nicht mehr das Lektorat.
			await titleInput.fill('Grosses projekt DRINGEND');

			const requests: unknown[] = [];
			await page.route(LEKTORAT_URL, async (route) => {
				requests.push(route.request().postDataJSON());
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ text: 'Großes Projekt dringend' }),
				});
			});

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Feld wird mit der (gemockten) Lektorat-Antwort überschrieben — deterministisch,
			// statt auf eine nicht-deterministische echte LLM-Antwort zu wetten.
			await expect(titleInput).toHaveValue('Großes Projekt dringend');

			// Vertrag: der aktuelle Feldwert + maxLength=30 (Spec Journey 3 „und kürzen") gehen mit.
			expect(requests).toHaveLength(1);
			expect(requests[0]).toEqual({ text: 'Grosses projekt DRINGEND', maxLength: 30 });
		});

		test('Button deaktiviert während Lektorat-Call', async ({ page }) => {
			// AK 5: Button ist während des Lektorat-Calls deaktiviert (Ladezustand)
			// Spec Journey 3: Button deaktiviert sich, zeigt Ladezustand
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await titleInput.fill('Test Titel mit Fehlern');

			// Delay im Handler hält die Antwort 2s zurück — das Disabled-Fenster ist damit sicher beobachtbar
			// (ein echter 503 vom E2E-Backend ohne Key kommt in Millisekunden → Race).
			await mockLektoratSuccess(page, 'Testtitel mit Fehlern', 2000);

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Button sollte während des API-Calls deaktiviert sein
			await expect(lektoratButton).toBeDisabled();

			// Nach Abschluss sollte Button wieder aktiv sein
			await expect(lektoratButton).toBeEnabled({ timeout: 10000 });
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

		test('Lektorat-Aufruf aktualisiert Beschreibung-Feld', async ({ page }) => {
			// AK 3: Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
			// Spec Journey 4: Feldwert wird mit lektorierter Beschreibung überschrieben
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await descriptionTextarea.fill('Dies ist die beschreibung fuer die aufgabe');

			await mockLektoratSuccess(page, 'Dies ist die Beschreibung für die Aufgabe');

			const lektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await lektoratButton.click();

			await expect(descriptionTextarea).toHaveValue('Dies ist die Beschreibung für die Aufgabe');
		});

		test('Button deaktiviert während Lektorat-Call für Beschreibung', async ({ page }) => {
			// AK 5: Button ist während des Lektorat-Calls deaktiviert (Ladezustand)
			// Spec Journey 4: Button deaktiviert sich, zeigt Ladezustand
			await openTaskForm(page);

			const descriptionTextarea = page.getByRole('textbox', { name: 'Beschreibung (optional)' });
			await descriptionTextarea.fill('Test Beschreibung mit Fehlern');

			await mockLektoratSuccess(page, 'Testbeschreibung mit Fehlern', 2000);

			const lektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await lektoratButton.click();

			// Button sollte während des API-Calls deaktiviert sein
			await expect(lektoratButton).toBeDisabled();

			// Nach Abschluss sollte Button wieder aktiv sein
			await expect(lektoratButton).toBeEnabled({ timeout: 10000 });
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

	test.describe('State + Ref Konsistenz', () => {
		test('State + Ref werden beide aktualisiert nach Lektorat', async ({ page }) => {
			// Spec Journey 3 & 4: Feldwert wird mit lektoriertem Text überschrieben (State + Ref)
			await openTaskForm(page);

			const titleInput = page.getByRole('textbox', { name: 'Titel' });
			await titleInput.fill('Original Titel');

			await mockLektoratSuccess(page, 'Lektorierter Titel');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Nach Lektorat sollte der neue Wert im Input sichtbar sein
			await expect(titleInput).toHaveValue('Lektorierter Titel');

			// Durch erneutes Fokussieren und Verlassen sollte sich der Wert nicht ändern
			// (Ref und State halten denselben Wert, kein Zurückfallen auf den alten Text)
			await titleInput.blur();
			await titleInput.focus();
			await expect(titleInput).toHaveValue('Lektorierter Titel');
		});
	});
});
