import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1794 — Fürsorge-Schalter (Spec: docs/spec/issue-1794.md).
 *
 * - AK7 (375px-Viewport): der Schalter „Fürsorge-Hinweise" ist in den Einstellungen sichtbar
 *   und bedienbar; ein Toggle überlebt den Reload, weil die Einstellung serverseitig pro
 *   Nutzer gespeichert wird (Beweis über GET /api/v1/care-config, Muster #1098 AK7).
 */

/** Fürsorge-Switch (Rolle checkbox/switch, Muster issue-1098-geo-settings.spec.ts). */
const careSwitch = (page: Page) =>
	page
		.getByRole('checkbox', { name: /fürsorge-hinweise/i })
		.or(page.getByRole('switch', { name: /fürsorge-hinweise/i }));

test.describe('Balamentum — #1794: Fürsorge-Schalter', () => {
	test('AK7 — 375px: Schalter sichtbar und bedienbar, Toggle überlebt den Reload', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		// Der Schalter lebt in der Karte „Benachrichtigungen" im Tab „Allgemein" — Default-Route
		// ohne Segment ist „Säulen" (`App.tsx` settingsTab-Fallback), also explizit `/general`.
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');

		const care = careSwitch(page);
		await expect(care, 'Fürsorge-Schalter fehlt in den Einstellungen').toHaveCount(1);
		await expect(care).toBeVisible();

		// Touch-Ziel (Mobile-UI-Regeln): mindestens 44px hoch, im Viewport (Bounding-Box statt
		// scrollWidth — die App-Shell clippt mit overflow-x:hidden). Gemessen am Host-Element
		// (Muster settings-switch-layout.spec.ts AK3): die Rollen-Locator lösen auf das native,
		// visuell verkleinerte `<input>` auf, nicht auf den sichtbaren KoliBri-Switch.
		const box = await page.locator('kol-input-checkbox[_variant="switch"][_label="Fürsorge-Hinweise"]').boundingBox();
		expect(box, 'Schalter rendert messbar').not.toBeNull();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.x).toBeGreaterThanOrEqual(-1);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		// Ausgangszustand vom Server lesen (die In-Memory-DB überlebt Retries/Wiederholungen) und
		// erst klicken, wenn der Schalter den geladenen Wert zeigt — sonst trifft der Klick den Default.
		const readCare = async () => {
			const response = await page.request.get('/api/v1/care-config');
			if (!response.ok()) return undefined;
			return ((await response.json()) as { carePushEnabled?: boolean }).carePushEnabled;
		};
		const initial = (await readCare()) ?? true;
		if (initial) await expect(care).toBeChecked();
		else await expect(care).not.toBeChecked();

		await care.click();

		// Der PUT je Änderung ist async — erst abwarten, bis der Server den neuen Wert meldet,
		// dann ist der Reload ein echter Persistenz-Beweis (Muster #1098 AK7).
		await expect.poll(readCare, { timeout: 10_000 }).toBe(!initial);

		await page.reload();
		await waitForStableView(page, 'Balamentum');
		await expect(careSwitch(page), 'der gespeicherte Zustand überlebt den Reload').toBeChecked({ checked: !initial });
	});
});
