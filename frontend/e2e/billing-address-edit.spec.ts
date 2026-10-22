import { expect, test } from './fixtures';
import { MOBILE, waitForStableView } from './helpers';

/**
 * Rechnungsadresse ohne Bestellvorgang bearbeiten: Kompakter Dialog „Rechnungsadresse" in der
 * Abrechnungs-Sektion („Pakete & Abo"), dasselbe Formular wie im Checkout-Dialog. Echtes Backend —
 * GET/PUT `/billing/address` laufen real gegen die eigene Session (#2508); nur `/auth/me` wird
 * übersteuert (mit `subscription: null`, damit die Abrechnungs-Sektion mit dem Einstieg gerendert
 * wird — Muster `billing.spec.ts`).
 */
test.use({ viewport: MOBILE });

test('Rechnungsadresse öffnen, ändern, speichern, erneut öffnen — Werte persistiert', async ({ page }) => {
	await page.route('**/auth/me', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: 1,
				displayName: 'Test User',
				email: 'test@example.com',
				plan: 'free',
				entitlements: {},
				subscription: null,
			}),
		}),
	);
	await page.goto('/app/settings/abo');
	await waitForStableView(page, 'Balamentum');
	await expect(page.getByTestId('billing-address-edit')).toBeVisible();

	// Dialog öffnen und das reale Laden der Adresse abwarten — erst danach füllen (sonst
	// überschreibt die Ladung die Eingaben).
	const firstLoad = page.waitForResponse(
		(route) => route.url().includes('/api/v1/billing/address') && route.request().method() === 'GET',
	);
	await page.getByTestId('billing-address-edit').click();
	await firstLoad;
	// Sichtbarkeit über die Dialog-Rolle (natives <dialog>); der `kol-dialog`-Host trägt den
	// projizierten Inhalt als Light-DOM und führt für `toBeVisible` eine Null-Box (Muster
	// `billing.spec.ts`), für Text- und Count-Assertions ist er trotzdem der richtige Anker.
	const dialogHost = page.locator('kol-dialog');
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(dialogHost).toContainText('Diese Anschrift erscheint auf künftigen Rechnungen.');

	// KolInputText mit _type="search" (Repo-Muster) trägt die Rolle searchbox, nicht textbox.
	const fill = async (testId: string, value: string): Promise<void> => {
		await page.getByTestId(`billing-address-${testId}`).getByRole('searchbox').fill(value);
	};
	await fill('name', 'Erika Musterfrau');
	await fill('street', 'Musterweg 2');
	await fill('zip', '98765');
	await fill('city', 'Musterhausen');
	await fill('country', 'Deutschland');
	await page.getByTestId('billing-address-save').getByRole('button').click();

	// Erfolgreiches Speichern (PUT real) schließt den Dialog.
	await expect(dialogHost).toHaveCount(0);

	// Erneut öffnen: die Werte kommen real aus GET /billing/address.
	const secondLoad = page.waitForResponse(
		(route) => route.url().includes('/api/v1/billing/address') && route.request().method() === 'GET',
	);
	await page.getByTestId('billing-address-edit').click();
	await secondLoad;
	await expect(page.getByTestId('billing-address-name').getByRole('searchbox')).toHaveValue('Erika Musterfrau');
	await expect(page.getByTestId('billing-address-street').getByRole('searchbox')).toHaveValue('Musterweg 2');
	await expect(page.getByTestId('billing-address-zip').getByRole('searchbox')).toHaveValue('98765');
	await expect(page.getByTestId('billing-address-city').getByRole('searchbox')).toHaveValue('Musterhausen');
	await expect(page.getByTestId('billing-address-country').getByRole('searchbox')).toHaveValue('Deutschland');
});
