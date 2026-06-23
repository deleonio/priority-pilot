import { expect, test } from '@playwright/test';

/**
 * Smoke-Test gegen das **echte** Backend (#91). Es wird **nichts** via `page.route` gemockt:
 * Playwright startet ein echtes Express-Backend mit temporärer In-Memory-DB (`:memory:`,
 * `DB_RESET=true`, `DB_SEED=false`, siehe `playwright.config.ts`), der Vite-Proxy reicht die
 * API-Requests durch.
 *
 * Der Test beweist damit, dass die Zwei-Server-Verdrahtung (Backend + Vite) steht: Die App lädt,
 * spricht über den Proxy das echte Backend an und rendert — mangels Demo-Seed — den leeren
 * Anfangszustand. Er bildet das Fundament für die funktionalen CRUD-Specs (`crud.spec.ts`, #92).
 */
test('App lädt gegen das echte Backend und zeigt den leeren Anfangszustand', async ({ page }) => {
	await page.goto('/');

	// Grundgerüst steht (Backend hat geantwortet, React ist gerendert).
	await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toBeVisible();

	// Ohne Demo-Seed startet die DB leer → die Onboarding-Ansicht (EmptyState) erscheint.
	await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ersten Task anlegen' })).toBeVisible();
});
