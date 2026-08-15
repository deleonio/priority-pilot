import { expect, test, type Page } from './fixtures';

// Spec-Referenz: Journey 3 & 4 in docs/spec/issue-645.md
// Akzeptanzkriterien aus Issue 680:
// 2. TaskForm zeigt an Titel-Input und Beschreibung-Textarea einen "Lektorieren"-Button
// 3. Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
// 4. Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
// 5. Button ist während des Lektorat-Calls deaktiviert (Ladezustand)

test.describe('Lektorat Smart Button', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		await page.goto('/');
	});

	test.describe('Journey 3: Titel lektorieren und kürzen', () => {
		test('Smart Button für Titel-Input existiert', async ({ page }) => {
			// AK 2: TaskForm zeigt an Titel-Input einen "Lektorieren"-Button
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await expect(titleInput).toBeVisible();

			// Smart Button sollte neben dem Titel-Input sichtbar sein
			const lektoratButton = page.locator('button:has-text("Lektorieren")').first();
			await expect(lektoratButton).toBeVisible();
		});

		test('Button-Label spezifisch für Titel', async ({ page }) => {
			// Spec Journey 3: Button-Label "Titel lektorieren" bei Titel-Input
			await page.click('[data-testid="quick-capture-button"]');

			const titleLektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await expect(titleLektoratButton).toBeVisible();
		});

		test('Lektorat-Aufruf aktualisiert Titel-Feld', async ({ page }) => {
			// AK 3: Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
			// Spec Journey 3: Feldwert wird mit lektoriertem Titel überschrieben
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('GROSSES PROJEKT mit viel Aufwand und DRINGEND');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Nach erfolgreichem Lektorat sollte der Titel geändert sein
			// (tatsächliche Änderung hängt vom LLM ab)
			const newTitle = await titleInput.inputValue();
			expect(newTitle).not.toBe('GROSSES PROJEKT mit viel Aufwand und DRINGEND');
		});

		test('Button deaktiviert während Lektorat-Call', async ({ page }) => {
			// AK 5: Button ist während des Lektorat-Calls deaktiviert (Ladezustand)
			// Spec Journey 3: Button deaktiviert sich, zeigt Ladezustand
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('Test Titel mit Fehlern');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Button sollte während des API-Calls deaktiviert sein
			await expect(lektoratButton).toBeDisabled();

			// Nach Abschluss sollte Button wieder aktiv sein
			await expect(lektoratButton).toBeEnabled({ timeout: 10000 });
		});

		test('Ladezustand wird während API-Call angezeigt', async ({ page }) => {
			// Spec Journey 3: Ladezustand wird während des API-Calls angezeigt
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('Test Titel');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Wir prüfen, dass der Button disabled ist (Ladezustand)
			await expect(lektoratButton).toBeDisabled();
		});
	});

	test.describe('Journey 4: Beschreibung lektorieren', () => {
		test('Smart Button für Beschreibung-Textarea existiert', async ({ page }) => {
			// AK 2: TaskForm zeigt an Beschreibung-Textarea einen "Lektorieren"-Button
			await page.click('[data-testid="quick-capture-button"]');

			const descriptionTextarea = page.locator('textarea[name="description"]');
			await expect(descriptionTextarea).toBeVisible();

			// Smart Button sollte neben der Beschreibung-Textarea sichtbar sein
			const lektoratButtons = page.locator('button:has-text("Lektorieren")');
			await expect(lektoratButtons).toHaveCount(2); // Einer für Titel, einer für Beschreibung
		});

		test('Button-Label spezifisch für Beschreibung', async ({ page }) => {
			// Spec Journey 4: Button-Label "Beschreibung lektorieren" bei Textarea
			await page.click('[data-testid="quick-capture-button"]');

			const descriptionLektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await expect(descriptionLektoratButton).toBeVisible();
		});

		test('Lektorat-Aufruf aktualisiert Beschreibung-Feld', async ({ page }) => {
			// AK 3: Button-Aufruf sendet aktuellen Feldwert an Backend, aktualisiert Feld mit Antwort
			// Spec Journey 4: Feldwert wird mit lektorieter Beschreibung überschrieben
			await page.click('[data-testid="quick-capture-button"]');

			const descriptionTextarea = page.locator('textarea[name="description"]');
			await descriptionTextarea.fill('Dies ist die beschreibung für die aufgabe die viel arbeit macht');

			const lektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await lektoratButton.click();

			// Nach erfolgreichem Lektorat sollte die Beschreibung geändert sein
			const newDescription = await descriptionTextarea.inputValue();
			expect(newDescription).not.toBe('Dies ist die beschreibung für die aufgabe die viel arbeit macht');
		});

		test('Button deaktiviert während Lektorat-Call für Beschreibung', async ({ page }) => {
			// AK 5: Button ist während des Lektorat-Calls deaktiviert (Ladezustand)
			// Spec Journey 4: Button deaktiviert sich, zeigt Ladezustand
			await page.click('[data-testid="quick-capture-button"]');

			const descriptionTextarea = page.locator('textarea[name="description"]');
			await descriptionTextarea.fill('Test Beschreibung mit Fehlern');

			const lektoratButton = page.locator('button:has-text("Beschreibung lektorieren")');
			await lektoratButton.click();

			// Button sollte während des API-Calls deaktiviert sein
			await expect(lektoratButton).toBeDisabled();

			// Nach Abschluss sollte Button wieder aktiv sein
			await expect(lektoratButton).toBeEnabled({ timeout: 10000 });
		});
	});

	test.describe('Fehlerbehandlung', () => {
		test('Zeigt KolAlert bei LLM-Fehlern', async ({ page }) => {
			// AK 4: Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
			// Spec Journey 3 & 4: Bei Fehler wird KolAlert mit verständlicher Fehlermeldung gezeigt
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('Text der einen Fehler auslöst');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// KolAlert sollte mit Fehlermeldung erscheinen
			const kolAlert = page.locator('[data-testid="kol-alert"], .alert, [role="alert"]');
			await expect(kolAlert).toBeVisible({ timeout: 10000 });
		});

		test('Kein Absturz bei LLM-Fehlern', async ({ page }) => {
			// AK 4: Bei LLM-Fehlern wird dem Nutzer eine verständliche Fehlermeldung gezeigt
			// Statt Absturz sollte Alert erscheinen
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('Fehler-Auslösender Text');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Seite sollte noch geladen sein, kein Absturz

			// Form sollte noch interaktiv sein
			await expect(titleInput).toBeVisible();
		});
	});

	test.describe('State + Ref Konsistenz', () => {
		test('State + Ref werden beide aktualisiert nach Lektorat', async ({ page }) => {
			// Spec Journey 3 & 4: Feldwert wird mit lektoriertem Text überschrieben (State + Ref)
			await page.click('[data-testid="quick-capture-button"]');

			const titleInput = page.locator('input[name="title"]');
			await titleInput.fill('Original Titel mit Fehlern');

			const lektoratButton = page.locator('button:has-text("Titel lektorieren")');
			await lektoratButton.click();

			// Nach Lektorat sollte der neue Wert im Input sichtbar sein
			const newTitle = await titleInput.inputValue();
			expect(newTitle).not.toBe('Original Titel mit Fehlern');

			// Durch erneutes Fokussieren und Verlassen sollte sich der Wert nicht ändern
			await titleInput.blur();
			await titleInput.focus();
			const sameTitle = await titleInput.inputValue();
			expect(sameTitle).toBe(newTitle);
		});
	});
});
