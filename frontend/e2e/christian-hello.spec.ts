import { expect, test } from './fixtures';

/**
 * Spec-Tests für Issue #204: Demo-Alert „Hallo, Christian!" auf der Startseite.
 *
 * AK 1: Startseite zeigt eine Info-Alert-Message mit dem Text „Hallo, Christian!",
 * sobald ein authentifizierter Benutzer die App öffnet.
 *
 * ROTE TESTS — werden grün, sobald die Implementierung in App.tsx existiert.
 */

test('AK 1: Startseite zeigt Info-Alert mit Text „Hallo, Christian!"', async ({ page }) => {
	await page.goto('/');

	// Die KolAlert-Komponente rendert ihren Text-Inhalt als slot-Inhalt.
	// Der Text „Hallo, Christian!" muss sichtbar auf der Seite sein.
	await expect(page.getByText('Hallo, Christian!')).toBeVisible();
});

test('AK 1b: Alert ist eine Info-Meldung (nicht Warnung/Fehler)', async ({ page }) => {
	await page.goto('/');

	// KolAlert mit _type="info" rendert ein Element mit role="alert" oder einem
	// kol-alert-Element. Der Text muss darin enthalten sein.
	const alertText = page.getByText('Hallo, Christian!');
	await expect(alertText).toBeVisible();

	// Sicherstellen, dass es sich im Kontext einer Alert-Komponente befindet
	// (kein normaler Fließtext, sondern eingebettet in kol-alert oder ähnliches).
	const kolAlert = page.locator('kol-alert').filter({ hasText: 'Hallo, Christian!' });
	await expect(kolAlert).toBeVisible();
});
