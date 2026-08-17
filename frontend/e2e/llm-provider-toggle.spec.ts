import type { Route } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * E2E-Spec fuer Issue-749: LLM-Provider Toggle + Request-Integration.
 *
 * **ARIA-Befund KoliBri kol-input-radio (aus Quellcode-Analyse):**
 * - KoliBri rendert native `<input type="radio">` im Shadow DOM.
 * - `value`-Attribut ist der NEGATIVE Index: `value="-0"` (System-Standard),
 *   `value="-1"` (Mistral), `value="-2"` (OpenRouter) — NICHT der Optionswert.
 * - Native Radios haben implizites `role="radio"` (kein explizites Attribut).
 * - `aria-checked` ist auf dem nativen Input korrekt gesetzt.
 * - Playwright pierct KoliBris open Shadow DOM automatisch.
 *
 * **UI-Struktur (aus Quellcode-Analyse):**
 * - Toolbar-Button "Neuen Task anlegen" (`_hideLabel: true`, `aria-label`) oeffnet QuickCaptureModal
 * - QuickCaptureModal: Textarea "Beschreibe deinen Task", Button "Verarbeiten und weiter"
 *   (click → `api.parseText()` → `POST /tasks/parse-text`)
 * - Toolbar-Button "Säulen-Berater" (`_hideLabel: true`, `aria-label`) oeffnet PillarAdvisorModal
 * - PillarAdvisorModal: Button "Beraten lassen" (click → `api.advisePillarActivities()`
 *   → `POST /pillars/advisor`). Zeigt "Keine Säulen definiert" wenn `pillars.length === 0`.
 * - Toolbar-Button "Einstellungen" (`_hideLabel: true`, `aria-label`) oeffnet SettingsPage
 * - SettingsPage Tabs: Allgemein, Säulen, LLM
 * - LLM-Tab enthaelt `LlmProviderToggle` (`KolInputRadio`) mit Optionen:
 *   System-Standard, Mistral, OpenRouter
 * - localStorage-Key: `llm-provider-selection`
 * - **WICHTIG:** SettingsPage hat ZWEI kol-input-radio Komponenten:
 *   "Darstellung" (Allgemein-Tab) und "LLM-Provider" (LLM-Tab).
 *   Selektor muss `_label="LLM-Provider"` verwenden, nicht `.first()`.
 *
 * **Test-Infra:** Importiert aus `./fixtures` (mockt `GET /auth/me` fuer Pass-Through).
 * Alle API-Route-Mocks nutzen `/api/v1`-Praefix (Vite-Proxy stript es).
 *
 * **Dashboard-Mocks:** Die App laedt auf mount 5 Endpunkte (tasks, forest, next, suggestions,
 * pillars). Ohne Mock schlagen diese fehl → Dashboard rendert nicht → Toolbar-Buttons fehlen.
 */

/** Selektor fuer die LLM-Provider Radio-Komponente (nicht die Darstellungs-Radio!). */
const LLM_RADIO = 'kol-input-radio[_label="LLM-Provider"]';

/** Mockt alle Dashboard-Endpunkte mit leeren Daten. */
async function setupDashboardMocks(page: import('@playwright/test').Page) {
	await page.route('**/api/v1/tasks**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
	await page.route('**/api/v1/forest**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
	await page.route('**/api/v1/next**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
	);
	await page.route('**/api/v1/suggestions**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
	await page.route('**/api/v1/pillars**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
}

/** Mockt Dashboard-Endpunkte mit einer Test-Saeule (noetig fuer PillarAdvisorModal). */
async function setupDashboardWithPillars(page: import('@playwright/test').Page) {
	await setupDashboardMocks(page);
	await page.route('**/api/v1/pillars**', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([{ id: 1, name: 'Gesundheit', description: 'Sport & Schlaf', weight: 100, userId: 1 }]),
		}),
	);
}

/** Oeffnet die Einstellungen und navigiert zum LLM-Tab. */
async function openLlmSettings(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Einstellungen' }).click();
	await page.getByRole('tab', { name: 'LLM', exact: true }).click();
	await expect(page.locator(LLM_RADIO)).toBeVisible();
}

// -------------------------------------------------------------------------
// Journey Schritt 1+2+4: Toggle in den Einstellungen (Shared beforeEach)
// -------------------------------------------------------------------------

test.describe('LLM Provider Toggle – Einstellungen (Steps 1, 2, 4, UX)', () => {
	test.beforeEach(async ({ page }) => {
		await setupDashboardMocks(page);
		await page.goto('/');
		await openLlmSettings(page);
	});

	// --- Journey Schritt 1: Toggle wird angezeigt ---

	test('soll Provider-Radio-Optionen anzeigen – Spec: Issue-749 Journey Step 1', async ({ page }) => {
		await expect(page.getByText('System-Standard', { exact: true })).toBeVisible();
		await expect(page.getByText('Mistral', { exact: true })).toBeVisible();
		await expect(page.getByText('OpenRouter', { exact: true })).toBeVisible();

		const systemRadio = page.getByRole('radio', { name: 'System-Standard' });
		const mistralRadio = page.getByRole('radio', { name: 'Mistral' });
		const openrouterRadio = page.getByRole('radio', { name: 'OpenRouter' });

		await expect(systemRadio).toBeAttached();
		await expect(mistralRadio).toBeAttached();
		await expect(openrouterRadio).toBeAttached();
	});

	test('soll KoliBri-Radiokomponent verwenden – Spec: Issue-749 UX KoliBri', async ({ page }) => {
		await expect(page.locator(LLM_RADIO)).toBeVisible();
	});

	// --- Journey Schritt 2: Provider umschalten ---

	test('soll Provider per Klick umschalten – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Mistral' })).not.toBeChecked();

		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).not.toBeChecked();
	});

	test('soll Toast bei Provider-Wechsel zeigen – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByText(/Provider gewechselt/)).toBeVisible();
	});

	test('soll exklusive Auswahl erzwingen – Spec: Issue-749 Journey Step 2', async ({ page }) => {
		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).not.toBeChecked();

		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Mistral' })).not.toBeChecked();
	});

	// --- Journey Schritt 4: Persistenz ---

	test('soll Provider nach Reload beibehalten – Spec: Issue-749 Journey Step 4', async ({ page }) => {
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();

		// Navigation: Weg und zurueck (simuliert Reload, localStorage bleibt erhalten)
		await page.goto('/');
		await openLlmSettings(page);

		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
	});

	// --- Mobile-First ---
	// Touch-Target: Misst die tappbare Zeile EINER Option (kol-field-control im Shadow DOM),
	// NICHT die gesamte Komponente (3-Optionen-Group ist trivially >44px).
	// kol-field-control hat per KoliBri-CSS min-height: var(--a11y-min-size) = 44px.

	test('soll 44px Touch-Target pro Option auf Mobile – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const llmRadio = page.locator(LLM_RADIO);
		// nth(1) = Mistral-Option (nth(0)=System-Standard, nth(1)=Mistral, nth(2)=OpenRouter)
		const mistralOption = llmRadio.locator('.kol-field-control').nth(1);
		const box = await mistralOption.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test('soll Optionen auf Mobile vertikal stapeln – Spec: Issue-749 UX Mobile-First', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const options = page.locator(LLM_RADIO).locator('.kol-field-control');
		const mistralBox = await options.nth(1).boundingBox();
		const openrouterBox = await options.nth(2).boundingBox();
		// Vertikale Stackung: OpenRouter muss unter Mistral liegen (groessere y-Koordinate)
		expect(openrouterBox!.y).toBeGreaterThan(mistralBox!.y);
	});

	// --- A11y: Tastatur-Navigation ---

	test('soll Radio-Group per Tastatur bedienbar – Spec: Issue-749 UX A11y/BITV', async ({ page }) => {
		const mistralRadio = page.getByRole('radio', { name: 'Mistral' });
		await mistralRadio.focus();
		await page.keyboard.press('Space');
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();
	});
});

// -------------------------------------------------------------------------
// Journey Schritt 3: LLM-Anfragen tragen den Provider-Query
// -------------------------------------------------------------------------
// Strategie: Provider wird ueber die UI gesetzt (Klick auf Radio in Einstellungen),
// dann wird die Einstellungen geschlossen und die LLM-Aktion getriggert.
// So wird der vollstaendige Flow getestet: UI → localStorage → API-Query.
// -------------------------------------------------------------------------

test.describe('LLM Provider Toggle – Journey Step 3: Request-Integration', () => {
	test('provider=mistral: parse-text-Request enthaelt provider=mistral', async ({ page }) => {
		await setupDashboardMocks(page);

		// Route-Mock fuer parse-text
		let capturedUrl: string | null = null;
		await page.route('**/api/v1/tasks/parse-text**', (route: Route) => {
			capturedUrl = route.request().url();
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					title: 'Geparster Task',
					description: 'Von Mistral geparst',
					priority: 'medium',
					estimatedEffort: 2,
				}),
			});
		});

		// 1. Provider ueber UI setzen (Einstellungen → LLM-Tab → Mistral klicken)
		await page.goto('/');
		await openLlmSettings(page);
		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();

		// 2. Zurueck zum Dashboard
		await page.goto('/', { waitUntil: 'networkidle' });

		// 2b. Verifiziere: localStorage muss 'mistral' enthalten
		const storedProvider = await page.evaluate(() => localStorage.getItem('llm-provider-selection'));
		expect(storedProvider).toBe('mistral');

		// 3. QuickCaptureModal oeffnen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.locator('kol-textarea').first()).toBeVisible();

		// 4. Text eingeben
		const textarea = page.locator('kol-textarea textarea').first();
		await textarea.fill('Einen Beispiel-Task');

		// 5. "Verarbeiten und weiter" klicken
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// 6. Pruefen: URL muss provider=mistral enthalten
		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).toContain('provider=mistral');
	});

	test('provider=openrouter: Advisor-Request enthaelt provider=openrouter', async ({ page }) => {
		await setupDashboardWithPillars(page);

		// Route-Mock fuer Advisor
		let capturedUrl: string | null = null;
		await page.route('**/api/v1/pillars/advisor**', (route: Route) => {
			capturedUrl = route.request().url();
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [{ activity: 'Beispielaktivität', reason: 'passt', pillarIds: [1] }],
				}),
			});
		});

		// 1. Provider ueber UI setzen
		await page.goto('/');
		await openLlmSettings(page);
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();

		// 2. Zurueck zum Dashboard
		await page.goto('/', { waitUntil: 'networkidle' });

		// 2b. Verifiziere: localStorage muss 'openrouter' enthalten
		const storedProvider = await page.evaluate(() => localStorage.getItem('llm-provider-selection'));
		expect(storedProvider).toBe('openrouter');

		// 3. Säulen-Berater oeffnen
		await page.getByRole('button', { name: 'Säulen-Berater' }).click();

		// 4. Warten auf "Beraten lassen" (nur sichtbar wenn pillars.length > 0)
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toBeVisible();

		// 5. Advisor triggern
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// 6. Pruefen: URL muss provider=openrouter enthalten
		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).toContain('provider=openrouter');
	});

	test('ohne Provider (System-Standard): kein provider-Query in parse-text-Anfrage', async ({ page }) => {
		await setupDashboardMocks(page);

		// Route-Mock fuer parse-text
		let capturedUrl: string | null = null;
		await page.route('**/api/v1/tasks/parse-text**', (route: Route) => {
			capturedUrl = route.request().url();
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					title: 'Geparster Task',
					description: 'ohne Provider',
					priority: 'low',
					estimatedEffort: 1,
				}),
			});
		});

		// KEIN Provider setzen (System-Standard bleibt)
		await page.goto('/');

		// QuickCaptureModal oeffnen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.locator('kol-textarea').first()).toBeVisible();

		// Text eingeben
		const textarea = page.locator('kol-textarea textarea').first();
		await textarea.fill('Task ohne Provider');

		// "Verarbeiten und weiter" klicken
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Pruefen: URL darf KEIN provider= enthalten
		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).not.toContain('provider=');
	});
});
