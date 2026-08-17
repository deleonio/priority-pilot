import { expect, test } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #125 „Header – Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets (siehe Triage-Analyse, Owner-Entscheidung): Die einfachen Bedienelemente rechts
 * oben im Header — „Neuen Task anlegen" und der Darstellungs-Umschalter — werden zu
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
	});

	/*
	 * AK3 (#125) — entfallen mit #285: Der zyklische Darstellungs-Umschalter lag früher als Button in
	 * dieser Toolbar. Mit #285 wandert die Theme-Wahl als 3-Optionen-Bedienelement in den
	 * Einstellungen-Tab „Allgemein". Der zugehörige Vertrag steht jetzt in
	 * `settings-appearance.spec.ts` (AK5–AK7) sowie im #285-Block am Ende dieser Datei (AK4).
	 */

	/**
	 * AK4 — Einstellungs-Button liegt in der Toolbar und navigiert zu /settings/general (#382).
	 * Das bisherige Popover und der Popover-Button außerhalb der Toolbar sind entfernt (#270).
	 */
	test('AK4: „Einstellungen"-Button liegt in der Toolbar und navigiert zu /settings/general', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		// Der Einstellungs-Button liegt jetzt INNERHALB der Toolbar.
		await expect(toolbar.getByRole('button', { name: 'Einstellungen' })).toBeVisible();

		// Klick navigiert zur Settings-Route (kein Popover mehr); seit #382 öffnet sich „Allgemein".
		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/settings\/general/);
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');
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
	/**
	 * Die Buttons, die laut #285 auf Icon-only umgestellt werden.
	 * Nach #335 (AK6) entfällt „Serien verwalten" aus der Header-Toolbar (eigener Serien-Tab),
	 * daher ist er hier nicht mehr aufgeführt.
	 */
	const ICON_ONLY_LABELS = ['Neuen Task anlegen', 'Abmelden'] as const;

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

/**
 * ROTE Spec-Tests für #298 „„Aktualisieren"-Schalter ersatzlos entfernen"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Der „Aktualisieren"-Button wird ersatzlos aus der Header-Toolbar entfernt.
 * Die App lädt nach jeder Mutation automatisch neu — ein manueller Reload-Button
 * ist überflüssig.
 */
test.describe('#298 „Aktualisieren"-Button entfernt', () => {
	/**
	 * AK1 — Button entfernt: In der Toolbar „Kopf-Aktionen" existiert kein Button
	 * mit Accessible Name „Aktualisieren" mehr.
	 */
	test('AK1: „Aktualisieren"-Button ist nicht mehr in der Toolbar vorhanden', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		// Der Button darf nicht mehr existieren — Count muss 0 sein.
		await expect(toolbar.getByRole('button', { name: 'Aktualisieren' })).toHaveCount(0);
	});

	/**
	 * AK2 — Regression: Die übrigen Toolbar-Buttons bleiben sichtbar & bedienbar.
	 * Buttons: „Neuen Task anlegen", „Serien verwalten", „Hilfe", „Einstellungen", „Abmelden".
	 * „Neuen Task anlegen" öffnet weiterhin den Anlege-Dialog.
	 */
	test('AK2: Übrige Toolbar-Aktionen bleiben vollständig bedienbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });

		// Alle verbleibenden Buttons sind weiterhin per Accessible Name auffindbar.
		// Nach #335 (AK6) ist „Serien verwalten" nicht mehr dabei (eigener Serien-Tab).
		await expect(toolbar.getByRole('button', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Hilfe' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Einstellungen' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Abmelden' })).toBeVisible();

		// „Neuen Task anlegen" öffnet weiterhin den Anlege-Dialog.
		await toolbar.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	});
});

/**
 * ROTE Spec-Tests für #312 „Reihenfolge von „Hilfe" und „Einstellungen" tauschen und
 * Einstellungen-Icon auf Zahnrad ändern" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Zwei Änderungen in App.tsx:
 * 1. Reihenfolge der `_items`-Einträge: „Einstellungen" VOR „Hilfe" (aktuell umgekehrt).
 * 2. `SETTINGS_ICON`: `kolicon-settings` → Zahnrad (z. B. `fa-solid fa-gear` oder `kolicon-cogwheel`).
 *
 * AK1 + AK2 sind rot, bis App.tsx umgesetzt ist. AK3 + AK4 sind Regressions-Verträge.
 */
test.describe('#312 Toolbar-Reihenfolge und Zahnrad-Icon', () => {
	/**
	 * AK1 — Reihenfolge getauscht: „Einstellungen" erscheint in DOM-Reihenfolge vor „Hilfe".
	 * Aktuell ist die Reihenfolge Hilfe → Einstellungen → ROT bis zum Fix.
	 */
	test('AK1: „Einstellungen" liegt im DOM vor „Hilfe"', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		const buttons = toolbar.getByRole('button');
		const names: string[] = await buttons.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('aria-label') ?? (el as HTMLElement).textContent?.trim() ?? ''),
		);

		const idxSettings = names.findIndex((n) => /Einstellungen/i.test(n));
		const idxHelp = names.findIndex((n) => /Hilfe/i.test(n));

		expect(idxSettings, 'Index von „Einstellungen" muss gefunden werden').toBeGreaterThanOrEqual(0);
		expect(idxHelp, 'Index von „Hilfe" muss gefunden werden').toBeGreaterThanOrEqual(0);
		expect(idxSettings, '„Einstellungen" muss vor „Hilfe" erscheinen').toBeLessThan(idxHelp);
	});

	/**
	 * AK3 — Keine Navigations-Regression: Beide Buttons navigieren weiterhin korrekt.
	 * „Einstellungen" → /settings/general (#382), „Hilfe" → /hilfe.
	 */
	test('AK3: „Einstellungen" navigiert zu /settings/general und „Hilfe" zu /hilfe', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });

		// „Einstellungen" navigiert zur Settings-Route; seit #382 öffnet sich „Allgemein".
		await toolbar.getByRole('button', { name: 'Einstellungen' }).click();
		await expect(page).toHaveURL(/\/settings\/general/);
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Zurück und „Hilfe" testen.
		await page.goto('/');
		await waitForStableView(page);

		await toolbar.getByRole('button', { name: 'Hilfe' }).click();
		await expect(page).toHaveURL(/\/hilfe/);
		// Hilfe-Seite ist sichtbar (irgendeine Überschrift auf der Hilfe-Seite).
		await expect(page.getByRole('main')).toBeVisible();
	});

	/**
	 * AK4 — Mobile-First (375×812): Kein horizontaler Overflow; beide Buttons sichtbar und bedienbar.
	 */
	test('AK4: Kein horizontaler Overflow bei 375×812; beide Buttons sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		// Kein horizontales Scrollen.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);

		// Beide Buttons bleiben in neuer Reihenfolge erreichbar. Auf 375px liegen sie im „⋮"-Menü der
		// Kopf-Aktionen (der Header bleibt dadurch einzeilig, s. mobile-shell.spec.ts) — `headerAction`
		// kapselt, wo sie je nach Breite stehen.
		await expect(await headerAction(page, 'Einstellungen')).toBeVisible();
		await expect(await headerAction(page, 'Hilfe')).toBeVisible();
	});
});

/**
 * ROTE Spec-Tests für #335 „Serien-Verwaltung als eigenen Tab statt Modal anbieten"
 * (Stufe 1 TDD, der einklagbare Vertrag) — Header-Seite (AK6).
 *
 * Die Serien-Verwaltung wandert aus dem `SeriesManagementModal` (Einstieg über den Header-Button
 * „Serien verwalten") in einen eigenen Tab „Serien". Der Header-Button „Serien verwalten" wird dabei
 * ersatzlos entfernt.
 *
 * Diese Tests sind **rot**, solange der Button „Serien verwalten" noch in der Header-Toolbar liegt.
 */
test.describe('#335 Header — „Serien verwalten"-Button entfernt (AK6)', () => {
	/**
	 * AK6 — Der Header-Button „Serien verwalten" existiert nicht mehr in der Toolbar (Count 0);
	 * die Serien-Verwaltung liegt nun im eigenen Serien-Tab.
	 */
	test('AK6: „Serien verwalten"-Button ist nicht mehr in der Header-Toolbar (Count 0)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		// Der Button darf nirgends mehr existieren — weder in der Toolbar noch sonst im Dokument.
		await expect(toolbar.getByRole('button', { name: 'Serien verwalten' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Serien verwalten' })).toHaveCount(0);
	});

	/**
	 * AK6 (Ersatz) — Die Serien-Verwaltung ist stattdessen über einen eigenen Tab „Serien" erreichbar.
	 */
	test('AK6: Serien-Verwaltung ist über den eigenen Tab „Serien" erreichbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('tab', { name: 'Serien', exact: true })).toBeVisible();
	});
});
