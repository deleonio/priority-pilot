import { expect, test } from './fixtures';

/**
 * Smoke-Test gegen das **echte** Backend (#91). Nur `GET /auth/me` wird via Fixture gemockt
 * (Auth-Gate aus #190), alle übrigen Requests gehen unverändert an das echte Backend:
 * Playwright startet ein echtes Express-Backend mit temporärer In-Memory-DB (`:memory:`,
 * `DB_RESET=true`, `DB_SEED=false`, siehe `playwright.config.ts`), der Vite-Proxy reicht die
 * API-Requests durch.
 *
 * Der Test beweist damit, dass die Zwei-Server-Verdrahtung (Backend + Vite) steht: Die App lädt,
 * spricht über den Proxy das echte Backend an und rendert — mangels Demo-Seed — den leeren
 * Anfangszustand. Er bildet das Fundament für die funktionalen CRUD-Specs (`crud.spec.ts`, #92).
 */
test('App lädt gegen das echte Backend und zeigt den leeren Anfangszustand', async ({ page }) => {
	await page.goto('/app/');

	// Grundgerüst steht (Backend hat geantwortet, React ist gerendert).
	await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

	// Ohne Demo-Seed startet die DB leer → der Erststart-Flow (#2069) erscheint; „Später“ führt
	// zur Onboarding-Ansicht (EmptyState).
	await page.getByRole('button', { name: 'Später' }).click();
	// #2070 Test-Pflege: Der EmptyState heißt jetzt „Was beschäftigt dich gerade?“.
	await expect(page.getByRole('heading', { name: 'Was beschäftigt dich gerade?' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ersten Task anlegen' })).toBeVisible();
});
