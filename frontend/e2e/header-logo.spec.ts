import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #395 „Klickbare Bild-Marke im Header (Link zum Dashboard)"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Im Header erscheint links oben ein Logo-Bild als barrierefreier Button „Zum Dashboard".
 * Ein Klick darauf aktiviert den Dashboard-Tab (Index 0). Die bestehende H1 „Priority Pilot" bleibt
 * erhalten. Auf 375px-Viewport kein horizontaler Overflow.
 *
 * Diese Tests sind **rot**, bis App.tsx das Logo ergänzt und die KolTabs kontrolliert macht
 * (`_selected={activeTab}`). Sie prüfen reines UI-Verhalten gegen das echte Backend.
 */
test.describe('#395 Header – Logo-Button', () => {
	/**
	 * AK1 — Logo sichtbar, links oben: Im Header-Banner ist ein Button „Zum Dashboard"
	 * mit Logo-Bild sichtbar.
	 */
	test('AK1: Logo-Button ist im Header sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Der Logo-Button muss im Header vorhanden und sichtbar sein.
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Das Logo-Bild ist ein Kind des Buttons.
		const logoImg = logoBtn.locator('img');
		await expect(logoImg).toBeVisible();
	});

	/**
	 * AK2 — Klick führt zum Dashboard: Beim Klick auf den Logo-Button wird der Dashboard-Tab
	 * (Index 0) aktiviert und der Dashboard-Inhalt sichtbar.
	 */
	test('AK2: Logo-Klick aktiviert den Dashboard-Tab', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Zuerst einen anderen Tab wählen (Aufgaben, Index 1), um die Umschaltung zu prüfen.
		// Exact-Match nötig: /Aufgaben/i würde auch "Erledigte Aufgaben" treffen.
		const aufgabenTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await aufgabenTab.click();
		await expect(aufgabenTab).toHaveAttribute('aria-selected', 'true');

		// Logo-Button klicken.
		const header = page.getByRole('banner');
		await header.getByRole('button', { name: /Zum Dashboard/i }).click();

		// Dashboard-Tab muss aktiv sein.
		const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
		await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK3 — Barrierefrei bedienbar: Der Logo-Button ist fokussierbar und hat einen sprechenden
	 * Accessible Name. Er ist per Enter/Space-Taste auslösbar.
	 */
	test('AK3: Logo-Button ist barrierefrei bedienbar (Accessible Name + Tastatur)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });

		// Accessible Name vorhanden.
		await expect(logoBtn).toBeVisible();
		await expect(logoBtn).toHaveAccessibleName(/Zum Dashboard/i);

		// Tastatur: Tab bis zum Logo-Button und Enter drücken.
		// Zuerst anderen Tab wählen, damit der Klick merklich umschaltet.
		// Exact-Match nötig: /Aufgaben/i würde auch "Erledigte Aufgaben" treffen.
		const aufgabenTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await aufgabenTab.click();

		await logoBtn.focus();
		await expect(logoBtn).toBeFocused();
		await page.keyboard.press('Enter');

		// Dashboard-Tab ist nach Tastatureingabe aktiv.
		const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
		await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK4 — App-Namen-H1 entfernt, Seiten-H1 „Dashboard" vorhanden (invertiert durch #406):
	 * „Priority Pilot" als Level-1-Überschrift ist nicht mehr im Dokument;
	 * stattdessen existiert genau eine visually-hidden H1 „Dashboard".
	 */
	test('AK4: H1 „Priority Pilot" entfernt — Seiten-H1 „Dashboard" vorhanden', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(1);
	});

	/**
	 * AK5 — Mobile-First (375px): Bei 375px-Viewport ist das Logo sichtbar und es entsteht
	 * kein horizontales Scrollen.
	 */
	test('AK5: Logo sichtbar und kein horizontaler Overflow bei 375px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Kein horizontaler Overflow.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Rote Spec-Tests für #406 — Wort-Bild-Marke vergrößern + App-Namen-H1 entfernen
// ---------------------------------------------------------------------------

/**
 * ROTE Spec-Tests für #406 „Wort-Bild-Marke im Header vergrößern und Text-H1 entfernen".
 *
 * Ziel: Die redundante Text-H1 „Priority Pilot" verschwindet aus dem Header (der App-Name steckt
 * bereits in der Wort-Bild-Marke). Die semantische Ebene-1-Überschrift der Hauptansicht wird als
 * visuell verborgene (sr-only) H1 „Dashboard" bereitgestellt, damit die Seite genau eine H1 behält.
 *
 * Diese Tests sind **rot**, bis App.tsx/CSS die Text-H1 entfernen und die sr-only „Dashboard"-H1
 * ergänzen.
 */
test.describe('#406 Wort-Bild-Marke vergrößern + App-Namen-H1 entfernen', () => {
	/**
	 * AK1 — Keine App-Namen-H1 mehr: Es existiert keine Ebene-1-Überschrift „Priority Pilot".
	 * RED, solange die KolHeading _level={1} „Priority Pilot" im Header gerendert wird (count=1).
	 */
	test('AK1: Keine H1 „Priority Pilot" mehr im Dokument', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toHaveCount(0);
	});

	/**
	 * AK2 — Header ohne sichtbaren Text-H1: Logo-Button, Kopf-Toolbar und Avatar bleiben sichtbar,
	 * aber die Text-H1 „Priority Pilot" ist nicht mehr sichtbar.
	 */
	test('AK2: Header zeigt Logo-Button, Toolbar und Avatar — kein sichtbarer Text-H1', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Logo-Button bleibt sichtbar.
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Kopf-Toolbar bleibt sichtbar.
		await expect(header.getByRole('toolbar', { name: /Kopf-Aktionen/i })).toBeVisible();

		// Avatar bleibt sichtbar.
		await expect(header.locator('kol-avatar').first()).toBeVisible();

		// Der redundante Text-H1 „Priority Pilot" darf nicht mehr sichtbar sein.
		//
		// Geprüft wird die *Überschrift* — das ist die Aussage von #406. Der App-Name als solcher steht
		// seit #787 wieder als schlichtes Label im Header (`.app-name`, ab 64rem sichtbar): Seit #485
		// ist das Logo icon-only und trägt die Wortmarke nicht mehr, der Name ist damit nicht länger
		// redundant. Eine zweite H1 entsteht dabei nicht.
		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Priority Pilot' })).toHaveCount(0);
	});

	/**
	 * AK4 — Genau eine sr-only H1 „Dashboard": Die Hauptansicht behält eine einzige Ebene-1-Überschrift
	 * „Dashboard" (visuell verborgen, aber semantisch vorhanden).
	 * RED, solange keine „Dashboard"-H1 existiert (count=0).
	 */
	test('AK4: Genau eine H1 „Dashboard" in der Hauptansicht', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(1);
	});
});

// ---------------------------------------------------------------------------
// Rote Spec-Tests für #485 — Icon-Only-Logo im Header
// ---------------------------------------------------------------------------

/**
 * ROTE Spec-Tests für #485 „Header-Optimierung: Icon-Only-Logo, kleinerer Avatar, alles auf eine
 * Ebene" — Teil Logo (AK1).
 *
 * Ziel: Der Schriftzug verschwindet aus dem Header-Logo; dargestellt wird nur noch das reine
 * Icon-Asset `/logo/logo.png` (bereits in `frontend/public/logo/` vorhanden). Die Funktion des
 * Logo-Buttons (Accessible Name „Zum Dashboard", Klick → Dashboard) bleibt unverändert und ist
 * bereits durch die #395-Tests oben abgedeckt (AK2 des Tickets, kein neuer Test nötig).
 *
 * Dieser Test ist **rot**, solange `App.tsx` `/logo/logo-with-name.horizontal.png` referenziert.
 */
test.describe('#485 Header – Icon-Only-Logo', () => {
	/**
	 * AK1 — Logo nur als Icon: Das img im Logo-Button referenziert das reine Icon-Asset
	 * `/logo/logo.png` und kein `logo-with-name`-Asset.
	 */
	test('AK1: Logo-Button img src zeigt auf das Icon-Asset /logo/logo.png', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		await expect(logoImg).toBeVisible();

		const src = await logoImg.getAttribute('src');
		expect(src, 'img src darf keine Wortmarke (logo-with-name) mehr referenzieren').not.toMatch(/logo-with-name/);
		expect(src, 'img src soll auf das reine Icon-Asset logo.png enden').toMatch(/\/logo\/logo\.png$/);
	});

	/**
	 * AK1 (Ergänzung) — Das Asset wird auch tatsächlich ausgeliefert (kein 404) und ist ein
	 * annähernd quadratisches Icon: das Seitenverhältnis des geladenen Bildes bleibt unter 1,5.
	 * Das reine Icon (`logo.png`, 1698×1659 ≈ 1,02) erfüllt das, die horizontale Wortmarke
	 * (2116×412 ≈ 5,1) nicht. Schützt davor, dass der Schriftzug über ein anderes Asset zurückkehrt.
	 */
	test('AK1: Geladenes Logo-Bild ist ein Icon (Seitenverhältnis < 1,5) und lädt fehlerfrei', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const logoImg = page
			.getByRole('banner')
			.getByRole('button', { name: /Zum Dashboard/i })
			.locator('img');
		await expect(logoImg).toBeVisible();

		const natural = await logoImg.evaluate((el) => {
			const img = el as HTMLImageElement;
			return { width: img.naturalWidth, height: img.naturalHeight };
		});

		expect(natural.width, 'Logo-Bild muss geladen sein (naturalWidth > 0)').toBeGreaterThan(0);
		expect(natural.height, 'Logo-Bild muss geladen sein (naturalHeight > 0)').toBeGreaterThan(0);
		expect(
			natural.width / natural.height,
			`Icon-Logo (${natural.width}×${natural.height}) muss annähernd quadratisch sein — sonst steckt noch ein Schriftzug drin`,
		).toBeLessThan(1.5);
	});
});
