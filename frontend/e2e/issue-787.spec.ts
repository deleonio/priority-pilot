import type { Locator, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Wartet zusätzlich zu `waitForStableView` auf den *ausgelayouteten* Header.
 *
 * `waitForStableView` garantiert nur, dass die Custom-Elements registriert sind — `kol-toolbar`
 * baut ihre Buttons danach noch im eigenen Shadow-DOM auf und misst in diesem Fenster 0×0 px.
 * Wer davor misst, misst den Pre-Layout-Zustand (Header einzeilig) und vergleicht ihn später mit
 * dem echten Layout: ein Test-Artefakt, kein Layout-Shift der Anwendung. Der Button-Name ist seit
 * #965 statisch (icon-only) — ein Config-abhängiges Abwarten entfällt.
 * Gewartet wird über die öffentliche Schnittstelle (Rolle/Name) — kein Shadow-DOM-Piercing.
 */
const waitForSettledHeader = async (page: Page): Promise<void> => {
	await waitForStableView(page);
	await expect(page.getByRole('button', { name: 'KI-Modell auswählen' })).toBeVisible();
};

/**
 * Deterministische Free-Modell-Liste für den Dialog (Muster aus `free-models-selection.spec.ts`):
 * Ohne Mock ginge `GET /models/free` gegen den echten OpenRouter-Proxy des Servers, der in der
 * E2E-Umgebung ohne API-Key läuft — die Liste wäre nichtdeterministisch bis leer.
 */
const mockFreeModels = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/models/free', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				models: [
					{ id: 'openrouter/free', name: 'OpenRouter Free' },
					{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)' },
					{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)' },
				],
			}),
		}),
	);
};

/**
 * Einstieg in die Modell-Auswahl (#787 Journey 2/3): Der Toolbar-Button (seit #965 icon-only mit
 * statischem Accessible Name „KI-Modell auswählen") öffnet denselben `ModelSelectionDialog`, den
 * früher der Dashboard-Button aus #742 öffnete — jener wurde mit 8a7d182 bewusst entfernt.
 *
 * Menschen-Entscheidung zu #929: Der frühere role="combobox"-Vertrag (aria-haspopup,
 * aria-expanded, Chevron) ist aufgehoben — `kol-toolbar` verwirft ARIA-Attribute an Items still,
 * und KoliBri liefert die vollständige Button-Semantik im Shadow-DOM selbst. Getestet wird der
 * native Button (Rolle, Name, Klick/Escape), keine hinzgefakten Combobox-Attribute. Seit #965
 * wird der Button auf allen Breiten gerendert (Mobile-Ausblendung rückgebaut, siehe AK2
 * Responsive).
 */
const modelSelectionEntryPoint = (page: Page): Locator => page.getByRole('button', { name: 'KI-Modell auswählen' });

/** Öffnet die Modell-Auswahl über den Toolbar-Button und wartet auf den geöffneten Dialog. */
const openModelSelection = async (page: Page): Promise<void> => {
	await modelSelectionEntryPoint(page).click();
	await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();
};

/**
 * Spec-Tests für #787 "Header-Layout und KI-Modell-Auswahl in Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Header-Layout folgt der Reihenfolge Logo → Name → Toolbar → Avatar (#912) und die
 * KI-Modell-Auswahl ist harmonisch in die Toolbar integriert.
 *
 * Spezifikation: docs/spec/issue-787.md
 */
test.describe('#787 Header-Layout und KI-Modell-Auswahl in Toolbar', () => {
	/**
	 * Journey 1: Header-Layout auf Desktop
	 * Spec-Bezug: docs/spec/issue-787.md Journey 1 (v1.2, korrigiert durch #912)
	 * AK1 (#912): Der Avatar ist das letzte Element ganz rechts im Header — nach Wortmarke,
	 * KI-Modellauswahl und Kopf-Aktionen.
	 *
	 * Test-Pflege (#912): Diese Order-Assertion prüfte bis v1.1 Avatar < Toolbar (Avatar
	 * links-mittig direkt neben der Wortmarke). Das widerspricht dem neuen AK1 aus #912 — die
	 * Assertion wurde auf Toolbar < Avatar gedreht, Testname/Ort blieben erhalten.
	 * Test-Pflege (Semantic-Groups-Refactor): Seit der Header in Brand|Primary|User-Container
	 * zerlegt ist, sind Logo+Name bzw. Toolbar+Modellauswahl keine direkten Header-Kinder mehr —
	 * ein Kind-Index-Vergleich scheitert grundsätzlich (Avatar-Index = −1). Geprüft wird deshalb
	 * die *visuelle* Links-nach-rechts-Ordnung (x-Positionen), die der eigentliche Layout-Vertrag
	 * ist — unabhängig von der Container-Verschachtelung.
	 */
	test('AK1: Header-Layout folgt der Reihenfolge Logo → Name → Toolbar → Avatar (Desktop)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Alle relevanten Elemente identifizieren — über *semantische* Merkmale (Button mit
		// Logo-Label, Text „Priority Pilot", `role="toolbar"`, `kol-avatar`), nicht über CSS-Klassen,
		// damit der Vertrag ein Layout-Vertrag bleibt und kein Klassennamen-Vertrag.
		const logo = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const name = header.getByText('Priority Pilot', { exact: true });
		const avatar = header.locator('kol-avatar').first();
		const toolbar = header.getByRole('toolbar', { name: /Kopf-Aktionen/i });

		// Alle Elemente müssen sichtbar sein
		await expect(logo).toBeVisible();
		await expect(name).toBeVisible();
		await expect(avatar).toBeVisible();
		await expect(toolbar).toBeVisible();

		// Reihenfolge validieren (visuell, einzeiliger Header): Logo < Name < Toolbar < Avatar.
		const logoBox = (await logo.boundingBox())!;
		const nameBox = (await name.boundingBox())!;
		const toolbarBox = (await toolbar.boundingBox())!;
		const avatarBox = (await avatar.boundingBox())!;

		expect(logoBox.x, 'Logo muss vor App-Name erscheinen').toBeLessThan(nameBox.x);
		expect(nameBox.x, 'App-Name muss vor Toolbar erscheinen').toBeLessThan(toolbarBox.x);
		expect(
			toolbarBox.x + toolbarBox.width,
			'Toolbar muss vor Avatar erscheinen — Avatar ist das letzte Element ganz rechts (#912)',
		).toBeLessThanOrEqual(avatarBox.x);
	});

	/**
	 * Journey 1: Header-Layout auf Desktop
	 * Spec-Bezug: docs/spec/issue-787.md Journey 1
	 * AK2: KI-Modell-Auswahl ist als Toolbar-Element integriert (nicht separat angehängt)
	 */
	test('AK2: KI-Modell-Auswahl ist visuell Teil der Toolbar (gemeinsamer Style/Container)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/i });
		await expect(toolbar).toBeVisible();

		const modelButton = modelSelectionEntryPoint(page);
		await expect(modelButton).toBeVisible();
		const buttonBox = await modelButton.boundingBox();
		const toolbarBox = await toolbar.boundingBox();
		expect(buttonBox, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();
		expect(toolbarBox, 'Toolbar muss eine Boundingbox haben').not.toBeNull();

		const buttonCenter = buttonBox!.y + buttonBox!.height / 2;
		const toolbarCenter = toolbarBox!.y + toolbarBox!.height / 2;
		expect(
			Math.abs(buttonCenter - toolbarCenter),
			'KI-Modell-Auswahl muss auf derselben Höhe wie die Toolbar-Buttons ausgerichtet sein',
		).toBeLessThanOrEqual(2);

		// Test-Pflege (#965, AK1/AK2): Bis #965 benannte das sichtbare Klartext-Label das konfigurierte
		// Modell (Referenz API). Der Button ist seit #965 icon-only mit statischem Namen — der
		// Modellname darf im Button NICHT mehr auftauchen; wo er steht, prüft issue-965.spec.ts AK1
		// (Spiegel gegen `GET /llm-config`). Hier nur noch der Negativ-Vertrag ohne API-Abhängigkeit:
		const buttonName = await modelButton.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');
		expect(buttonName, 'Button darf kein „KI-Modell:“-Klartext-Präfix mehr tragen').not.toMatch(/KI-Modell\s*:|Laden/i);
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK1: Click-Target der KI-Modell-Auswahl: Mindestens 44×44px (BITV 2.1)
	 */
	test('AK1 (KI-Modell-Auswahl): Click-Target mindestens 44×44px (BITV 2.1)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelButton = modelSelectionEntryPoint(page);
		await expect(modelButton).toBeVisible();

		const box = await modelButton.boundingBox();
		expect(box, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();

		const { width, height } = box!;
		expect(width, `Click-Target Breite (${width}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
		expect(height, `Click-Target Höhe (${height}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK2: Tastatur bedient den Button (Fokus setzt, Klick via Tastatur öffnet den Dialog).
	 * Focus-Optik trägt KoliBri (Menschen-Entscheidung zu #929) — geprüft wird nur, dass der
	 * Button fokussierbar ist und per Tastatur auslöst.
	 */
	test('AK2 (KI-Modell-Auswahl): Button ist per Tastatur bedienbar', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelButton = modelSelectionEntryPoint(page);
		await expect(modelButton).toBeVisible();

		await modelButton.focus();
		await expect(modelButton).toBeFocused();

		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2 (v1.3, Menschen-Entscheidung zu #929)
	 * AK4: Button öffnet den Modal-Dialog und zeigt verfügbare Modelle. Der frühere AK3
	 * (role="combobox", aria-expanded, aria-haspopup) ist mit dem Combobox-Vertrag entfallen —
	 * `kol-toolbar` rendert Items als native Buttons, zusätzliche ARIA-Attribute werden still
	 * verworfen.
	 */
	test('AK4 (KI-Modell-Auswahl): Klick öffnet Dialog und zeigt verfügbare Modelle', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelButton = modelSelectionEntryPoint(page);
		await expect(modelButton).toBeVisible();

		await modelButton.click();

		const dialog = page.getByRole('dialog', { name: /KI-Modell auswählen/i });
		await expect(dialog, 'Dialog mit Modell-Liste muss sichtbar werden').toBeVisible();

		// Mindestens ein auswählbares Modell muss angeboten werden. Die Liste wird von `KolDialog` per
		// Slot aus dem Light-DOM übernommen — sie ist damit KEIN DOM-Nachfahre des Dialog-Elements im
		// Shadow-DOM, ein auf `dialog` eingeschränkter Locator liefe ins Leere.
		const modelOptions = page.locator('[data-testid="free-model-item"]');
		await expect(modelOptions, 'Mindestens ein auswählbares Modell muss angeboten werden').not.toHaveCount(0);

		// Escape schließt den Dialog (Spec Journey 4: keine Focus-Trap)
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	/**
	 * Journey 3: Responsive Verhalten
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK1: Header-Height konsistent (kein Layout-Shift) — geprüft ab 48rem, wo der Einstieg existiert
	 */
	test('AK1 (Responsive): Header-Height konsistent bei 768px (kein Layout-Shift beim Öffnen)', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		// Gemessen wird der *ausgelayoutete* Header — sonst vergleicht der Test den Pre-Hydration-
		// Zustand der Toolbar mit dem fertigen Layout und meldet einen Shift, den die Interaktion
		// gar nicht ausgelöst hat (siehe `waitForSettledHeader`).
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const beforeBox = await header.boundingBox();
		expect(beforeBox, 'Header muss eine Boundingbox haben').not.toBeNull();

		// Der Header bleibt einzeilig — bei Umbruch läge er bei Logo + Avatar (#485 AK6, #718
		// AK4/AK5). Unter 48rem gilt derselbe Vertrag; ein Einstieg in die Modell-Auswahl existiert
		// dort aber nicht mehr (Dashboard-Button seit 8a7d182 entfernt, siehe AK2).
		const logoBox = await header.getByRole('button', { name: /Zum Dashboard/i }).boundingBox();
		const avatarBox = await header.locator('kol-avatar').first().boundingBox();
		expect(beforeBox!.height, `Header (${beforeBox!.height}px) muss einzeilig bleiben`).toBeLessThan(
			logoBox!.height + avatarBox!.height,
		);

		await openModelSelection(page);

		const afterBox = await header.boundingBox();
		expect(afterBox, 'Header muss nach dem Öffnen eine Boundingbox haben').not.toBeNull();
		expect(afterBox!.height, 'Header-Height darf sich bei der Modell-Auswahl nicht ändern').toBe(beforeBox!.height);
	});

	/**
	 * Journey 3: Responsive Verhalten
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3, überschrieben durch docs/spec/issue-965.md AK3
	 * AK2: Touch-Ziel der KI-Modell-Auswahl ≥44px (WCAG 2.5.5) — seit #965 auch mobil der Einstieg
	 */
	test('AK2 (Responsive): KI-Modell-Auswahl Touch-Target ≥44px (WCAG 2.5.5) ab 48rem und mobil sichtbar', async ({
		page,
	}) => {
		// Test-Pflege (#965, AK3): Bis #929/#787 wurde der Button unter 48rem gar nicht gerendert
		// (`toHaveCount(0)`), damit der Mobile-Header einzeilig blieb. #965 hebt die Ausblendung
		// auf (icon-only ist kompakt genug; Platzfragen löst app.css, nicht Ausblenden). Der
		// Header-Höhen-Vertrag bei 375px trägt mobile-shell.spec.ts (≤ 64px).
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await expect(
			modelSelectionEntryPoint(page),
			'Bei 375px muss die KI-Modell-Auswahl gerendert werden (#965 AK3)',
		).toBeVisible();

		// Ab 48rem ist der Toolbar-Button das Touch-Ziel. Er misst 44px über die gemeinsame
		// Toolbar-Einheit (`--pp-toolbar-height`/`--a11y-min-size`) und erfüllt WCAG 2.5.5. Die
		// früheren 48px galten nur für den entfernten Dashboard-Einstieg; den Header-Button auf 48px
		// zu heben bräche die 44px-Einheit der Kopf-Aktionen (und damit die #485-Relationen).
		await page.setViewportSize({ width: 768, height: 1024 });
		await waitForSettledHeader(page);

		const box = await modelSelectionEntryPoint(page).boundingBox();
		expect(box, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();

		const { width, height } = box!;
		expect(width, `Touch-Target Breite (${width}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
		expect(height, `Touch-Target Höhe (${height}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK3: Keine horizontalen Scrollbars oder Überläufe auf Mobile
	 */
	test('AK3 (Mobile): Keine horizontalen Scrollbars oder Überläufe bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		// Kein horizontaler Überlauf des Dokuments
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);

		// Toolbar muss sichtbar sein (auch wenn Elemente ggf. im Overflow-Menü liegen)
		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/i });
		await expect(toolbar).toBeVisible();
	});

	/**
	 * Journey 4: A11y
	 * AK1: Tastatur-Navigation folgt der Header-Reihenfolge über die *bedienbaren* Elemente
	 */
	test('AK1 (A11y): Tastatur-Navigation folgt der Header-Reihenfolge (Logo → Toolbar)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const logo = header.getByRole('button', { name: /Zum Dashboard/i });
		const avatar = header.locator('kol-avatar').first();
		const appName = header.locator('.app-name');

		// App-Name und Avatar sind reine Anzeige-Elemente. Sie stehen in der visuellen Reihenfolge
		// zwischen Logo und Toolbar, gehören aber bewusst NICHT in die Tab-Reihenfolge: Ein
		// Tab-Stopp ohne Aktion ist ein Sackgassen-Stopp für Tastatur-Nutzende (WCAG 2.4.3 zielt auf
		// eine sinnvolle Reihenfolge der *bedienbaren* Elemente, nicht auf jedes sichtbare Element).
		for (const [locator, name] of [
			[appName, 'App-Name'],
			[avatar, 'Avatar'],
		] as const) {
			const isFocusable = await locator.evaluate(
				(el) => el.matches('a[href],button,input,select,textarea,[tabindex]') || el.hasAttribute('tabindex'),
			);
			expect(isFocusable, `${name} ist ein Anzeige-Element und darf keinen Tab-Stopp erzeugen`).toBe(false);
		}

		// Logo muss focusierbar sein
		await logo.focus();
		await expect(logo).toBeFocused();

		// Der nächste Tab-Stopp nach dem Logo ist die Toolbar: `kol-toolbar` nutzt Roving Tabindex —
		// genau EIN Button (der erste) trägt tabindex=0, die übrigen tabindex=-1 und sind per
		// Pfeiltasten erreichbar (KoliBri-Semantik, Menschen-Entscheidung zu #929: A11y trägt KoliBri).
		await page.keyboard.press('Tab');
		await expect(
			header.getByRole('toolbar', { name: /Kopf-Aktionen/i }).getByRole('button', { name: 'Neuen Task anlegen' }),
			'Nach dem Logo muss der Fokus auf dem ersten Toolbar-Button landen',
		).toBeFocused();

		// Pfeiltasten navigieren im Roving-Verbund zum KI-Modell-Button — seit #965 (AK4) an 3. Stelle,
		// nach „Neuen Task anlegen“ und „Säulen-Berater“ — und Enter öffnet den Dialog.
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(
			modelSelectionEntryPoint(page),
			'Pfeiltasten müssen den Fokus auf die KI-Modell-Auswahl (Position 3, #965) bewegen',
		).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();
	});
});
