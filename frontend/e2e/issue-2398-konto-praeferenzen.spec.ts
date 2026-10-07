import { expect, test } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2398 AK3 (Spec: docs/spec/issue-2398.md) — Konto-Präferenzen überleben einen
 * leeren localStorage (anderes Gerät). Eigene Session (`registerOwnSession`), gegen das echte
 * Backend: der Wert wird per API am Konto gesetzt, localStorage geleert, die App neu geladen —
 * der Spiegel muss den Kontowert wieder zeigen. Rot, bis `/account-preferences` existiert.
 */
test('AK3: Expertenmodus am Konto → nach leerem localStorage und Reload unverändert', async ({ page }) => {
	await registerOwnSession(page, 'konto-prefs-2398');
	await page.unroute('**/auth/me');

	// GET liefert den CSRF-Token als Header (Muster balanceVariant, #2009), der PUT sendet ihn mit.
	const initial = await page.request.get('/api/v1/account-preferences');
	expect(initial.status(), 'Endpunkt existiert').toBe(200);
	const token = initial.headers()['x-csrf-token'];
	const saved = await page.request.put('/api/v1/account-preferences', {
		data: { expertMode: true, aiEnabled: false },
		headers: token ? { 'x-csrf-token': token } : {},
	});
	expect(saved.status()).toBe(200);

	await page.goto('/app/aufgaben');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await waitForStableView(page);

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('pp-expert-mode')), { timeout: 10_000 })
		.toBe('true');
	expect(await page.evaluate(() => localStorage.getItem('pp-ai-enabled'))).toBe('false');
});
