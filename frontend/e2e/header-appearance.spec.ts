import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #222 „Gestalte den App-Header homogener".
 *
 * Reines Styling/Layout → visuelle Verifikation für AK2 (Avatar-Größe) und AK4 (Light/Dark-Mode)
 * ist im Browser nötig; automatisierte Tests decken nur den strukturell prüfbaren AK1 ab.
 *
 * Fixture (`./fixtures`) mockt `/auth/me` mit { name: 'Test User', email: 'test@example.com' }.
 *
 * AK2 (Avatar kleiner) und AK4 (Light/Dark konsistent) werden manuell visuell verifiziert;
 * ein Screenshot-Diff-Tool (z. B. Playwright visual comparisons) könnte später ergänzt werden.
 */
test.describe('#222 App-Header — Homogenität', () => {
	/**
	 * AK1: Die E-Mail-Adresse ist im App-Header nach der Umsetzung NICHT mehr sichtbar.
	 * ROT solange `<span className="user-email">` noch in App.tsx gerendert wird.
	 */
	test('AK1: E-Mail-Adresse ist im App-Header nicht sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Die gemockte E-Mail darf im Header nicht mehr als sichtbarer Text erscheinen.
		await expect(page.getByText('test@example.com')).toBeHidden();
	});

	/**
	 * AK3 (Smoke): Der kol-avatar im Header hat das _label-Attribut mit dem Benutzernamen gesetzt.
	 * Bereits implementiert via `_label={user.name}` — bleibt als Regressions-Smoke grün.
	 */
	test('AK3 (Smoke): kol-avatar im Header hat _label mit Benutzernamen', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const avatar = page.locator('header kol-avatar, .header kol-avatar, kol-avatar').first();
		await expect(avatar).toBeVisible();
		await expect(avatar).toHaveAttribute('_label', 'Test User');
	});
});
