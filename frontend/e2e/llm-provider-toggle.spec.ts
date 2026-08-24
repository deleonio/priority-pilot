import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * E2E-Spec fuer LLM-Provider-Auswahl: dynamische Provider-Verwaltung (#951,
 * Fortfuehrung des Test-Schalters #749).
 *
 * **System (#951):** Die Radio-Group im LLM-Tab zeigt „System-Standard“ plus alle
 * konfigurierten Provider aus `GET /llm-providers` (echtes Backend). Klick auf einen
 * Provider aktiviert ihn SERVERSEITIG (`POST /llm-providers/{id}/activate`) und pinnt
 * lokale LLM-Anfragen auf ihn (Query-Parameter, Muster #749).
 *
 * **ARIA-Befund KoliBri kol-input-radio (aus Quellcode-Analyse):**
 * - KoliBri rendert native `<input type="radio">` im Shadow DOM.
 * - `value`-Attribut ist der NEGATIVE Index (Optionsposition), NICHT der Optionswert.
 * - Playwright pierct KoliBris open Shadow DOM automatisch.
 *
 * **Provider-Seed:** Die Optionsliste ist DB-Zustand — jeder Test seedet Mistral +
 * OpenRouter per echter API (Auth ist im E2E-Backend deterministisch aus) und raeumt
 * vorher alle Alt-Provider ab, damit die Radio-Group keine Dubletten zeigt.
 *
 * **localStorage (#951):** `llm-provider-selection` haelt das Provider-OBJEKT als JSON
 * ({id, name, endpoint, model}) — nicht mehr den Legacy-String aus #749.
 *
 * **Test-Infra:** Importiert aus `./fixtures` (mockt `GET /auth/me` fuer Pass-Through).
 * Dashboard-Mocks nutzen `/api/v1`-Praefix (Vite-Proxy stript es).
 */

/** Selektor fuer die LLM-Provider Radio-Komponente (nicht die Darstellungs-Radio!). */
const LLM_RADIO = 'kol-input-radio[_label="LLM-Provider"]';

interface ProviderDto {
	id: number;
	name: string;
	endpoint: string;
	model: string;
	isActive: boolean;
}

/** Raeumt alle konfigurierten Provider ab (echte API) — sauberer Start je Test. */
async function cleanupProviders(page: Page) {
	const res = await page.request.get('/api/v1/llm-providers');
	const providers = (await res.json()) as ProviderDto[];
	for (const provider of providers) {
		await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
	}
}

/** Seedet Mistral + OpenRouter (Mistral wird als erster Provider direkt aktiv). */
async function seedProviders(page: Page) {
	await cleanupProviders(page);
	for (const provider of [
		{
			name: 'Mistral',
			endpoint: 'https://api.mistral.ai/v1/chat/completions',
			apiKey: 'e2e-mistral-key',
			model: 'mistral-medium-latest',
		},
		{
			name: 'OpenRouter',
			endpoint: 'https://openrouter.ai/api/v1/chat/completions',
			apiKey: 'e2e-openrouter-key',
			model: 'openrouter/free',
		},
	]) {
		const res = await page.request.post('/api/v1/llm-providers', { data: provider });
		expect(res.status(), 'Provider-Seed muss 201 liefern').toBe(201);
	}
}

/** Mockt alle Dashboard-Endpunkte mit leeren Daten. */
async function setupDashboardMocks(page: Page) {
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
async function setupDashboardWithPillars(page: Page) {
	await setupDashboardMocks(page);
	await page.route('**/api/v1/pillars**', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([{ id: 1, name: 'Gesundheit', description: 'Sport & Schlaf', weight: 100, userId: 1 }]),
		}),
	);
}

/** Oeffnet die Einstellungen, navigiert zum LLM-Tab und wartet auf die geladenen Provider-Optionen. */
async function openLlmSettings(page: Page) {
	await page.getByRole('button', { name: 'Einstellungen' }).click();
	await page.getByRole('tab', { name: 'LLM', exact: true }).click();
	await expect(page.locator(LLM_RADIO)).toBeVisible();
	// Die Optionen kommen asynchron aus GET /llm-providers — auf den Seed warten.
	await expect(page.getByRole('radio', { name: 'Mistral' })).toBeAttached();
}

/** Liest den gepinnten Provider-Namen aus dem localStorage (JSON seit #951). */
async function pinnedProviderName(page: Page): Promise<string | null> {
	const stored = await page.evaluate(() => localStorage.getItem('llm-provider-selection'));
	if (stored === null) return null;
	const parsed = JSON.parse(stored) as { name?: string };
	return parsed.name ?? null;
}

// -------------------------------------------------------------------------
// Journey: Toggle in den Einstellungen (dynamische Provider, #951)
// -------------------------------------------------------------------------

test.describe('LLM Provider Toggle – Einstellungen (#951)', () => {
	test.beforeEach(async ({ page }) => {
		await seedProviders(page);
		await setupDashboardMocks(page);
		await page.goto('/');
		await openLlmSettings(page);
	});

	test.afterEach(async ({ page }) => {
		await cleanupProviders(page);
	});

	// --- Anbieterliste: System-Standard + konfigurierte Provider ---

	test('zeigt System-Standard und alle konfigurierten Provider als Radio-Optionen', async ({ page }) => {
		await expect(page.getByText('System-Standard', { exact: true })).toBeVisible();
		await expect(page.getByText('Mistral', { exact: true })).toBeVisible();
		await expect(page.getByText('OpenRouter', { exact: true })).toBeVisible();

		await expect(page.getByRole('radio', { name: 'System-Standard' })).toBeAttached();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeAttached();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeAttached();
	});

	test('verwendet die KoliBri-Radiokomponent', async ({ page }) => {
		await expect(page.locator(LLM_RADIO)).toBeVisible();
	});

	test('aktiver Provider (Server) ist vorselektiert — hier der erste geseedete (Mistral)', async ({ page }) => {
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).not.toBeChecked();
	});

	// --- Wechsel: Klick aktiviert serverseitig + pinnt lokal ---

	test('wechselt den Provider per Klick (exklusive Auswahl, #951 Journey 3)', async ({ page }) => {
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Mistral' })).not.toBeChecked();

		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).not.toBeChecked();
	});

	test('zeigt Toast bei Provider-Wechsel', async ({ page }) => {
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByText(/Provider gewechselt/)).toBeVisible();
	});

	test('hält die Auswahl nach Reload (Server-Aktivierung persistiert)', async ({ page }) => {
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();

		// Navigation: Weg und zurueck (neuer Mount → frischer GET /llm-providers)
		await page.goto('/');
		await openLlmSettings(page);

		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
	});

	// --- Mobile-First ---

	test('44px Touch-Target pro Option auf Mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const llmRadio = page.locator(LLM_RADIO);
		// nth(1) = Mistral-Option (nth(0)=System-Standard, nth(1)=Mistral, nth(2)=OpenRouter)
		const mistralOption = llmRadio.locator('.kol-field-control').nth(1);
		const box = await mistralOption.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test('stapelt Optionen auf Mobile vertikal', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const options = page.locator(LLM_RADIO).locator('.kol-field-control');
		const mistralBox = await options.nth(1).boundingBox();
		const openrouterBox = await options.nth(2).boundingBox();
		expect(openrouterBox!.y).toBeGreaterThan(mistralBox!.y);
	});

	// --- A11y: Tastatur-Navigation ---

	test('ist per Tastatur bedienbar (Space aktiviert)', async ({ page }) => {
		const openrouterRadio = page.getByRole('radio', { name: 'OpenRouter' });
		await openrouterRadio.focus();
		await page.keyboard.press('Space');
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();
	});
});

// -------------------------------------------------------------------------
// Request-Integration: LLM-Anfragen tragen den gepinnten Provider-Query
// -------------------------------------------------------------------------
// Strategie: Provider wird ueber die UI aktiviert+gepinnt (Klick auf Radio in
// Einstellungen), dann wird die Einstellungen geschlossen und die LLM-Aktion
// getriggert. Vollstaendiger Flow: UI → activate + localStorage → API-Query.
// Der Query-Wert ist der Provider-NAME (Case-insensitiv serverseitig aufgeloest).
// -------------------------------------------------------------------------

test.describe('LLM Provider Toggle – Request-Integration', () => {
	test.afterEach(async ({ page }) => {
		await cleanupProviders(page);
	});

	test('provider=Mistral: parse-text-Request enthaelt provider=Mistral', async ({ page }) => {
		await setupDashboardMocks(page);
		await seedProviders(page);
		// Mistral ist als erster Seed bereits aktiv — ein Klick auf den bereits gewaehlten Radio
		// loest kein onChange aus. Erst OpenRouter aktivieren, damit der Mistral-Klick ein echter
		// Wechsel ist (activate + Pinning).
		const list = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
		const openrouter = list.find((p) => p.name === 'OpenRouter')!;
		await page.request.post(`/api/v1/llm-providers/${openrouter.id}/activate`);

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

		await page.goto('/');
		await openLlmSettings(page);
		await page.getByText('Mistral', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Mistral' })).toBeChecked();

		await page.goto('/', { waitUntil: 'networkidle' });

		// localStorage haelt das Provider-Objekt (JSON) mit dem Namen
		expect(await pinnedProviderName(page)).toBe('Mistral');

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.locator('kol-textarea').first()).toBeVisible();

		await page.locator('kol-textarea textarea').first().fill('Einen Beispiel-Task');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).toContain('provider=Mistral');
	});

	test('provider=OpenRouter: Advisor-Request enthaelt provider=OpenRouter', async ({ page }) => {
		await setupDashboardWithPillars(page);
		await seedProviders(page);

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

		await page.goto('/');
		await openLlmSettings(page);
		await page.getByText('OpenRouter', { exact: true }).click();
		await expect(page.getByRole('radio', { name: 'OpenRouter' })).toBeChecked();

		await page.goto('/', { waitUntil: 'networkidle' });
		expect(await pinnedProviderName(page)).toBe('OpenRouter');

		await page.getByRole('button', { name: 'Säulen-Berater' }).click();
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toBeVisible();
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).toContain('provider=OpenRouter');
	});

	test('ohne Pinning (System-Standard): kein provider-Query in parse-text-Anfrage', async ({ page }) => {
		await setupDashboardMocks(page);

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

		// KEIN Provider pinnen (localStorage leer → System-Standard)
		await page.goto('/');

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.locator('kol-textarea').first()).toBeVisible();

		await page.locator('kol-textarea textarea').first().fill('Task ohne Provider');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		expect(capturedUrl).not.toBeNull();
		expect(capturedUrl!).not.toContain('provider=');
	});
});
