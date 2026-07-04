import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #125 „Header – Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets (siehe Triage-Analyse, Owner-Entscheidung): Die einfachen Bedienelemente rechts
 * oben im Header — „Neuen Task anlegen", „Aktualisieren" und der Darstellungs-Umschalter — werden zu
 * einer **echten** `KolToolbar` (Toolbar-Rolle, gemeinsame Pfeiltasten-Navigation, sprechendes
 * `_label`) gruppiert. Der `KolPopoverButton` „Einstellungen" bleibt **außerhalb** der Toolbar als
 * Geschwister-Element erhalten (er trägt Kind-Inhalt, der sich nicht über `_items` abbilden lässt).
 *
 * Diese Tests sind **rot**, bis die Umsetzung den `<div className="toolbar">` in `App.tsx` durch eine
 * `KolToolbar _label="Kopf-Aktionen"` ersetzt. Sie prüfen reines UI-Verhalten gegen das echte Backend
 * (kein Mock, wie in `crud.spec.ts`); der Vite-Proxy reicht API-Requests an das Express-Backend mit
 * In-Memory-DB durch (siehe `playwright.config.ts`).
 */
test.describe('#125 Header – Toolbar', () => {
	/**
	 * AK1 — Toolbar-Semantik: Die drei Bedienelemente sind in einem Element mit Toolbar-Rolle
	 * (sprechendes Label „Kopf-Aktionen") gruppiert; die drei Buttons sind dessen Nachkommen.
	 */
	test('AK1: Header-Aktionen liegen in einer benannten Toolbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		await expect(toolbar.getByRole('button', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Aktualisieren' })).toBeVisible();
		// Hinweis (#285): Der Darstellungs-Umschalter wurde aus der Toolbar in die Einstellungen
		// verschoben; seine frühere Anwesenheits-Assertion entfällt hier (siehe #285-Block unten).
	});

	/**
	 * AK2 — keine Regression der Aktionen: „Neuen Task anlegen" öffnet den Anlege-Dialog,
	 * „Aktualisieren" lädt die Liste neu (Button ist klickbar und nicht dauerhaft deaktiviert).
	 */
	test('AK2: Aktionen in der Toolbar funktionieren weiterhin', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });

		// „Neuen Task anlegen" öffnet den Dialog (gleicher Flow wie in crud.spec.ts).
		await toolbar.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		// Dialog wieder schließen, damit „Aktualisieren" frei klickbar ist.
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// „Aktualisieren" löst einen erneuten Listen-Request aus (beweist: Button verdrahtet & aktiv).
		const reloadRequest = page.waitForRequest(
			(request) => request.url().includes('/tasks') && request.method() === 'GET',
		);
		await toolbar.getByRole('button', { name: 'Aktualisieren' }).click();
		await reloadRequest;
	});

	/*
	 * AK3 (#125) — entfallen mit #285: Der zyklische Darstellungs-Umschalter lag früher als Button in
	 * dieser Toolbar. Mit #285 wandert die Theme-Wahl als 3-Optionen-Bedienelement in den
	 * Einstellungen-Tab „Allgemein". Der zugehörige Vertrag steht jetzt in
	 * `settings-appearance.spec.ts` (AK5–AK7) sowie im #285-Block am Ende dieser Datei (AK4).
	 */

	/**
	 * AK4 — Einstellungs-Button liegt in der Toolbar und navigiert zu /settings/pillars.
	 * Das bisherige Popover und der Popover-Button außerhalb der Toolbar sind entfernt (#270).
	 */
	test('AK4: „Einstellungen"-Button liegt in der Toolbar und navigiert zu /settings/pillars', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		// Der Einstellungs-Button liegt jetzt INNERHALB der Toolbar.
		await expect(toolbar.getByRole('button', { name: 'Einstellungen' })).toBeVisible();

		// Klick navigiert zur Settings-Route (kein Popover mehr).
		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/settings\/pillars/);
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
	});
});

/**
 * ROTE Spec-Tests für #285 „Header-Toolbar kompakter (Icon-Buttons) und Dark-Mode-Schalter in die
 * Einstellungen" (Stufe 1 TDD, der einklagbare Vertrag) — Teil Header.
 *
 * Ziel (Teil 1): Die drei Toolbar-Buttons, die im Header noch ein sichtbares Textlabel tragen —
 * „Neuen Task anlegen", „Serien verwalten" und „Abmelden" — werden auf Icon-only umgestellt
 * (`_hideLabel: true` + Icon), behalten aber ihren Accessible Name. Alle übrigen Buttons sind
 * bereits Icon-only.
 *
 * Ziel (Teil 2, hier nur die Header-Seite): Der Darstellungs-/Theme-Umschalter wird aus der Toolbar
 * ENTFERNT. Das neue 3-Optionen-Bedienelement in den Einstellungen prüft
 * `settings-appearance.spec.ts` (AK5–AK7).
 *
 * Die Tests sind **rot**, bis `App.tsx` umgesetzt ist: Solange „Neuen Task anlegen" etc. noch ein
 * sichtbares Label tragen bzw. der Theme-Button noch in der Toolbar liegt, schlagen AK1/AK4 fehl.
 */
test.describe('#285 Header – kompakte Icon-Toolbar', () => {
	/** Die drei Buttons, die laut #285 auf Icon-only umgestellt werden. */
	const ICON_ONLY_LABELS = ['Neuen Task anlegen', 'Serien verwalten', 'Abmelden'] as const;

	/**
	 * AK1 — Icon-only mit erhaltenem Accessible Name: Jeder Ziel-Button ist per Accessible Name
	 * auffindbar (Regression-sicher) UND zeigt nur ein Icon, kein sichtbares Textlabel.
	 *
	 * KOL rendert die Toolbar-Buttons als `kol-button-wc` im Shadow-DOM der Toolbar; ist `_hideLabel`
	 * gesetzt, bekommt der Label-Span die Klasse `kol-span--hide-label` (visuell versteckt, aber im
	 * Accessibility-Tree als Name erhalten). Das prüfen wir hier direkt am gerenderten Button:
	 * sichtbarer Textinhalt leer + versteckter Label-Span vorhanden.
	 */
	for (const label of ICON_ONLY_LABELS) {
		test(`AK1: „${label}" ist Icon-only (kein sichtbares Label) mit erhaltenem Accessible Name`, async ({ page }) => {
			await page.goto('/');
			await waitForStableView(page);

			const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
			const btn = toolbar.getByRole('button', { name: label });

			// Accessible Name bleibt erhalten (der Button ist weiterhin auffindbar & sprechend benannt).
			await expect(btn).toBeVisible();
			await expect(btn).toHaveAccessibleName(label);

			// Das Label ist visuell versteckt: kein sichtbarer Textinhalt, aber ein Label-Span mit der
			// KOL-Hide-Label-Klasse (nur das Icon wird gezeigt).
			const hidesLabel = await btn.evaluate((el) => {
				const button = el as HTMLElement;
				const visibleText = (button.textContent ?? '').trim();
				const span = button.querySelector('span.kol-span--hide-label, span[class*="hide-label"]');
				return visibleText === '' && span !== null;
			});
			expect(hidesLabel, `„${label}" sollte nur das Icon zeigen (verstecktes Label)`).toBe(true);
		});
	}

	/**
	 * AK2 (Regression) — Bestehende Aktionen bleiben per Accessible Name klickbar: Auch nach der
	 * Icon-only-Umstellung öffnet „Neuen Task anlegen" den Anlege-Dialog. (Die vollständige AK2-
	 * Regression steht im #125-Block oben; dieser Test sichert die drei umgestellten Buttons ab.)
	 */
	test('AK2 (Regression): umgestellte Icon-Buttons bleiben per Accessible Name bedienbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });

		// Alle drei Ziel-Buttons sind weiterhin per Accessible Name auffindbar & sichtbar.
		for (const label of ICON_ONLY_LABELS) {
			await expect(toolbar.getByRole('button', { name: label })).toBeVisible();
		}

		// Exemplarisch: „Neuen Task anlegen" öffnet weiterhin den Anlege-Dialog.
		await toolbar.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	});

	/**
	 * AK3 (Mobile 375×812) — Kein horizontaler Overflow des Headers: Auf einem schmalen Viewport
	 * verursacht die kompaktere Icon-Toolbar kein horizontales Scrollen des Dokuments.
	 */
	test('AK3: Header verursacht keinen horizontalen Overflow bei 375×812', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		// Toolbar bleibt sichtbar und bedienbar.
		await expect(page.getByRole('toolbar', { name: /Kopf-Aktionen/ })).toBeVisible();

		// Kein horizontaler Überlauf des Dokuments.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK4 — Kein Darstellungs-/Theme-Button mehr in der Header-Toolbar: Der frühere Umschalter
	 * (Accessible Name „Darstellung: …") wurde in die Einstellungen verschoben und existiert in der
	 * Toolbar nicht mehr.
	 */
	test('AK4: Header-Toolbar enthält keinen Darstellungs-/Theme-Button mehr', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar.getByRole('button', { name: /Darstellung/ })).toHaveCount(0);
	});
});
