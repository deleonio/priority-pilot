import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#742) für Free Models Selection im Frontend.
 *
 * Spec: docs/spec/issue-742.md
 * AK 1 — Free Models Liste wird angezeigt
 * AK 2 — Default openrouter/free ist vorselektiert
 * AK 3 — Andere Free Models können ausgewählt werden
 * AK 4 — Liste ist aktuell (nicht veraltet/hartcodiert)
 *
 * Warum E2E: Feature-Verhalten im UI ist nur im Browser testbar.
 * Die Model-Selection ist ein reines Frontend-Feature.
 */

const mockFreeModelsResponse = async (page: Page): Promise<void> => {
	await page.route('**/api/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [
					{ id: 'openrouter/free', name: 'OpenRouter Free' },
					{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)' },
					{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)' },
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
	await page.route('**/api/models/free', (route: Route) =>
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
