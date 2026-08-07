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
		// Exact-Match nötig: /Aufgaben/i würde auch "Aufgabenwald" und "Erledigte Aufgaben" treffen.
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
		// Exact-Match nötig: /Aufgaben/i würde auch "Aufgabenwald" und "Erledigte Aufgaben" treffen.
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
// Rote Spec-Tests für #402 — Wort-Bildmarke im Header (AK2 + AK4)
// ---------------------------------------------------------------------------

test.describe('#402 Header – Wort-Bildmarke statt reinem Icon-Logo', () => {
	/**
	 * AK2 — Header zeigt die horizontale Wortmarke:
	 * Das img im Logo-Button verweist auf logo-with-name.horizontal.png.
	 */
	test('AK2: Logo-Button img src zeigt auf logo-with-name.horizontal.png', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		await expect(logoImg).toBeVisible();

		const src = await logoImg.getAttribute('src');
		expect(src, 'img src soll auf logo-with-name.horizontal.png enden').toMatch(/logo-with-name\.horizontal\.png$/);
	});

	/**
	 * AK4 — Mobile-First (375px): Die breitere Wortmarke überschreitet den 375px-Viewport nicht.
	 */
	test('AK4: Wortmarken-img überschreitet 375px-Viewport-Breite nicht', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		await expect(logoImg).toBeVisible();

		const box = await logoImg.boundingBox();
		expect(box, 'Wortmarken-img muss eine Boundingbox haben').not.toBeNull();
		expect(box!.width, `Wortmarken-img (${box!.width}px) darf 375px nicht überschreiten`).toBeLessThanOrEqual(375);
	});
});

// ---------------------------------------------------------------------------
// Rote Spec-Tests für #406 — Wort-Bild-Marke vergrößern + App-Namen-H1 entfernen
// ---------------------------------------------------------------------------

/**
 * ROTE Spec-Tests für #406 „Wort-Bild-Marke im Header vergrößern und Text-H1 entfernen".
 *
 * Ziel: Die redundante Text-H1 „Priority Pilot" verschwindet aus dem Header (der App-Name steckt
 * bereits in der Wort-Bild-Marke). Die Wort-Bild-Marke wächst mit dem Viewport (statt fixer 2.5rem).
 * Die semantische Ebene-1-Überschrift der Hauptansicht wird als visuell verborgene (sr-only) H1
 * „Dashboard" bereitgestellt, damit die Seite genau eine H1 behält.
 *
 * Diese Tests sind **rot**, bis App.tsx/CSS die Text-H1 entfernen, die sr-only „Dashboard"-H1
 * ergänzen und die Logo-Höhe responsiv machen.
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
	 * AK2 — Header ohne sichtbaren Text-H1: Logo-Button, Kopf-Toolbar und user-info bleiben sichtbar,
	 * aber die Text-H1 „Priority Pilot" ist nicht mehr sichtbar.
	 * RED, solange die H1 „Priority Pilot" sichtbar im Header steht.
	 */
	test('AK2: Header zeigt Logo-Button, Toolbar und user-info — kein sichtbarer Text-H1', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Logo-Button bleibt sichtbar.
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Kopf-Toolbar bleibt sichtbar.
		await expect(header.getByRole('toolbar', { name: /Kopf-Aktionen/i })).toBeVisible();

		// user-info (Avatar + Anzeigename) bleibt sichtbar.
		await expect(header.locator('.user-info').first()).toBeVisible();

		// Der redundante Text-H1 „Priority Pilot" darf nicht mehr sichtbar sein.
		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toHaveCount(0);
		await expect(page.getByText('Priority Pilot', { exact: true })).toBeHidden();
	});

	/**
	 * AK3 — Wort-Bild-Marke wächst mit dem Viewport: Die Logo-Höhe bei 1280px ist größer als bei
	 * 375px und größer als der bisherige Fixwert von 40px (2.5rem).
	 * RED, solange die CSS-Höhe fest auf 2.5rem (≈40px) steht.
	 */
	test('AK3: Logo-Höhe wächst mit dem Viewport und übersteigt den bisherigen Fixwert (40px)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const logoBtn = page.getByRole('banner').getByRole('button', { name: /Zum Dashboard/i });
		const boxWide = await logoBtn.locator('img').boundingBox();
		expect(boxWide, 'Logo-Bild muss bei 1280px eine Boundingbox haben').not.toBeNull();

		await page.setViewportSize({ width: 375, height: 812 });
		await page.reload();
		await waitForStableView(page);

		const boxNarrow = await logoBtn.locator('img').boundingBox();
		expect(boxNarrow, 'Logo-Bild muss bei 375px eine Boundingbox haben').not.toBeNull();

		expect(
			boxWide!.height,
			`Logo bei 1280px (${boxWide!.height}px) muss höher sein als bei 375px (${boxNarrow!.height}px)`,
		).toBeGreaterThan(boxNarrow!.height);
		expect(
			boxWide!.height,
			`Logo bei 1280px (${boxWide!.height}px) muss den bisherigen Fixwert von 40px übersteigen`,
		).toBeGreaterThan(40);
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

	/**
	 * AK5 — Mobile-First (375px): Bei 375px-Viewport bleibt das Logo sichtbar und es entsteht kein
	 * horizontaler Overflow.
	 */
	test('AK5: Logo sichtbar und kein horizontaler Overflow bei 375px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const logoBtn = page.getByRole('banner').getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Rote Spec-Tests für #485 — Header-Optimierung: Icon-Only-Logo, kleinerer
// Avatar, alles auf eine Ebene
// ---------------------------------------------------------------------------

/**
 * ROTE Spec-Tests für #485 „Header-Optimierung: Icon-Only-Logo, kleinerer Avatar, alles auf eine
 * Ebene".
 *
 * Der sichtbare Schriftzug verschwindet aus dem Logo — stattdessen wird ausschließlich das reine
 * Icon (`logo.png`) gezeigt, und der Markenname „Priority Pilot" steht nur noch als Accessible Name
 * (aria-label) am Logo-Button für Screenreader bereit (kein sichtbarer Text).
 *
 * Diese Tests sind **rot**, bis `App.tsx` die Logo-Quelle auf das reine Icon umstellt und den
 * Markennamen in den Accessible Name des Buttons aufnimmt (statt nur „Zum Dashboard").
 *
 * Abdeckung der Akzeptanzkriterien (siehe Issue-Body):
 * - AK1 (Logo nur als Icon) → hier, E2E.
 * - AK2 (Markenname nur über aria-label) → hier, E2E.
 * - AK3 (Avatar verkleinert) → reines Styling; Zielwert „1,25 der Toolbar" ist mehrdeutig (siehe
 *   Issue-Body ❓ Offene Frage 1) und damit nicht scharf automatisierbar → visuelle Verifikation.
 * - AK4 (Alles auf einer Ebene) → reines vertikales Layout-Alignment → visuelle Verifikation.
 * - AK5 (Mobile-First 375 px, kein Overflow) → bereits abgedeckt durch #395 AK5 und #406 AK5 (je
 *   „kein horizontaler Overflow bei 375 px"); nicht dupliziert.
 *
 * Bewusst werden Logo-Button und -img über die stabile Klasse `.logo-btn` (statt über den
 * Accessible Name) lokalisiert: So bleiben die Tests unabhängig davon, wie ❓ Offene Frage 2
 * („Zum Dashboard" beibehalten vs. durch „Priority Pilot" ersetzt) gelöst wird.
 */
test.describe('#485 Header – Icon-Only-Logo', () => {
	/**
	 * AK1 — Logo nur als Icon: Das img des Logo-Buttons referenziert das reine Icon-Asset und NICHT
	 * die Wortmarke (`logo-with-name`). Damit ist kein sichtbarer Schriftzug „Priority Pilot" mehr
	 * Teil des Logos. RED, solange die src noch auf `logo-with-name.horizontal.png` zeigt.
	 */
	test('AK1: Logo-img referenziert das reine Icon (kein logo-with-name)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const logoBtn = page.getByRole('banner').locator('.logo-btn');
		const logoImg = logoBtn.locator('img');
		await expect(logoImg).toBeVisible();

		const src = await logoImg.getAttribute('src');
		expect(src, 'Logo-img muss eine src besitzen').not.toBeNull();
		expect(src, 'Logo darf nicht die Wortmarke (logo-with-name) referenzieren').not.toMatch(/logo-with-name/);
		expect(src, 'Logo soll das reine Icon (logo.png) referenzieren').toMatch(/logo\.png$/);
	});

	/**
	 * AK2 — Markenname nur über aria-label: Der Logo-Button trägt „Priority Pilot" als Teil seines
	 * Accessible Name, damit Screenreader den Markennamen ansagen — auch ohne sichtbaren Schriftzug.
	 * RED, solange der Accessible Name nur „Zum Dashboard" lautet (aktuell überdeckt das funktionale
	 * `aria-label="Zum Dashboard"` das `img`-alt, sodass der Markenname gar nicht angesagt wird).
	 *
	 * Hinweis: Ob „Priority Pilot" zusätzlich zu oder anstelle von „Zum Dashboard" steht, ist im
	 * Issue-Body (❓ Offene Frage 2) offen; dieser Test verlangt nur, dass der Markenname enthalten ist.
	 */
	test('AK2: Logo-Button Accessible Name enthält „Priority Pilot"', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const logoBtn = page.getByRole('banner').locator('.logo-btn');

		await expect(logoBtn).toBeVisible();
		await expect(logoBtn).toHaveAccessibleName(/Priority Pilot/i);
	});
});
