import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #971 „Switch-Layout im Tab Allgemein der Einstellungen".
 *
 * Spezifikation: docs/spec/issue-971.md
 * Ziel: Die Switches (Sprachaufnahme, Push) liegen mit ihren zugehörigen Alerts in einem
 * `div.settings-switch-row` — mobil (<768px) volle Breite im Stack-Layout, desktop (≥768px)
 * eine Zeile (`flex-direction: row; align-items: center`), Alert rechts.
 *
 * HINWEIS: Seit #1151 gibt es nur noch 2 Switches im Tab "Allgemein" (Sprachaufnahme, Push);
 * der "Standort erfassen"-Switch wurde in den neuen "Standort"-Tab verschoben.
 *
 * Testklassen (siehe Spec „Erwartetes Ergebnis"):
 * - AK1/AK2/AK6 sind ROT, bis Wrapper + CSS umgesetzt sind (Spec-Phase 3/6).
 * - AK3/AK4/AK5 sind Sicherungs- Tests (Schutz): Sie können bereits jetzt grün sein und sichern,
 *   dass die Layout-Umsetzung Touch-Targets, Overflow und ARIA nicht still zerstört.
 *
 * Bezug zur Spec:
 * - Test 1 → Spec AK1 (Mobile: volle Breite, Stack)
 * - Test 2 → Spec AK2 (Desktop: Row-Layout, zentriert)
 * - Test 3 → Spec AK3 (Touch-Targets ≥44px)
 * - Test 4 → Spec AK4 (kein horizontaler Scroll bei 375px)
 * - Test 5 → Spec AK5 (ARIA role/aria-checked bleiben erhalten)
 * - Test 6 → Spec AK6 (Alert-Position: mobil unter, desktop rechts neben dem Switch)
 */

/** Schalter-Locator mit Rollen-Fallback: KoliBri exponiert `switch` bzw. `checkbox` je Version. */
const switchControl = (page: import('@playwright/test').Page, name: RegExp) =>
	page.getByRole('switch', { name }).or(page.getByRole('checkbox', { name }));

const MIC_DENIED_INIT_SCRIPT = `
	(() => {
		window.__getUserMediaCalled = false;
		if (navigator.mediaDevices) {
			navigator.mediaDevices.getUserMedia = async () => {
				window.__getUserMediaCalled = true;
				throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
			};
		}
	})();
`;

const MIC_GRANTED_INIT_SCRIPT = `
	(() => {
		if (navigator.mediaDevices) {
			navigator.mediaDevices.getUserMedia = async () => new MediaStream();
		}
	})();
`;

test.describe('#971 Switch-Layout im Tab Allgemein', () => {
	/**
	 * Spec-Bezug: AK1 — Mobile (<768px): Jeder Switch liegt in einem `.settings-switch-row`,
	 * der die volle Breite von `.settings-general` einnimmt (Stack-Layout).
	 * ROT bis Umsetzung: Ohne Wrapper findet der Locator 0 Zeilen (Guard gegen leere Menge).
	 */
	test('AK1: Mobile 375px — jede Switch-Zeile nimmt die volle Breite ein', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const rows = page.locator('.settings-switch-row');
		// Seit #1151 gibt es nur noch 2 Switches im Tab "Allgemein" (Sprachaufnahme, Push).
		await expect(rows).toHaveCount(2);

		const containerBox = await page.locator('.settings-general').first().boundingBox();
		expect(containerBox).toBeTruthy();

		for (let i = 0; i < 2; i++) {
			const rowBox = await rows.nth(i).boundingBox();
			expect(rowBox).toBeTruthy();
			// Volle Breite: ≥95% der Container-Breite (5% Toleranz für Rundung/Padding).
			expect(rowBox!.width).toBeGreaterThanOrEqual(containerBox!.width * 0.95);
		}
	});

	/**
	 * Spec-Bezug: AK2 — Desktop (≥768px): `.settings-switch-row` ist eine Zeile gemäß
	 * Ticket-CSS (flex-direction: row; align-items: center). Der KoliBri-Host ist unteilbar
	 * (Shadow-DOM ohne CSS-Parts) — „Label links / Control rechts" ist auf Host-Ebene als
	 * Row-Layout mit rechtsbündigem Alert umgesetzt (Spec-Abgrenzung 3).
	 * ROT bis Umsetzung: Ohne Wrapper gibt es kein computed style zu lesen.
	 */
	test('AK2: Desktop 1024px — Switch-Zeilen sind horizontal ausgerichtet und zentriert', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const rows = page.locator('.settings-switch-row');
		// Seit #1151 gibt es nur noch 2 Switches im Tab "Allgemein" (Sprachaufnahme, Push).
		await expect(rows).toHaveCount(2);

		for (let i = 0; i < 2; i++) {
			const style = await rows.nth(i).evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return { flexDirection: computed.flexDirection, alignItems: computed.alignItems };
			});
			expect(style.flexDirection).toBe('row');
			expect(style.alignItems).toBe('center');
		}
	});

	/**
	 * Spec-Bezug: AK3 — Touch-Targets der Switches bleiben ≥44px (Mobile-UI-Regel 2).
	 * Sicherungs-Test (Schutz): darf bereits grün sein; sichert, dass die Layout-Änderung
	 * (Wrapper/CSS) die Bedienbarkeit auf Mobile nicht schrumpft.
	 */
	test('AK3: Mobile 375px — Touch-Targets der Switches bleiben ≥44px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const switches = page.locator('.settings-general kol-input-checkbox[_variant="switch"]');
		// Seit #1151 gibt es nur noch 2 Switches im Tab "Allgemein" (Sprachaufnahme, Push).
		await expect(switches).toHaveCount(2);

		for (let i = 0; i < 2; i++) {
			const box = await switches.nth(i).boundingBox();
			expect(box).toBeTruthy();
			expect(box!.height).toBeGreaterThanOrEqual(44);
			expect(box!.width).toBeGreaterThanOrEqual(44);
		}
	});

	/**
	 * Spec-Bezug: AK4 — Kein horizontaler Scroll bei 375px.
	 * Sicherungs-Test (Schutz): Der neue Wrapper (width: 100%, desktop margin-left: auto des
	 * Alerts) darf keinen Overflow erzeugen. Kann bereits grün sein.
	 */
	test('AK4: Mobile 375px — kein horizontaler Scroll', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const overflow = await page.evaluate<{ scroll: number; client: number } | null>(() => {
			const el = document.scrollingElement;
			return el === null ? null : { scroll: el.scrollWidth, client: el.clientWidth };
		});
		expect(overflow).not.toBeNull();
		expect(overflow!.scroll).toBeLessThanOrEqual(overflow!.client + 1);
	});

	/**
	 * Spec-Bezug: AK5 — KoliBri-ARIA bleibt erhalten: Alle 3 Switches sind rollenadressierbar
	 * (`switch`/`checkbox` je KoliBri-Version) und der ARIA-Zustand ist togglebar. KoliBri rendert
	 * einen nativen `<input type="checkbox">`, dessen `aria-checked` IMPLIZIT ist (kein wörtliches
	 * Attribut) — der Zustand wird daher über `toBeChecked` (Accessibility-Baum) geprüft.
	 * Sicherungs-Test (Schutz) gegen ARIA-Verlust durch den Wrapper-Umbau.
	 */
	test('AK5: ARIA der 3 Switches bleibt erhalten (Zustand togglebar)', async ({ page }) => {
		await page.addInitScript(MIC_GRANTED_INIT_SCRIPT);
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const labels = [/Sprachaufnahme automatisch starten/i, /Push-Nachrichten aktivieren/i];
		// Seit #1151 gibt es nur noch 2 Switches im Tab "Allgemein" (Sprachaufnahme, Push);
		// Rollenadressierung intakt (Locator-Auflösung beweist die Rolle).
		for (const label of labels) {
			await expect(switchControl(page, label)).toBeVisible();
		}

		// Toggle-Verhalten am Sprachaufnahme-Switch (Berechtigung im Mock erteilt → Schalter geht an).
		const voiceSwitch = switchControl(page, labels[0]);
		await expect(voiceSwitch).not.toBeChecked();
		await voiceSwitch.click();
		await expect(voiceSwitch).toBeChecked();
	});

	/**
	 * Spec-Bezug: AK6 — Switch-Alert (micDenied nach verweigerter Mikrofon-Berechtigung):
	 * mobil UNTER dem Switch (Alert-Oberkante ≥ Switch-Unterkante), desktop RECHTS neben dem
	 * Switch (Alert beginnt nach dem Switch-Ende, vertikal zur Zeile zentriert).
	 * ROT bis Umsetzung: Der Alert liegt aktuell außerhalb eines (nicht existierenden) Wrappers.
	 */
	test('AK6: micDenied-Alert mobil unter, desktop rechts neben dem Switch', async ({ page }) => {
		await page.addInitScript(MIC_DENIED_INIT_SCRIPT);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Berechtigung verweigern → micDenied-Alert erscheint.
		const voiceSwitch = switchControl(page, /Sprachaufnahme automatisch starten/i);
		await voiceSwitch.click();
		await expect.poll(() => page.evaluate(() => window.__getUserMediaCalled === true)).toBe(true);

		const voiceRow = page
			.locator('.settings-switch-row')
			.filter({ hasText: /Sprachaufnahme/ })
			.first();
		const micAlert = voiceRow.locator('kol-alert', { hasText: /Mikrofon-Zugriff verweigert/ });
		await expect(micAlert).toBeVisible();

		// Mobile: Alert vollständig UNTER dem Switch-Host.
		let switchBox = await voiceRow.locator('kol-input-checkbox').first().boundingBox();
		let alertBox = await micAlert.boundingBox();
		expect(switchBox).toBeTruthy();
		expect(alertBox).toBeTruthy();
		expect(alertBox!.y).toBeGreaterThanOrEqual(switchBox!.y + switchBox!.height);

		// Desktop: gleiche Zeile — Alert beginnt rechts vom Switch-Ende und ist zur Zeile zentriert.
		await page.setViewportSize({ width: 1024, height: 768 });
		await voiceRow.waitFor({ state: 'visible' });
		switchBox = await voiceRow.locator('kol-input-checkbox').first().boundingBox();
		alertBox = await micAlert.boundingBox();
		const rowBox = await voiceRow.boundingBox();
		expect(switchBox).toBeTruthy();
		expect(alertBox).toBeTruthy();
		expect(rowBox).toBeTruthy();
		expect(alertBox!.x).toBeGreaterThanOrEqual(switchBox!.x + switchBox!.width);
		const alertCenterY = alertBox!.y + alertBox!.height / 2;
		const rowCenterY = rowBox!.y + rowBox!.height / 2;
		expect(Math.abs(alertCenterY - rowCenterY)).toBeLessThanOrEqual(8);
	});

	/**
	 * Seit #1151: Der "Standort erfassen"-Switch wurde in den neuen "Standort"-Tab verschoben.
	 * Dieser Test stellt sicher, dass er dort vorhanden ist und korrekt funktioniert.
	 */
	test('AK7: Standort-Switch ist im Standort-Tab vorhanden und funktionsfähig', async ({ page }) => {
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Priority Pilot');

		// Der Standort-Switch sollte im Standort-Tab sichtbar sein.
		const locationSwitch = switchControl(page, /Standort erfassen/i);
		await expect(locationSwitch).toBeVisible();

		// Der Switch sollte standardmäßig ausgeschaltet sein.
		await expect(locationSwitch).not.toBeChecked();

		// Der Switch sollte im `.settings-switch-row` liegen.
		const locationRow = page.locator('.settings-switch-row').filter({ hasText: /Standort erfassen/ });
		await expect(locationRow).toHaveCount(1);
	});
});
