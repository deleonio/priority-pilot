import { expect, test, type Page } from './fixtures';
import { accordionTrigger, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2850 — Push-Gruppenschalter (Spec: docs/spec/issue-2850.md).
 *
 * - AK2 (375px): ein Toggle an „Tipps und Angebote“ überlebt den Reload, weil die Einstellung
 *   serverseitig pro Nutzer gespeichert wird (Beweis über GET /api/v1/push-groups, Muster #1794).
 * - AK5 (375px): fünf Schalter sichtbar und keiner ragt über den Viewport (Bounding-Box statt
 *   scrollWidth — die App-Shell clippt mit overflow-x:hidden, Known-Limit).
 */

const groupSwitch = (page: Page, name: RegExp) =>
	page.getByRole('checkbox', { name }).or(page.getByRole('switch', { name }));

const FÜNF_LABELS = [
	'Aufgaben und Erinnerungen',
	'Fürsorge',
	'Erfolge und Rückblicke',
	'Gruppen',
	'Tipps und Angebote',
];

test.describe('Balamentum — #2850: Push-Gruppenschalter', () => {
	test('AK2/AK5 — 375px: fünf Schalter ohne horizontalen Überlauf, Toggle überlebt den Reload', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');

		// Push-Details-Umbau: die fünf Schalter sitzen im Klappbereich „Einzelne
		// Benachrichtigungen" — vor Messung und Klick aufklappen (Push-Master bleibt aus,
		// app-seitiger Klappzustand, Muster settings-switch-layout AK8).
		await accordionTrigger(page, 'Einzelne Benachrichtigungen').click();

		// AK5: alle fünf Schalter vorhanden, keiner ragt über den Viewport (Bounding-Box am
		// KoliBri-Host, Muster issue-1794-care-switch.spec.ts).
		for (const label of FÜNF_LABELS) {
			const box = await page.locator(`kol-input-checkbox[_variant="switch"][_label="${label}"]`).boundingBox();
			expect(box, `${label} rendert messbar`).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(-1);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		}

		// AK2: „Tipps und Angebote“ (Default aus) umlegen; der PUT je Änderung ist async — erst
		// abwarten, bis der Server den neuen Wert meldet, dann ist der Reload ein echter
		// Persistenz-Beweis (Muster #1794 AK7).
		const tipps = groupSwitch(page, /tipps und angebote/i);
		await expect(tipps, 'Tipps-Schalter fehlt in der Karte „Benachrichtigungen“').toHaveCount(1);

		const readTipps = async () => {
			const response = await page.request.get('/api/v1/push-groups');
			if (!response.ok()) return undefined;
			return ((await response.json()) as { tipPushEnabled?: boolean }).tipPushEnabled;
		};
		const initial = (await readTipps()) ?? false;
		if (initial) await expect(tipps).toBeChecked();
		else await expect(tipps).not.toBeChecked();

		await tipps.click();
		await expect.poll(readTipps, { timeout: 10_000 }).toBe(!initial);

		await page.reload();
		await waitForStableView(page, 'Balamentum');
		await accordionTrigger(page, 'Einzelne Benachrichtigungen').click();
		const tippsNachReload = groupSwitch(page, /tipps und angebote/i);
		if (!initial) await expect(tippsNachReload).toBeChecked();
		else await expect(tippsNachReload).not.toBeChecked();
	});
});
