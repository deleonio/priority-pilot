import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1577 — Verbindungstest im Provider-Dialog
 * (Spec docs/spec/issue-1577.md, AK1/AK3/AK4/AK6).
 *
 * Der Dry-Test-Endpoint wird per page.route gemockt („Daten eines Mock-Providers“ laut
 * Analyse) — ein echter Upstream wäre in E2E nicht deterministisch. AK5 (Zeilen-Testen der
 * gespeicherten Provider unverändert) deckt der Bestandstest `llm-settings.spec.ts`
 * („Test-Prompt: Testen-Button zeigt das Ergebnis inline unter der Zeile“) — hier nicht
 * dupliziert.
 */

interface ProviderDto {
	id: number;
	name: string;
	kind: 'custom' | 'builtin';
}

/** Mockt den Dry-Test-Endpoint mit einem festen Ergebnis. */
const mockDryTest = (page: import('@playwright/test').Page, payload: object): void => {
	void page.route('**/api/v1/llm-providers/test-dry', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
	});
};

/** Öffnet den KI-Provider-Tab und den Anlege-Dialog; liefert den Dialog-Locator. */
const openCreateDialog = async (page: import('@playwright/test').Page) => {
	await page.goto('/app/settings/llm');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'KI-Provider', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Neuer Provider' }).click();
	const dialog = page.locator('kol-dialog');
	await expect(dialog.getByRole('heading', { name: 'Neuen Provider anlegen' })).toBeVisible();
	return dialog;
};

/** Füllt die Formularfelder des Dialogs mit Mock-Provider-Daten. */
const fillDraftForm = async (dialog: import('@playwright/test').Locator): Promise<void> => {
	await dialog.getByRole('searchbox', { name: 'Name' }).fill('Issue-1577 Draft');
	await dialog.getByRole('textbox', { name: 'Endpoint' }).fill('http://localhost:9/v1');
	await dialog.getByRole('textbox', { name: 'API-Key' }).fill('draft-key');
	await dialog.getByRole('searchbox', { name: 'Modell' }).fill('e2e-model');
};

const customProviderCount = async (page: import('@playwright/test').Page): Promise<number> => {
	const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
	return providers.filter((p) => p.kind === 'custom').length;
};

test.describe('#1577 Verbindungstest im Provider-Dialog', () => {
	test.beforeEach(async ({ page }) => {
		// Startzustand: keine Custom-Provider (Built-ins bleiben — sie sind nicht löschbar).
		const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
		for (const provider of providers.filter((p) => p.kind === 'custom')) {
			await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
		}
	});

	test('AK1/AK3: Testen im Dialog meldet Erfolg mit Reaktionszeit und legt keinen Provider an', async ({ page }) => {
		mockDryTest(page, { ok: true, model: 'e2e-model', latencyMs: 42, sample: '{"ok": true}' });
		const dialog = await openCreateDialog(page);
		await fillDraftForm(dialog);

		await dialog.getByRole('button', { name: 'Testen' }).click();

		// Erfolg nennt die Reaktionszeit (AK3)
		await expect(dialog.getByText(/42\s*ms/)).toBeVisible();
		// Der Test allein legt nichts an — der Dialog steht noch offen, die Liste ist unverändert.
		await expect(dialog.getByRole('heading', { name: 'Neuen Provider anlegen' })).toBeVisible();
		// Kein Provider durch den Test angelegt (AK3)
		expect(await customProviderCount(page)).toBe(0);
	});

	test('AK4: Misserfolg zeigt die konkrete Ursache; Dialog bleibt bedienbar', async ({ page }) => {
		mockDryTest(page, { ok: false, message: 'Ungültiger API-Key (401 vom Anbieter).' });
		const dialog = await openCreateDialog(page);
		await fillDraftForm(dialog);

		await dialog.getByRole('button', { name: 'Testen' }).click();

		// Konkrete Ursache (AK4)
		await expect(dialog.getByText(/Ungültiger API-Key/)).toBeVisible();
		// Dialog bleibt bedienbar (AK4)
		await expect(dialog.getByRole('button', { name: 'Anlegen' })).toBeEnabled();
		expect(await customProviderCount(page)).toBe(0);
	});

	test('AK6: 375px — Dialog mit Testen-Schalter und Ergebnismeldung ohne horizontalen Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		mockDryTest(page, { ok: true, model: 'e2e-model', latencyMs: 42, sample: '{"ok": true}' });
		const dialog = await openCreateDialog(page);
		await fillDraftForm(dialog);

		await dialog.getByRole('button', { name: 'Testen' }).click();
		await expect(dialog.getByText(/42\s*ms/)).toBeVisible();

		// Bounding-Box statt scrollWidth (die App-Shell clippt overflow-x:hidden, #1549-Muster):
		// Dialog und Ergebnis-Alert bleiben innerhalb des 375-px-Viewports.
		const viewportWidth = page.viewportSize()?.width ?? 0;
		const dialogBox = await dialog.boundingBox();
		expect(dialogBox).toBeTruthy();
		expect(dialogBox!.x).toBeGreaterThanOrEqual(-0.5);
		expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewportWidth + 0.5);

		const alertBox = await dialog.locator('kol-alert').first().boundingBox();
		expect(alertBox).toBeTruthy();
		expect(alertBox!.x).toBeGreaterThanOrEqual(-0.5);
		expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(viewportWidth + 0.5);
	});
});
