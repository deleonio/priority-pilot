import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #222 „Gestalte den App-Header homogener".
 *
 * Reines Styling/Layout → visuelle Verifikation für AK2 (Avatar-Größe) und AK4 (Light/Dark-Mode)
 * ist im Browser nötig; automatisierte Tests decken nur den strukturell prüfbaren AK1 ab.
 *
 * Fixture (`./fixtures`) mockt `/auth/me` mit { displayName: 'Test User', email: 'test@example.com' }.
 *
 * AK2 (Avatar kleiner) und AK4 (Light/Dark konsistent) werden manuell visuell verifiziert;
 * ein Screenshot-Diff-Tool (z. B. Playwright visual comparisons) könnte später ergänzt werden.
 */
test.describe('#222 App-Header — Homogenität', () => {
	/**
	 * AK1: Die E-Mail-Adresse ist im App-Header nicht mehr sichtbar.
	 */
	test('AK1: E-Mail-Adresse ist im App-Header nicht sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Die gemockte E-Mail darf nicht mehr im DOM vorhanden sein (Element entfernt, nicht nur versteckt).
		await expect(page.getByText('test@example.com')).not.toBeAttached();
	});

	/* Avatar-Tests entfernt per Issue #865 — #485 Avatar-Layout obsolet */
});
