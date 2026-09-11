import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1342 (Spec docs/spec/issue-1342.md) — Standort-Favoriten.
 *
 * AK6: kompletter Weg bei 375px — Favorit am Formular speichern, in Einstellungen → Standort
 * umbenennen, im Adressfeld auswählen, löschen; Favoritenzeilen/Verwaltungskarte bleiben im
 * sichtbaren Bereich (Bounding-Box statt `scrollWidth`, MEMORY 2026-08-24/2026-09-10 — die
 * App-Shell clippt mit `overflow-x: hidden`), jedes Bedienelement hat ein Touch-Ziel ≥ 44px Höhe.
 *
 * Läuft gegen das echte Backend (Vite-Proxy). Die Favoriten-Routen sind pro Nutzer gebunden
 * (Muster `apiTokens`/#1352) und antworten im Pass-Through-Modus ohne echte Session mit 401 —
 * Login daher über `POST /auth/test-login` VOR `page.goto` (MEMORY 2026-09-10), Geocoding wird
 * gestubbt (kein echter Netzcall, deterministisch, Muster issue-1061-task-address.spec.ts).
 */

const TEST_EMAIL = 'place-favorites@example.com';
const HIT = { address: 'Rathausplatz 1, 80331 München, Bayern, Deutschland', lat: 48.1374, lon: 11.5755 };

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Favoriten Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
};

const deleteAllFavorites = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/place-favorites');
	if (!res.ok()) return;
	for (const favorite of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/place-favorites/${favorite.id}`);
	}
};

const stubGeocode = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/geocode-search*', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([HIT]) }),
	);
};

/** Bounding-Box im 375px-Viewport nicht überragen (kein horizontales Scrollen). */
const expectWithinViewport = async (page: Page, locator: ReturnType<Page['locator']>): Promise<void> => {
	const box = await locator.boundingBox();
	expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(376);
};

test.describe('Priority Pilot — #1342: Standort-Favoriten', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
	});

	test.afterEach(async ({ page }) => {
		await deleteAllFavorites(page);
	});

	test('AK6: kompletter Weg — Favorit speichern, umbenennen, auswählen, löschen (375px, Touch-Ziele ≥ 44px)', async ({
		page,
	}) => {
		await login(page);
		await stubGeocode(page);

		// 1) Favorit am Formular speichern (AK2): Adresse tippen, Treffer auswählen, „Als Favorit speichern".
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);
		await openAccordionSection(page, 'Termin & Ort');

		const addressInput = page.getByLabel('Adresse (optional)');
		await expect(addressInput).toBeVisible();
		await addressInput.fill('Rathausplatz');
		await page.getByRole('option', { name: /Rathausplatz 1/i }).click();

		const saveFavoriteButton = page.getByRole('button', { name: /als favorit speichern/i });
		await expectWithinViewport(page, saveFavoriteButton);
		const saveFavoriteBox = await saveFavoriteButton.boundingBox();
		expect(saveFavoriteBox!.height).toBeGreaterThanOrEqual(44);
		await saveFavoriteButton.click();

		// 2) In Einstellungen → Standort umbenennen (AK3).
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Standort');

		const favoriteRow = page.getByTestId('place-favorite-row').filter({ hasText: HIT.address });
		await expect(favoriteRow).toBeVisible();
		await expectWithinViewport(page, favoriteRow);

		const renameButton = favoriteRow.getByRole('button', { name: /favorit umbenennen/i });
		const renameBox = await renameButton.boundingBox();
		expect(renameBox!.height).toBeGreaterThanOrEqual(44);
		await renameButton.click();

		const nameInput = page.getByRole('textbox', { name: /name/i });
		await nameInput.fill('Büro München');
		await page.getByRole('button', { name: /^(übernehmen|speichern)$/i }).click();
		await expect(page.getByTestId('place-favorite-row').filter({ hasText: 'Büro München' })).toBeVisible();

		// 3) Im Adressfeld auswählen (AK1): erscheint VOR den Suchtreffern, Klick übernimmt Adresse + Koordinaten.
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);
		await openAccordionSection(page, 'Termin & Ort');

		const addressInput2 = page.getByLabel('Adresse (optional)');
		await addressInput2.fill('Büro');
		const favoriteOption = page.getByRole('option', { name: /Büro München/i });
		await expect(favoriteOption).toBeVisible();
		const favoriteOptionBox = await favoriteOption.boundingBox();
		expect(favoriteOptionBox!.height).toBeGreaterThanOrEqual(44);
		await favoriteOption.click();
		await expect(addressInput2).toHaveValue(HIT.address);

		// 4) Löschen (AK3) — der Favorit erscheint danach nicht mehr im Adressfeld.
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Standort');

		const rowToDelete = page.getByTestId('place-favorite-row').filter({ hasText: 'Büro München' });
		const deleteButton = rowToDelete.getByRole('button', { name: /favorit löschen/i });
		const deleteBox = await deleteButton.boundingBox();
		expect(deleteBox!.height).toBeGreaterThanOrEqual(44);
		await deleteButton.click();
		// Zweistufige Bestätigung (Muster ApiTokensSection/docs/ux-pattern-sequential-confirmation.md).
		await rowToDelete
			.getByRole('button', { name: /löschen|entfernen/i })
			.last()
			.click();
		await expect(page.getByTestId('place-favorite-row').filter({ hasText: 'Büro München' })).toHaveCount(0);

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);
		await openAccordionSection(page, 'Termin & Ort');
		await page.getByLabel('Adresse (optional)').fill('Büro');
		await expect(page.getByRole('option', { name: /Büro München/i })).toHaveCount(0);
	});
});
