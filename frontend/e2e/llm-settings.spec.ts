import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für die KI-Provider-Einstellungen (Settings-Tab „KI-Provider“): fixe Built-ins
 * (Mistral/OpenRouter, Key aus Server-ENV), Custom-Provider-Verwaltung (Name/URL/Token),
 * Radio-Aktivierung serverseitig und die Modellwahl des aktiven Providers.
 *
 * **Backend-Zustand:** Das E2E-Backend startet ohne MISTRAL/OPENROUTER-ENV-Keys — es ist also
 * kein Provider aktiv, bis ein Test einen Custom-Provider aktiviert. Die Modellliste des
 * aktiven Providers schlägt fehl (Unreachable), weil der E2E-Seed auf einen toten Endpoint
 * zeigt — die Fehleranzeige ist Teil des Vertrags, die Erfolgspfade deckt die Unit-Tests ab.
 */

interface ProviderDto {
	id: number;
	name: string;
	endpoint: string;
	model: string;
	isActive: boolean;
	kind: 'custom' | 'builtin';
	hasApiKey: boolean;
}

/** Öffnet den KI-Provider-Tab der Einstellungen. */
const openLlmTab = async (page: import('@playwright/test').Page): Promise<void> => {
	await page.goto('/settings/llm');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'KI-Provider', exact: true })).toBeVisible();
};

/** Räumt alle Custom-Provider ab (Builtins bleiben — sie sind nicht löschbar). */
const cleanupCustomProviders = async (page: import('@playwright/test').Page): Promise<void> => {
	const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
	for (const provider of providers.filter((p) => p.kind === 'custom')) {
		await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
	}
};

test.describe('KI-Provider-Einstellungen', () => {
	test.beforeEach(async ({ page }) => {
		await cleanupCustomProviders(page);
	});

	test('Built-ins sind immer da und fix: kein Bearbeiten/Löschen, Radio-Auswahl vorhanden', async ({ page }) => {
		await openLlmTab(page);

		// Beide Built-ins erscheinen in der Verwaltungsliste mit Fix-Markierung …
		await expect(page.locator('.llm-provider-admin__name', { hasText: 'Mistral' })).toBeVisible();
		await expect(page.locator('.llm-provider-admin__name', { hasText: 'OpenRouter' })).toBeVisible();
		await expect(page.locator('.llm-provider-admin__meta', { hasText: 'fix, Key aus Server-ENV' })).toHaveCount(2);

		// … ohne dass für sie Bearbeiten/Löschen-Buttons existieren.
		await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
	});

	test('Custom-Provider anlegen (Name, URL, Token) und per Radio aktivieren — serverseitig', async ({ page }) => {
		await openLlmTab(page);

		await page.getByRole('button', { name: 'Neuer Provider' }).click();
		const dialog = page.locator('kol-dialog');
		await expect(dialog.getByRole('heading', { name: 'Neuen Provider anlegen' })).toBeVisible();

		await dialog.getByRole('textbox', { name: 'Name' }).fill('E2E Provider');
		await dialog.getByRole('textbox', { name: 'Endpoint' }).fill('http://localhost:9/v1');
		await dialog.getByRole('textbox', { name: 'API-Key' }).fill('e2e-key');
		await dialog.getByRole('textbox', { name: 'Modell' }).fill('e2e-model');
		await dialog.getByRole('button', { name: 'Anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Provider anlegen' })).toBeHidden();

		// Der neue Provider erscheint mit Bearbeiten/Löschen (nur Custom-Provider).
		await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(1);
		await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(1);

		// Radio-Auswahl aktiviert ihn serverseitig (Bestätigung über die echte API).
		const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
		const custom = providers.find((p) => p.name === 'E2E Provider');
		expect(custom?.isActive).toBe(false);
		const radio = page.locator('kol-input-radio[_label="KI-Provider"]');
		// Radio-Label zeigt Provider inkl. gewähltem Modell: „E2E Provider (e2e-model)“.
		await radio.getByRole('radio', { name: 'E2E Provider (e2e-model)' }).click();
		const after = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
		expect(after.find((p) => p.name === 'E2E Provider')?.isActive).toBe(true);

		// Die Modellwahl des aktiven Providers wird angeboten; der tote Endpoint zeigt den
		// Fehlerzustand statt stiller Leere.
		await expect(page.getByText(/Modellliste nicht verfügbar/)).toBeVisible();
	});

	test('Mobile 375×812: Kerninhalte lesbar und bedienbar ohne horizontalen Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openLlmTab(page);

		const settings = page.locator('.settings-page');
		await expect(settings).toBeVisible();
		const overflow = await settings.evaluate((el) => el.scrollWidth - el.clientWidth);
		expect(overflow).toBeLessThanOrEqual(1);

		await expect(page.locator('.llm-provider-admin__name', { hasText: 'Mistral' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Neuer Provider' })).toBeVisible();
	});

	test('Built-ins bleiben nach Lösch-Versuch über die API erhalten (400)', async ({ page }) => {
		const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
		const mistral = providers.find((p) => p.name === 'Mistral');
		expect(mistral?.kind).toBe('builtin');
		const response = await page.request.delete(`/api/v1/llm-providers/${mistral?.id}`);
		expect(response.status()).toBe(400);
	});
});
