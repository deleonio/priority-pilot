import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E Tests (ROT) für #425 — Säulen-Verwaltung (CRUD) im Einstellungen-Tab.
 *
 * Diese Tests schlagen fehl, solange die UI für das Anlegen, Umbenennen und
 * Löschen von Säulen nicht existiert. Sie prüfen das echte Backend (In-Memory-DB)
 * via Playwright — keine gemockten API-Requests außer /auth/me.
 */

test.describe('#425 Pillar Management — CRUD gegen das echte Backend', () => {
	/** Öffnet den Säulen-Tab in den Einstellungen. */
	const openPillarTab = async (page: Page): Promise<void> => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
	};

	/** Löscht alle existierenden Säulen über die API (für saubere Test-Isolation). */
	const deleteAllPillars = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number }[];
		// Säulen zuerst von hinten löschen (keine Fremdschlüssel-Probleme)
		for (const pillar of pillars.reverse()) {
			await page.request.delete(`/api/v1/pillars/${pillar.id}`);
		}
	};

	// Bereinigung: alle in den Tests angelegten Säulen löschen.
	test.afterEach(async ({ page }) => {
		await deleteAllPillars(page);
	});

	// ── AK1: Säule anlegen ──────────────────────────────────────────────────

	test('AK1: Säule anlegen — erscheint sofort in der Liste (Name + Beschreibung)', async ({ page }) => {
		await openPillarTab(page);

		// Name eingeben
		await page.getByRole('textbox', { name: /Name/i }).fill('Meditation');
		// Optionale Beschreibung
		await page.getByRole('textbox', { name: /Beschreibung/i }).fill('Innere Ruhe und Achtsamkeit');
		// Anlegen-Button klicken
		await page.getByRole('button', { name: /Anlegen/i }).click();

		// Die neue Säule erscheint in der Liste
		await expect(page.getByText('Meditation', { exact: true })).toBeVisible();
		// Die Beschreibung ist ebenfalls sichtbar
		await expect(page.getByText('Innere Ruhe und Achtsamkeit')).toBeVisible();

		// Die Säule ist auch im Gewichtungs-Formular sichtbar (Slider-Label enthält den Namen)
		await expect(page.locator('kol-input-range').filter({ hasText: 'Meditation' })).toBeVisible();
	});

	test('AK1: Validierung — Name darf nicht leer sein', async ({ page }) => {
		await openPillarTab(page);

		// Ohne Namen auf Anlegen klicken
		await page.getByRole('button', { name: /Anlegen/i }).click();

		// Fehlermeldung erscheint (Validation-Error vom Client oder Server)
		await expect(page.getByRole('alert')).toBeVisible();
	});

	// ── AK2: Säule umbenennen / Beschreibung ändern ─────────────────────────

	test('AK2: Säule umbenennen — Name und Beschreibung nach Änderung sichtbar', async ({ page }) => {
		await openPillarTab(page);

		// Erst eine Säule anlegen
		await page.getByRole('textbox', { name: /Name/i }).fill('Sport');
		await page.getByRole('textbox', { name: /Beschreibung/i }).fill('Bewegung');
		await page.getByRole('button', { name: /Anlegen/i }).click();
		await expect(page.getByText('Sport', { exact: true })).toBeVisible();

		// Bearbeiten-Button der neuen Säule klicken
		await page.getByRole('button', { name: /Bearbeiten/i }).click();

		// Namen ändern
		const nameInput = page.getByRole('textbox', { name: /Name/i });
		await nameInput.clear();
		await nameInput.fill('Fitness');
		// Beschreibung ändern
		const descInput = page.getByRole('textbox', { name: /Beschreibung/i });
		await descInput.clear();
		await descInput.fill('Workouts und Training');

		// Speichern
		await page.getByRole('button', { name: /Speichern/i }).click();

		// Alter Name ist weg, neuer Name ist da
		await expect(page.getByText('Sport', { exact: true })).toHaveCount(0);
		await expect(page.getByText('Fitness', { exact: true })).toBeVisible();
		await expect(page.getByText('Workouts und Training')).toBeVisible();
	});

	// ── AK3: Säule löschen ──────────────────────────────────────────────────

	test('AK3: Säule löschen mit Bestätigung — verschwindet aus Liste und Gewichtung', async ({ page }) => {
		await openPillarTab(page);

		// Säule anlegen
		await page.getByRole('textbox', { name: /Name/i }).fill('Zu löschen');
		await page.getByRole('textbox', { name: /Beschreibung/i }).fill('Diese Säule wird gelöscht');
		await page.getByRole('button', { name: /Anlegen/i }).click();
		await expect(page.getByText('Zu löschen', { exact: true })).toBeVisible();

		// Löschen-Button klicken
		await page.getByRole('button', { name: /Löschen/i }).click();

		// Bestätigungsdialog erscheint
		await expect(page.getByRole('dialog')).toBeVisible();
		// Hinweis auf betroffene Beiträge
		await expect(page.getByText(/Beiträge/i)).toBeVisible();

		// Endgültig löschen
		await page.getByRole('button', { name: /Endgültig löschen/i }).click();

		// Säule ist verschwunden
		await expect(page.getByText('Zu löschen', { exact: true })).toHaveCount(0);
	});

	test('AK3: Lösch-Abbruch — Säule bleibt erhalten', async ({ page }) => {
		await openPillarTab(page);

		await page.getByRole('textbox', { name: /Name/i }).fill('Bleiben');
		await page.getByRole('button', { name: /Anlegen/i }).click();
		await expect(page.getByText('Bleiben', { exact: true })).toBeVisible();

		// Löschen-Dialog öffnen
		await page.getByRole('button', { name: /Löschen/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		// Abbrechen
		await page.getByRole('button', { name: /Abbrechen/i }).click();

		// Säule ist immer noch da
		await expect(page.getByText('Bleiben', { exact: true })).toBeVisible();
	});

	// ── AK4: Empty-State bei 0 Säulen ───────────────────────────────────────

	test('AK4: Empty-State bei 0 Säulen — zeigt Hinweis und Anlege-Formular', async ({ page }) => {
		// Alle Säulen aus der gesäten DB löschen
		await deleteAllPillars(page);

		await openPillarTab(page);

		// Empty-State: Hinweis, dass keine Säulen existieren
		await expect(page.getByText(/keine Säulen/i)).toBeVisible();
		// Das Anlege-Formular ist trotzdem verfügbar
		await expect(page.getByRole('textbox', { name: /Name/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Anlegen/i })).toBeVisible();
	});
});
