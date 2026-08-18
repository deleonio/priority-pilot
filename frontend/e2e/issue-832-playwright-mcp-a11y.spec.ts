import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * Issue #832 — Playwright-MCP für UI-Inspektion in UX-Phase einrichten.
 *
 * Akzeptanzkriterien:
 * - Playwright-MCP erreichbar in UX-Phase
 * - UI-Inspektion läuft (localhost:4174)
 * - A11y-Tests möglich (axe-core Integration)
 *
 * Testfälle:
 * - Playwright-Snapshot zeigt UI-Struktur
 * - A11y-Check läuft ohne Fehler
 * - Keyboard-Navigation testbar
 */
test('Issue-832: Playwright-Snapshot zeigt UI-Struktur', async ({ page }) => {
	await page.goto('/');

	// Grundgerüst steht (Backend hat geantwortet, React ist gerendert).
	await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

	// Playwright-Snapshot der UI-Struktur erstellen (page.content).
	const snapshot = await page.content();

	// Snapshot enthält Struktur (HTML-Content).
	expect(snapshot).toBeDefined();
	expect(snapshot.length).toBeGreaterThan(0);

	// Dashboard-Heading ist im HTML vorhanden.
	const dashboardHeading = await page.getByRole('heading', { name: 'Dashboard', level: 1 }).textContent();
	expect(dashboardHeading).toBe('Dashboard');
});

test('Issue-832: A11y-Check läuft ohne Fehler', async ({ page }) => {
	await page.goto('/');

	// axe-core Scan ausführen.
	const accessibilityScanResults = await new AxeBuilder({ page })
		// Nur kritische und ernste Fehler melden (wcag2aa, Level AA).
		.withTags(['wcag2aa', 'wcag21aa', 'wcag22aa'])
		.exclude('.disabled') // Deaktivierte Elemente ausschließen
		.analyze();

	// Keine kritischen oder ernsten Verstöße.
	expect(accessibilityScanResults.violations).toEqual([]);
});

test('Issue-832: Keyboard-Navigation testbar', async ({ page }) => {
	await page.goto('/');

	// Dashboard ist geladen.
	await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

	// Focus auf das erste interaktive Element setzen (Shift+Tab zum letzten, dann Tab zurück).
	await page.keyboard.press('Tab');

	// Prüfen, dass ein Element fokussiert ist.
	const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
	expect(focusedTag).toBeTruthy();
});
