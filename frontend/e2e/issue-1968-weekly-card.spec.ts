import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests #1968 (docs/spec/issue-1968.md): Teilbare Wochen-Balance-Karte.
 *
 * AK5: Ohne Anmeldung gibt es die Karte nicht (Auth-Gate); eingeloggt erscheint sie am Sonntag.
 * AK6: Bei 375px bleibt die Card im Viewport (Bounding-Box, nicht scrollWidth — die App-Shell
 * clippt), der Teilen-Button füllt die Zeile (Daumen-Zone, Touch-Target ≥ 44px).
 *
 * Der Kalendersonntag wird per `page.clock.setFixedTime` auf Sonntag, 11.10.2026 (KW 41) gelegt —
 * die Sichtbarkeit der Karte ist datumsabhängig und sonst nicht deterministisch.
 * Der 401-Schutz der Datenendpunkte ist serverseitig abgesichert (streak.test.ts, „ohne Session → 401“)
 * und wird hier bewusst nicht dupliziert.
 */

const SONNTAG = new Date(2026, 9, 11, 12); // KW 41/2026, Montag–Sonntag, Mittags (TZ-kanten-sicher)
const MOBILE = { width: 375, height: 812 } as const;

test.describe('Wochen-Balance-Karte (#1968)', () => {
	test('AK5: ohne Anmeldung keine Karte — das Auth-Gate zeigt die Login-Seite', async ({ page }) => {
		// Fixture-/auth/me-Mock überschreiben (zuletzt registriert gewinnt) → echt ausgeloggt.
		await page.route('**/auth/me', (route) =>
			route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
		);
		await page.goto('/app/');
		await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible();
		await expect(page.getByTestId('weekly-balance-card')).toHaveCount(0);
	});

	test('AK5: eingeloggt erscheint die Karte am Sonntag', async ({ page }) => {
		await page.clock.setFixedTime(SONNTAG);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByTestId('weekly-balance-card')).toBeVisible();
	});

	test.describe('AK6: Mobile 375px', () => {
		test.use({ viewport: MOBILE });

		test('Card bleibt im Viewport, Teilen-Button füllt die Zeile (≥44px hoch)', async ({ page }) => {
			await page.clock.setFixedTime(SONNTAG);
			await page.goto('/app/');
			await waitForStableView(page);

			const card = page.getByTestId('weekly-balance-card');
			await expect(card).toBeVisible();
			const cardBox = (await card.boundingBox())!;
			expect(cardBox.x, 'Card ragt links aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
			expect(cardBox.x + cardBox.width, 'Card ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);

			const share = page.getByTestId('weekly-share');
			const shareBox = (await share.boundingBox())!;
			expect(shareBox.width, 'Teilen-Button füllt die Zeile nicht').toBeGreaterThanOrEqual(cardBox.width * 0.8);
			expect(shareBox.height, 'Teilen-Button zu klein für die Daumen-Zone').toBeGreaterThanOrEqual(44);
		});
	});
});
