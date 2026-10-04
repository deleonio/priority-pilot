import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests #1995 (docs/spec/issue-1995.md): Rückblick-Card im Dashboard.
 *
 * AK5: Ohne Anmeldung gibt es die Karte nicht (Auth-Gate); eingeloggt erscheint sie nur im
 * Monatsanfangs-Fenster (Tag 1–7) und ist bei 375 px voll bedienbar (Bounding-Box statt
 * scrollWidth — die App-Shell clippt; Touch-Target ≥ 44 px, Daumen-Zone).
 *
 * Der Fenster-Tag wird per `page.clock.setFixedTime` auf Freitag, 02.10.2026 (Tag 2) bzw.
 * Donnerstag, 08.10.2026 (Tag 8) gelegt — die Sichtbarkeit ist datumsabhängig und sonst
 * nicht deterministisch. Der 02.10.2026 ist ein Freitag, also keine Wochenkarte im Bild.
 * Der 401-Schutz der Datenendpunkte ist serverseitig abgesichert (scores-monthly-recap.test.ts,
 * „ohne Session → 401“) und wird hier bewusst nicht dupliziert.
 */

const IM_FENSTER = new Date(2026, 9, 2, 12); // Tag 2 im Monatsanfangs-Fenster
const NACH_DEM_FENSTER = new Date(2026, 9, 8, 12); // Tag 8 — Card wieder weg
const MOBILE = { width: 375, height: 812 } as const;

test.describe('Rückblick-Card (#1995)', () => {
	test('AK5: ohne Anmeldung keine Karte — das Auth-Gate zeigt die Login-Seite', async ({ page }) => {
		// Fixture-/auth/me-Mock überschreiben (zuletzt registriert gewinnt) → echt ausgeloggt.
		await page.route('**/auth/me', (route) =>
			route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
		);
		await page.goto('/app/');
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		await expect(page.getByTestId('monthly-balance-card')).toHaveCount(0);
	});

	test('AK5: eingeloggt erscheint die Card im Monatsanfangs-Fenster (Tag 1–7)', async ({ page }) => {
		await page.clock.setFixedTime(IM_FENSTER);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByTestId('monthly-balance-card')).toBeVisible();
	});

	test('AK5: nach dem Fenster (Tag 8) ist die Card wieder verschwunden', async ({ page }) => {
		await page.clock.setFixedTime(NACH_DEM_FENSTER);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByTestId('monthly-balance-card')).toHaveCount(0);
	});

	test.describe('AK5: Mobile 375px', () => {
		test.use({ viewport: MOBILE });

		test('Card bleibt im Viewport, Teilen-Button füllt die Zeile (≥44px hoch)', async ({ page }) => {
			await page.clock.setFixedTime(IM_FENSTER);
			await page.goto('/app/');
			await waitForStableView(page);

			const card = page.getByTestId('monthly-balance-card');
			await expect(card).toBeVisible();
			const cardBox = (await card.boundingBox())!;
			expect(cardBox.x, 'Card ragt links aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
			expect(cardBox.x + cardBox.width, 'Card ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);

			const share = page.getByTestId('monthly-share');
			const shareBox = (await share.boundingBox())!;
			expect(shareBox.width, 'Teilen-Button füllt die Zeile nicht').toBeGreaterThanOrEqual(cardBox.width * 0.8);
			expect(shareBox.height, 'Teilen-Button zu klein für die Daumen-Zone').toBeGreaterThanOrEqual(44);
		});
	});
});
