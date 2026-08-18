import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Spec-Tests (#742) für Free Models Selection im Frontend.
 *
 * Spec: docs/spec/issue-742.md
 * AK 1 — Free Models Liste wird angezeigt
 * AK 2 — Default openrouter/free ist vorselektiert
 * AK 3 — Andere Free Models können ausgewählt werden
 * AK 4 — Liste ist aktuell (nicht veraltet/hartcodiert)
 *
 * Warum E2E: Feature-Verhalten im UI ist nur im Browser testbar.
 * Die Model-Selection ist ein reines Frontend-Feature.
 *
 * Test-Infra (bei der Umsetzung korrigiert, fachlicher Vertrag unverändert):
 * - Import aus './fixtures': Die Auth-Gate (Root.tsx) zeigt ohne authentifiziertes
 *   `GET /auth/me` die Login-Seite — die Fixture mockt sie standardmäßig durchlässig
 *   (Muster: e2e/fixtures.ts). Ohne sie wäre der Dashboard-Button nie sichtbar.
 * - Mock-Pfad mit /api/v1-Präfix: Der generierte Client ruft alle Endpoints unter
 *   `/api/v1/…` auf (frontend/src/api.ts baseUrl; Vite-Proxy stript das Präfix). Ein
 *   Mock ohne das Präfix träfe die Anfrage nie — sie fiele durch auf den echten
 *   Backend-/OpenRouter-Call und wäre nichtdeterministisch.
 */

const mockFreeModelsResponse = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [
					{ id: 'openrouter/free', name: 'OpenRouter Free', contextLength: 200000, modelSize: '32B' },
					{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)', contextLength: 100000, modelSize: '7B' },
					{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', contextLength: 32000 },
				],
			}),
		}),
	);
};

test.beforeEach(async ({ page }) => {
	await mockFreeModelsResponse(page);
});

test('AK1+4: Free Models Liste wird angezeigt und dynamisch geladen', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Liste wird angezeigt (nicht leer/hartcodiert)
	const modelList = page.locator('[data-testid="free-models-list"]');
	await expect(modelList).toBeVisible();

	// Prüfen: Liste enthält Modelle aus API (nicht statisch)
	await expect(page.locator('[data-testid="free-model-item"]')).toHaveCount(3);
});

test('AK2: Default openrouter/free ist vorselektiert', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: openrouter/free ist vorselektiert
	const defaultOption = page.locator('[data-testid="free-model-item"][data-model-id="openrouter/free"]');
	await expect(defaultOption).toHaveAttribute('data-selected', 'true');
});

test('AK3: Andere Free Models können ausgewählt werden', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Anderes Free Model auswählen
	await page.click('[data-testid="free-model-item"][data-model-id="google/gemma-7b-it:free"]');

	// Prüfen: Auswahl wurde übernommen
	const selectedModel = page.locator('[data-testid="current-model-display"]');
	await expect(selectedModel).toContainText('google/gemma-7b-it:free');
});

test('Spec-Bezug: Free Models Liste ist nicht hartcodiert', async ({ page }) => {
	// API-Antwort ändern → Liste muss sich ändern
	await page.goto('/dashboard');

	// Erstes Layout mit 3 Modellen
	await page.click('[data-testid="model-selection-button"]');
	await expect(page.locator('[data-testid="free-model-item"]')).toHaveCount(3);

	// Dialog schließen
	await page.click('[data-testid="close-model-selection"]');

	// Route mit anderen Modellen überschreiben
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [
					{ id: 'openrouter/free', name: 'OpenRouter Free' },
					{ id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' },
				],
			}),
		}),
	);

	// Dialog neu öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Liste hat sich geändert (2 Modelle statt 3)
	await expect(page.locator('[data-testid="free-model-item"]')).toHaveCount(2);
});

/**
 * Issue 862: Model-Größe und Kontext-Größe im ModelSelectionDialog
 * Spec: docs/spec/issue-862.md
 * AK1: Kontext-Größe wird je Modell angezeigt (z.B. "200k", "1m")
 * AK2: Model-Größe wird je Modell angezeigt (z.B. "32B", "7B")
 * AK3: Fehlende Werte werden graceful behandelt (keine Anzeige oder "-")
 */

test('AK1+TF1: contextLength wird angezeigt (formatiert als "200k")', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Kontext-Größe wird für Modelle mit contextLength angezeigt
	const modelWith200k = page.locator('[data-testid="free-model-item"][data-model-id="openrouter/free"]');
	await expect(modelWith200k).toContainText('200k');

	const modelWith100k = page.locator('[data-testid="free-model-item"][data-model-id="google/gemma-7b-it:free"]');
	await expect(modelWith100k).toContainText('100k');
});

test('AK1+TF1: contextLength wird formatiert ("1m" für 1.000.000)', async ({ page }) => {
	// Mock mit 1m Kontext
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [{ id: 'openrouter/free', name: 'OpenRouter Free', contextLength: 1000000, modelSize: '32B' }],
			}),
		}),
	);

	await page.goto('/dashboard');
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: 1.000.000 wird als "1m" formatiert
	const modelWith1m = page.locator('[data-testid="free-model-item"][data-model-id="openrouter/free"]');
	await expect(modelWith1m).toContainText('1m');
});

test('AK2+TF2: modelSize wird angezeigt (wenn verfügbar)', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Model-Größe wird für Modelle mit modelSize angezeigt
	const modelWith32B = page.locator('[data-testid="free-model-item"][data-model-id="openrouter/free"]');
	await expect(modelWith32B).toContainText('32B');

	const modelWith7B = page.locator('[data-testid="free-model-item"][data-model-id="google/gemma-7b-it:free"]');
	await expect(modelWith7B).toContainText('7B');
});

test('AK3: Fehlende modelSize wird graceful behandelt (nicht angezeigt)', async ({ page }) => {
	await page.goto('/dashboard');

	// Model-Selection-Dialog öffnen
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Modell ohne modelSize zeigt nur contextLength (32k formatiert)
	const modelWithoutSize = page.locator(
		'[data-testid="free-model-item"][data-model-id="mistralai/mistral-7b-instruct:free"]',
	);
	// contextLength wird angezeigt (32k formatiert aus 32000)
	await expect(modelWithoutSize).toContainText('32k');
	// Keine modelSize angezeigt
	await expect(modelWithoutSize).not.toContainText('32B');
});

test('AK3: Fehlende contextLength wird graceful behandelt (nicht angezeigt)', async ({ page }) => {
	// Mock mit fehlender contextLength
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [{ id: 'openrouter/free', name: 'OpenRouter Free', modelSize: '32B' }],
			}),
		}),
	);

	await page.goto('/dashboard');
	await page.click('[data-testid="model-selection-button"]');

	// Prüfen: Modell ohne contextLength zeigt nur modelSize (32B)
	const modelWithoutContext = page.locator('[data-testid="free-model-item"][data-model-id="openrouter/free"]');
	// modelSize wird angezeigt
	await expect(modelWithoutContext).toContainText('32B');
	// Keine contextLength angezeigt (nichts mit "k" oder "m")
	await expect(modelWithoutContext).not.toContainText('k');
	await expect(modelWithoutContext).not.toContainText('m');
});
