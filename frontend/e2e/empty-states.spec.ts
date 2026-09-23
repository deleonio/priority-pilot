import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #440 (AK5): Der Dashboard-Empty-State erscheint bei 0 Säulen.
 *
 * #1573-Test-Pflege: Säulen-CRUD ist serverseitig gesperrt (POST/DELETE /pillars → 403), neue
 * Nutzer erhalten bei der Registrierung fünf Standard-Säulen. Die früheren Übergangs-Tests
 * („Empty-State verschwindet nach dem Anlegen der ersten Säule" / „erscheint wieder nach dem
 * Löschen der letzten Säule") prüfen damit nicht mehr erreichbare Zustände und sind entfallen.
 *
 * Der verbleibende Lesestate „0 Säulen" ist über das echte Backend nicht mehr herstellbar: Der
 * Fixture-Nutzer hat keine Session, `ownerScope(undefined)` lässt den Eigentümer-Filter im
 * Pass-Through-Modus leer (`logics/ownerScope.ts`), und `GET /pillars` liefert damit den gesamten
 * Säulen-Bestand der Shard-DB — inklusive der fünf Standard-Säulen jedes Nutzers, den eine
 * parallele Spec per `/auth/register` anlegt. Anlegen/Löschen als Gegensteuerung fällt mit der
 * Sperre weg. AK5 beschreibt ohnehin eine reine Darstellungsfrage, daher wird `GET /pillars` hier
 * als einziger Request gemockt (Muster `billing.spec.ts`); alles andere geht weiter ans Backend.
 */
test.describe('Empty-States bei 0 Säulen (Issue #440, AK5)', () => {
	test('AK5: Dashboard zeigt Empty-State, wenn keine Säulen existieren', async ({ page }) => {
		await page.route('**/api/v1/pillars', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
		);

		await page.goto('/app/');
		await waitForStableView(page);

		// Zum Dashboard-Tab navigieren.
		const dashboardTab = page.getByRole('tab', { name: 'Dashboard', exact: true });
		if (await dashboardTab.isVisible()) {
			await dashboardTab.click();
			await waitForStableView(page);
		}

		// Bei 0 Säulen soll im „Meine Themen"-Widget der Empty-State mit KolCard erscheinen.
		const pillarsSection = page.locator('.dashboard-pillars');
		await expect(pillarsSection).toBeVisible();

		// Der alte Plain-Text (<p>Keine Säulen vorhanden.</p>) darf nicht existieren.
		// Die neue KolCard enthält ein <p> im Slot — nur der alte direkte Plain-Text ist verboten.
		await expect(pillarsSection.locator('p:has-text("Keine Säulen vorhanden.")')).toHaveCount(0);

		// Stattdessen die KolCard — seit #1118-Folge ist die Sektion selbst der Card-Host.
		const card = pillarsSection;
		await expect(card).toBeVisible();
		await expect(card).toContainText('in den Einstellungen');
	});
});
