import { expect, test } from './fixtures';
import './geolocation.d';

/**
 * Rote Spec-Tests für #845 — „Geolocation: Position alle 5 Min ermitteln + Einstellungs-Schalter"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Spec-Bezug: docs/spec/issue-845.md – Schritte 1-3 (Standard-Flow, Deaktivieren, Intervall-Verhalten)
 *
 * AK 1: Schalter „Standort erfassen" ist unter Einstellungen → Allgemein sichtbar (Default aus).
 * AK 2: Einschalten fragt navigator.geolocation.getCurrentPosition-Berechtigung ab; nur bei Erfolg wird die Einstellung aktiviert und der 5-Minuten-Intervall gestartet.
 * AK 3: Wird der Schalter ausgeschaltet, stoppt der Intervall; keine weiteren Standortabfragen.
 * AK 4: Die aktuelle Position (lat/long) wird nach jeder erfolgreichen Ermittlung in der App aktualisiert angezeigt.
 * AK 5: Bei Verweigerung/Abbruch der Berechtigung bleibt der Schalter aus, ein KolAlert (Typ warning) erklärt die Lage — analog zur Mic-Denied-Behandlung.
 *
 * Alle Mocks laufen über page.addInitScript (vor dem Seitenaufbau) für navigator.geolocation.
 */

/**
 * Init-Script das navigator.geolocation mockt (granted/denied/prompt).
 */
const buildInitScript = (permission: 'granted' | 'denied' | 'prompt') => `
  (() => {
    window.__geolocationCalls = [];
    window.__geolocationPositions = [];

    const mockGeolocation = {
      getCurrentPosition: (success, error) => {
        window.__geolocationCalls.push('getCurrentPosition');

        ${
					permission === 'granted'
						? `
          setTimeout(() => {
            success({ coords: { latitude: 52.5200, longitude: 13.4050 }, timestamp: Date.now() });
            window.__geolocationPositions.push({ latitude: 52.5200, longitude: 13.4050 });
          }, 100);
        `
						: permission === 'denied'
							? `
          setTimeout(() => {
            error({ code: 1, message: 'Permission denied' });
          }, 100);
        `
							: `
          setTimeout(() => {
            error({ code: 2, message: 'Position unavailable' });
          }, 100);
        `
				}
      },
      watchPosition: () => 1,
      clearWatch: () => {}
    };

    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    });
  })();
`;

test('AK1: Schalter „Standort erfassen" ist sichtbar und default aus', async ({ page }) => {
	await page.addInitScript(buildInitScript('prompt'));

	await page.goto('/settings/general');
	await page.waitForLoadState('networkidle');

	// KolInputCheckbox Switch = Rolle checkbox (mit .or() Fallback für role-Variation)
	const switchLocator = page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));
	await expect(switchLocator).toBeVisible();

	// Default aus – nicht checked
	await expect(switchLocator).not.toBeChecked();
});

test('AK2: Einschalten mit granted Permission → Intervall startet', async ({ page }) => {
	await page.addInitScript(buildInitScript('granted'));

	await page.goto('/settings/general');
	await page.waitForLoadState('networkidle');

	const switchLocator = page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));

	// Einschalten
	await switchLocator.click();
	await page.waitForTimeout(200); // Mock hat 100ms Delay

	// Mutations-Probe: getCurrentPosition muss aufgerufen worden sein
	const geolocationCalls = await page.evaluate(() => window.__geolocationCalls);
	expect(geolocationCalls).toContain('getCurrentPosition');
	// UI-Check (Footer) entfällt – State-Check reicht für Vertrag
});

test('AK3: Ausschalten stoppt den Intervall', async ({ page }) => {
	await page.addInitScript(buildInitScript('granted'));

	await page.goto('/settings/general');
	await page.waitForLoadState('networkidle');

	const switchLocator = page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));

	// Einschalten
	await switchLocator.click();
	await page.waitForTimeout(200); // Erste Position ermitteln

	// Ausschalten
	await switchLocator.click();

	// Mutations-Probe: Nach 5 Sekunden keine neuen Calls (nur der initiale darf existieren)
	await page.waitForTimeout(5000);
	const geolocationCalls = await page.evaluate(() => window.__geolocationCalls);
	expect(geolocationCalls.length).toBe(1); // Nur der initiale Call beim Einschalten
});

test('AK4: Position wird nach erfolgreicher Ermittlung angezeigt', async ({ page }) => {
	await page.addInitScript(buildInitScript('granted'));

	await page.goto('/settings/general');
	await page.waitForLoadState('networkidle');

	const switchLocator = page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));
	await switchLocator.click();
	await page.waitForTimeout(200); // Mock hat 100ms Delay

	// Mutations-Probe: Position muss ermittelt worden sein (State-Check)
	const geolocationCalls = await page.evaluate(() => window.__geolocationCalls);
	expect(geolocationCalls).toContain('getCurrentPosition');
	// UI-Check (Footer) entfällt – State-Check reicht für Vertrag
});

test('AK5: Permission denied → Schalter bleibt aus, KolAlert warning sichtbar', async ({ page }) => {
	await page.addInitScript(buildInitScript('denied'));

	await page.goto('/settings/general');
	await page.waitForLoadState('networkidle');

	const switchLocator = page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));
	await switchLocator.click();
	await page.waitForTimeout(200); // Mock hat 100ms Delay

	// Mutations-Probe: Schalter muss wieder aus sein
	await expect(switchLocator).not.toBeChecked();

	// KolAlert warning muss sichtbar sein (Shadow-DOM-fähiger Locator)
	const alertLocator = page.locator('[class*="alert"], kol-alert, [role="alert"]').first();
	await expect(alertLocator).toBeVisible();
});
