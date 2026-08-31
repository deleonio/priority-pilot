import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #271 „Settings-Seite: Tabs Allgemein + Säulen" (Stufe 1 TDD, der einklagbare
 * Vertrag).
 *
 * Ziel des Tickets: Die Settings-Seite (aus #270, `/settings/pillars`) bekommt eine `KolTabs`-
 * Navigation mit zwei Tabs — **Allgemein** (vorerst leerer Platzhalter) und **Säulen** (hostet den
 * Säulen-Gewichtungs-Editor). Routing: `/settings/pillars` → Säulen-Tab aktiv,
 * `/settings/general` → Allgemein-Tab aktiv.
 *
 * Diese Tests sind bewusst **rot**, bis der Produktivcode existiert: `SettingsPage.tsx` mit `KolTabs`
 * fehlt noch, ebenso die Route `/settings/general`. Die Tests navigieren direkt per `page.goto()`,
 * weil die Zahnrad-Navigation (#270) unabhängig davon bereits existiert.
 *
 * Sie prüfen reines UI-Verhalten gegen das echte Backend (kein API-Mock); `/auth/me` wird durch die
 * Fixture authentifiziert, damit die Auth-Gate durchlässig ist.
 */
test.describe('#271 Settings-Seite: Tabs Allgemein + Säulen', () => {
	/**
	 * AK1 — Tabs vorhanden: Auf der Settings-Seite sind zwei Tabs sichtbar — „Allgemein" und
	 * „Säulen". KolTabs rendert Tabs mit role="tab" in einer role="tablist".
	 */
	test('AK1: Settings-Seite zeigt zwei Tabs „Allgemein" und „Säulen"', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();
	});

	/**
	 * AK2 — Säulen-Tab zeigt Editor: Wenn der Säulen-Tab aktiv ist (Default auf
	 * `/settings/pillars`), wird der Säulen-Gewichtungs-Editor angezeigt. Der Editor enthält
	 * Eingabefelder für die Säulen-Gewichtungen (wie bisher via #270 bekannt).
	 */
	test('AK2: Säulen-Tab zeigt den Säulen-Gewichtungs-Editor', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Der Säulen-Tab ist aktiv — der Editor ist sichtbar.
		const pillarsTab = page.getByRole('tab', { name: 'Säulen', exact: true });
		await expect(pillarsTab).toHaveAttribute('aria-selected', 'true');

		// Der Editor enthält mindestens ein Eingabefeld für Säulen-Gewichtungen (range/number).
		await expect(page.getByRole('slider').or(page.getByRole('spinbutton')).first()).toBeVisible();
	});

	/**
	 * AK3 — Tab-Wechsel: Wenn der Säulen-Tab aktiv ist und auf „Allgemein" geklickt wird,
	 * wechselt die Anzeige zum Allgemein-Tab (Platzhalter sichtbar), der Säulen-Editor
	 * verschwindet.
	 */
	test('AK3: Klick auf „Allgemein"-Tab blendet Säulen-Editor aus und zeigt Allgemein-Inhalt', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Ausgangszustand: Säulen-Tab aktiv, Editor sichtbar.
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Klick auf „Allgemein".
		await page.getByRole('tab', { name: 'Allgemein', exact: true }).click();

		// Allgemein-Tab ist jetzt aktiv.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Der Allgemein-Tabpanel ist sichtbar (Platzhalter).
		await expect(page.getByRole('tabpanel')).toBeVisible();

		// Der Säulen-Editor ist nicht mehr sichtbar (ausgeblendet oder aus DOM entfernt).
		// Seit #1098 zeigt der Allgemein-Tab eigene Range-Regler (Geo-Einstellungen) — eine
		// page-weite Slider-Suche trifft diese. Der Editor wird über seine Überschrift geprüft
		// (gleiches Panel, Muster wie crud.spec.ts „Säulen-Gewicht ändern").
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden();
	});

	/**
	 * AK4 — Route ↔ Tab: Die URL bestimmt den aktiven Tab beim initialen Laden.
	 * `/settings/general` aktiviert den Allgemein-Tab; `/settings/pillars` aktiviert den Säulen-Tab.
	 */
	test('AK4a: Route /settings/general aktiviert den Allgemein-Tab', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	test('AK4b: Route /settings/pillars aktiviert den Säulen-Tab', async ({ page }) => {
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	/**
	 * AK5 — Mobile-First (375px): Auf einem 375px-Viewport verursacht die Settings-Seite
	 * mit Tabs kein horizontales Scrollen; beide Tabs sind sichtbar und bedienbar.
	 * Muster: login.spec.ts AK5.
	 */
	test('AK5: Settings-Tabs verursachen kein horizontales Scrollen bei 375px (Mobile-First)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Beide Tabs müssen auf dem schmalen Viewport sichtbar und bedienbar sein.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Kein horizontaler Überlauf: Das Settings-Root-Element ragt nicht über die Viewport-Breite.
		const overflowsHorizontally = await page.evaluate(() => {
			// Prüfe das body-Element und document.documentElement auf horizontalen Überlauf.
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});

/**
 * ROTE Spec-Tests für #323 „Settings-Tab springt nach Toggle-Interaktion zurück auf Säulen".
 *
 * Bug: Auf dem „Allgemein"-Tab führt das Umschalten des „Sprachaufnahme automatisch starten"-
 * Schalters zu einem Re-Render, bei dem `_selected={activeTab}` (Säulen) erneut kontrolliert an
 * `KolTabs` durchgereicht wird — der View springt zurück auf den Säulen-Tab.
 *
 * Ursache (KI-Analyse): `SettingsPage.tsx:28` nutzt `const [activeTab] = useState(...)` ohne Setter;
 * der Tab-State wird nie aktualisiert. `_selected` ist ein kontrolliertes Prop und überschreibt bei
 * jedem Render den vom Nutzer gewählten Tab.
 *
 * AK1/AK2 sind bewusst **rot**, bis der Bug behoben ist. AK3 validiert (grün), dass die Gegenrichtung
 * keine Regression bekommt.
 */
const buildMediaMock = (mediaPermission: 'granted' | 'denied'): string => `
	(() => {
		window.__getUserMediaCalled = false;
		if (!navigator.mediaDevices) {
			Object.defineProperty(navigator, 'mediaDevices', { value: {}, writable: true, configurable: true });
		}
		navigator.mediaDevices.getUserMedia = async () => {
			window.__getUserMediaCalled = true;
			if ('${mediaPermission}' === 'granted') {
				return { getTracks: () => [], getAudioTracks: () => [] };
			} else {
				throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
			}
		};
	})();
`;

test.describe('#323 Settings-Tab bleibt nach Toggle-Interaktion stabil', () => {
	test('AK1: Toggle mit erteilter Berechtigung springt nicht auf Säulen-Tab zurück', async ({ page }) => {
		// AK1 — Kernfall: Berechtigung erteilt, „Allgemein" bleibt aktiv, Säulen-Editor bleibt verborgen.
		await page.addInitScript(buildMediaMock('granted'));
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const allgemeinTab = page.getByRole('tab', { name: 'Allgemein', exact: true });
		await allgemeinTab.click();
		await waitForStableView(page, 'Priority Pilot');
		await expect(allgemeinTab).toHaveAttribute('aria-selected', 'true');

		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));
		await toggle.click();
		await waitForStableView(page, 'Priority Pilot');

		await expect(allgemeinTab).toHaveAttribute('aria-selected', 'true');
		// Säulen-Editor bleibt verborgen — Überschrift statt page-weiter Slider-Suche, seit #1098
		// zeigt der Allgemein-Tab eigene Range-Regler (Geo-Einstellungen), siehe AK3 oben.
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden();
	});

	test('AK2: Toggle mit verweigerter Berechtigung springt nicht auf Säulen-Tab zurück', async ({ page }) => {
		// AK2 — Berechtigung verweigert: „Allgemein" bleibt aktiv (Hinweis erscheint, kein Tab-Wechsel).
		await page.addInitScript(buildMediaMock('denied'));
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const allgemeinTab = page.getByRole('tab', { name: 'Allgemein', exact: true });
		await allgemeinTab.click();
		await waitForStableView(page, 'Priority Pilot');
		await expect(allgemeinTab).toHaveAttribute('aria-selected', 'true');

		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));
		await toggle.click();
		await waitForStableView(page, 'Priority Pilot');

		await expect(allgemeinTab).toHaveAttribute('aria-selected', 'true');
	});

	test('AK3: Interaktion im Säulen-Tab springt nicht auf Allgemein-Tab zurück', async ({ page }) => {
		// AK3 — Gegenrichtung (keine Regression): Säulen-Gewicht ändern, „Säulen" bleibt aktiv.
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		const pillarsTab = page.getByRole('tab', { name: 'Säulen', exact: true });
		await expect(pillarsTab).toHaveAttribute('aria-selected', 'true');

		const control = page.getByRole('slider').or(page.getByRole('spinbutton')).first();
		await control.focus();
		await control.press('ArrowRight');
		await waitForStableView(page, 'Priority Pilot');

		await expect(pillarsTab).toHaveAttribute('aria-selected', 'true');
	});
});

/**
 * ROTE Spec-Tests für #1151 „Eigener Settings-Tab ‚Standort'" (Spec: docs/spec/issue-1151.md).
 *
 * Der komplette Geo-Block wandert aus dem Tab „Allgemein" in einen neuen vierten Tab
 * „Standort" (Index 3, Route `/settings/standort`). Diese Tests sind rot, bis
 * `SETTINGS_TABS`/`SETTINGS_PATH_SEGMENTS` erweitert sind und der Geo-Block im neuen Slot lebt.
 */
const geoSwitch = (page: Page) =>
	page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));

const GEO_SLIDER_LABELS = ['Anzeige-Entfernung (km)', 'Alarm-Entfernung (km)', 'Aktualisierungsintervall (Minuten)'];

test.describe('#1151 Eigener Settings-Tab „Standort"', () => {
	/**
	 * AK1 — Vierter Tab vorhanden und per Route wählbar: Direktaufruf `/settings/standort`
	 * aktiviert den Tab „Standort"; alle vier Tabs sind in der Tablist vorhanden.
	 */
	test('AK1: /settings/standort zeigt vier Tabs und aktiviert „Standort"', async ({ page }) => {
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Priority Pilot');

		for (const label of ['Allgemein', 'Säulen', 'KI-Provider', 'Standort']) {
			await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
		}
		await expect(page.getByRole('tab', { name: 'Standort', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'false');
	});

	/**
	 * AK2 — Geo-Settings nur im Standort-Tab: `/settings/standort` zeigt den
	 * „Standort erfassen"-Schalter und die drei Slider; auf `/settings/general` ist kein
	 * Geo-Element mehr sichtbar.
	 */
	test('AK2: Geo-Switch und Slider im Standort-Tab sichtbar, im Allgemein-Tab nicht mehr', async ({ page }) => {
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Priority Pilot');
		await expect(geoSwitch(page)).toBeVisible();
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');
		await expect(geoSwitch(page)).toBeHidden();
		for (const label of GEO_SLIDER_LABELS) {
			await expect(page.locator(`kol-input-range[_label="${label}"]`)).toBeHidden();
		}
	});

	/**
	 * AK2/AK3 — Funktional im neuen Tab: Mit eingeschaltetem Standort sind die drei Slider im
	 * Standort-Tab sichtbar und bedienbar (bestehende #1098-Abläufe laufen dort weiter).
	 */
	test('AK2/AK3: bei eingeschaltetem Standort sind die drei Slider im Standort-Tab bedienbar', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'geolocation', {
				value: {
					getCurrentPosition: (success: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
						success({ coords: { latitude: 52.52, longitude: 13.41 } }),
					watchPosition: () => 1,
					clearWatch: () => {},
				},
				writable: true,
			});
			localStorage.setItem('pp-geolocation-enabled', 'true');
		});
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Priority Pilot');

		await expect(geoSwitch(page)).toBeVisible();
		for (const label of GEO_SLIDER_LABELS) {
			await expect(page.locator(`kol-input-range[_label="${label}"]`)).toBeVisible();
		}
	});

	/**
	 * AK4 — URL bleibt die Quelle: Tab-Klick auf „Standort" schreibt `/settings/standort`,
	 * Klick zurück auf „Allgemein" `/settings/general`; Browsers-Zurückkehren stellt den
	 * Standort-Tab wieder her.
	 */
	test('AK4: Tab-Klick aktualisiert die URL, Zurückkehren stellt den Standort-Tab wieder her', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('tab', { name: 'Standort', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/standort$/);
		await expect(page.getByRole('tab', { name: 'Standort', exact: true })).toHaveAttribute('aria-selected', 'true');

		await page.getByRole('tab', { name: 'KI-Provider', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/llm$/);

		await page.getByRole('tab', { name: 'Allgemein', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/general$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/settings\/llm$/);
		await expect(page.getByRole('tab', { name: 'KI-Provider', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK4 — Fallback unverändert: Ein unbekanntes URL-Segment fällt weiterhin auf den
	 * Säulen-Tab (Index 1) zurück.
	 */
	test('AK4: unbekanntes Segment /settings/xyz fällt auf den Säulen-Tab zurück', async ({ page }) => {
		await page.goto('/settings/xyz');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
	});

	/**
	 * AK5 — Mobile-First (375px): Alle vier Tab-Targets und die drei Geo-Slider liegen
	 * vollständig im Viewport (Bounding-Box statt scrollWidth — die App-Shell clippt
	 * `overflow-x`, Memory 2026-08-24).
	 */
	test('AK5: 375px — vier Tabs und Geo-Slider ohne horizontale Überlagerung', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'geolocation', {
				value: {
					getCurrentPosition: (success: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
						success({ coords: { latitude: 52.52, longitude: 13.41 } }),
					watchPosition: () => 1,
					clearWatch: () => {},
				},
				writable: true,
			});
			localStorage.setItem('pp-geolocation-enabled', 'true');
		});
		await page.goto('/settings/standort');
		await waitForStableView(page, 'Priority Pilot');

		for (const label of ['Allgemein', 'Säulen', 'KI-Provider', 'Standort']) {
			const box = await page.getByRole('tab', { name: label, exact: true }).boundingBox();
			expect(box, `Tab „${label}" rendert messbar`).not.toBeNull();
			expect(box!.x, `Tab „${label}" beginnt im Viewport`).toBeGreaterThanOrEqual(-1);
			expect(box!.x + box!.width, `Tab „${label}" endet im Viewport`).toBeLessThanOrEqual(375 + 1);
		}
		for (const label of GEO_SLIDER_LABELS) {
			const box = await page.locator(`kol-input-range[_label="${label}"]`).boundingBox();
			expect(box, `Slider „${label}" rendert messbar`).not.toBeNull();
			expect(box!.x, `Slider „${label}" beginnt im Viewport`).toBeGreaterThanOrEqual(-1);
			expect(box!.x + box!.width, `Slider „${label}" endet im Viewport`).toBeLessThanOrEqual(375 + 1);
		}
	});
});
