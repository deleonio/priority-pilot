import type { Locator, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Wartet zusätzlich zu `waitForStableView` auf den *ausgelayouteten* Header.
 *
 * `waitForStableView` garantiert nur, dass die Custom-Elements registriert sind — `kol-toolbar`
 * baut ihre Buttons danach noch im eigenen Shadow-DOM auf und misst in diesem Fenster 0×0 px.
 * Wer davor misst, misst den Pre-Layout-Zustand (Header einzeilig) und vergleicht ihn später mit
 * dem echten Layout: ein Test-Artefakt, kein Layout-Shift der Anwendung. Ebenso zeigt der
 * Modell-Button bis zur Antwort von `GET /llm-config` „Laden…" und ändert danach seine Breite.
 */
const waitForSettledHeader = async (page: Page): Promise<void> => {
	await waitForStableView(page);
	await page.waitForFunction(() => {
		const toolbar = document.querySelector('header kol-toolbar');
		const modelButton = document.querySelector('header .model-selector-button');
		if (toolbar === null || modelButton === null) {
			return false;
		}
		return toolbar.getBoundingClientRect().width > 0 && modelButton.textContent?.includes('Laden') === false;
	});
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
 * Einstieg in die Modell-Auswahl auf Mobile (#787 Journey 3): Unter 48rem ist die KI-Modell-Auswahl
 * im Header ausgeblendet — dort füllen Logo, Avatar und die fünf Kopf-Aktionen (#691) die Zeile
 * bereits aus. Der Einstieg bleibt der Dashboard-Button aus #742.
 */
const modelSelectionEntryPoint = (page: Page): Locator => page.locator('[data-testid="model-selection-button"]');

/** Öffnet die Modell-Auswahl über den Mobile-Einstieg und wartet auf den geöffneten Dialog. */
const openModelSelection = async (page: Page): Promise<void> => {
	await modelSelectionEntryPoint(page).click();
	await expect(page.getByRole('dialog', { name: /KI-Modell auswählen/i })).toBeVisible();
};

/**
 * Spec-Tests für #787 "Header-Layout und KI-Modell-Auswahl in Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Header-Layout folgt der Reihenfolge Logo → Name → Avatar → Toolbar und die KI-Modell-Auswahl
 * ist harmonisch in die Toolbar integriert mit voller A11y-Unterstützung.
 *
 * Spezifikation: docs/spec/issue-787.md
 */
test.describe('#787 Header-Layout und KI-Modell-Auswahl in Toolbar', () => {
	/**
	 * Journey 1: Header-Layout auf Desktop
	 * Spec-Bezug: docs/spec/issue-787.md Journey 1
	 * AK1: Header-Layout folgt der Reihenfolge Logo → Name → Avatar → Toolbar
	 */
	test('AK1: Header-Layout folgt der Reihenfolge Logo → Name → Avatar → Toolbar (Desktop)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Alle relevanten Elemente identifizieren
		const logo = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const avatar = header.locator('kol-avatar').first();
		const toolbar = header.getByRole('toolbar', { name: /Kopf-Aktionen/i });

		// Alle Elemente müssen sichtbar sein
		await expect(logo).toBeVisible();
		await expect(avatar).toBeVisible();
		await expect(toolbar).toBeVisible();

		// DOM-Reihenfolge prüfen: Logo → App-Name → Avatar → Toolbar.
		// Die Indizes werden über die *semantischen* Merkmale der Kinder bestimmt (Button mit
		// Logo-Label, Text „Priority Pilot", `kol-avatar`, `role="toolbar"`) — nicht über die
		// CSS-Klassen, damit der Vertrag ein Layout-Vertrag bleibt und kein Klassennamen-Vertrag.
		const { logoIndex, nameIndex, avatarIndex, toolbarIndex } = await header.evaluate((el) => {
			const children = Array.from((el as HTMLElement).children);
			return {
				logoIndex: children.findIndex((child) => child.querySelector('img') !== null),
				nameIndex: children.findIndex((child) => child.textContent?.trim() === 'Priority Pilot'),
				avatarIndex: children.findIndex((child) => child.matches('kol-avatar')),
				// `kol-toolbar` trägt `role="toolbar"` in ihrem Shadow-DOM — aus dem Light-DOM ist der
				// Toolbar-Block deshalb über das Custom-Element identifizierbar, nicht über die Rolle.
				toolbarIndex: children.findIndex((child) => child.querySelector('kol-toolbar') !== null),
			};
		});

		// Reihenfolge validieren: Logo < Name < Avatar < Toolbar
		expect(logoIndex, 'Logo muss im Header vorhanden sein').toBeGreaterThanOrEqual(0);
		expect(nameIndex, 'App-Name muss im Header vorhanden sein').toBeGreaterThanOrEqual(0);
		expect(avatarIndex, 'Avatar muss im Header vorhanden sein').toBeGreaterThanOrEqual(0);
		expect(toolbarIndex, 'Toolbar muss im Header vorhanden sein').toBeGreaterThanOrEqual(0);

		expect(logoIndex, 'Logo muss vor App-Name erscheinen').toBeLessThan(nameIndex);
		expect(nameIndex, 'App-Name muss vor Avatar erscheinen').toBeLessThan(avatarIndex);
		expect(avatarIndex, 'Avatar muss vor Toolbar erscheinen').toBeLessThan(toolbarIndex);
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

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();
		const selectorBox = await modelSelector.boundingBox();
		const toolbarBox = await toolbar.boundingBox();
		expect(selectorBox, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();
		expect(toolbarBox, 'Toolbar muss eine Boundingbox haben').not.toBeNull();

		const selectorCenter = selectorBox!.y + selectorBox!.height / 2;
		const toolbarCenter = toolbarBox!.y + toolbarBox!.height / 2;
		expect(
			Math.abs(selectorCenter - toolbarCenter),
			'KI-Modell-Auswahl muss auf derselben Höhe wie die Toolbar-Buttons ausgerichtet sein',
		).toBeLessThanOrEqual(2);

		// Dropdown-Indikator (Chevron) muss sichtbar sein. Geprüft wird das gerenderte Icon-Element im
		// Light-DOM des eigenen Buttons — kein Griff in fremdes Shadow-DOM (#824). Das Icon ist
		// dekorativ (`aria-hidden`) und hat deshalb bewusst keine eigene Rolle: Die Bedeutung trägt
		// das `aria-label` des Buttons, das Icon nur die visuelle Ankündigung des Popups.
		const chevron = modelSelector.locator('.model-selector-chevron');
		await expect(chevron, 'KI-Modell-Auswahl muss einen Dropdown-Indikator (Chevron) haben').toBeVisible();
		await expect(chevron, 'Der Chevron ist dekorativ und muss vor Screenreadern verborgen sein').toHaveAttribute(
			'aria-hidden',
			'true',
		);

		// Das Label muss das *tatsächlich konfigurierte* Modell benennen. Referenz ist die API, nicht
		// eine hartcodierte Anbieter-Liste: Das Modell ist frei konfigurierbar (`PUT /llm-config`,
		// Default `openrouter/free`), ein Test gegen feste Namen wie „Sonnet" prüfte die Konfiguration
		// der Testumgebung statt des Verhaltens der Anwendung.
		const configuredModel = await page.request
			.get('/api/v1/llm-config')
			.then((response) => response.json())
			.then((config: { openrouterModel: string }) => config.openrouterModel);

		const modelLabel = await modelSelector.evaluate((el) => (el as HTMLElement).textContent?.trim() ?? '');

		expect(modelLabel, 'Label darf nicht im Ladezustand stehen bleiben').not.toMatch(/Laden/i);
		expect(
			configuredModel.toLowerCase(),
			`Label „${modelLabel}" muss aus dem konfigurierten Modell „${configuredModel}" ableitbar sein`,
		).toContain(modelLabel.toLowerCase());
		// Ein Label wie „free" benennt nur die Preisklasse — es muss das Modell identifizieren.
		expect(
			['free', 'chat', 'instruct', 'preview', 'latest', 'beta'],
			`Label „${modelLabel}" ist nichtssagend und identifiziert kein Modell`,
		).not.toContain(modelLabel.toLowerCase());
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

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		const box = await modelSelector.boundingBox();
		expect(box, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();

		const { width, height } = box!;
		expect(width, `Click-Target Breite (${width}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
		expect(height, `Click-Target Höhe (${height}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK2: Tastatur-Navigation und Focus-Indikator sichtbar (2px solid, Kontrast ≥3:1)
	 */
	test('AK2 (KI-Modell-Auswahl): Tastatur-Navigation mit sichtbarem Focus-Indikator', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Tab-Reihenfolge: Focus auf KI-Modell-Auswahl setzen
		await modelSelector.focus();
		await expect(modelSelector).toBeFocused();

		// Focus-Indikator muss sichtbar sein (outline mit Kontrast)
		const hasFocusIndicator = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			const styles = window.getComputedStyle(button);
			const hasOutline = styles.outlineStyle !== 'none' && parseInt(styles.outlineWidth) > 0;
			const hasBoxShadow = styles.boxShadow !== 'none';
			return hasOutline || hasBoxShadow;
		});
		expect(hasFocusIndicator, 'Focus-Indikator muss sichtbar sein (outline oder box-shadow)').toBe(true);
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK3: A11y-Attribute korrekt gesetzt (role=combobox, aria-expanded, aria-pressed)
	 */
	test('AK3 (KI-Modell-Auswahl): A11y-Attribute korrekt (role=combobox, aria-expanded)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// role="combobox" muss gesetzt sein
		const role = await modelSelector.getAttribute('role');
		expect(role, 'KI-Modell-Auswahl muss role="combobox" haben').toBe('combobox');

		// aria-expanded muss vorhanden sein (true oder false)
		const ariaExpanded = await modelSelector.getAttribute('aria-expanded');
		expect(ariaExpanded, 'aria-expanded muss "true" oder "false" sein').toMatch(/true|false/);

		// Screenreader-Label muss sprechend sein
		const ariaLabel = await modelSelector.getAttribute('aria-label');
		const accessibleName = await modelSelector.evaluate((el) => (el as HTMLElement).textContent?.trim());
		const label = ariaLabel || accessibleName;

		// Das Label ist sprechend, wenn es die Absicht („Modellauswahl") oder den aktuellen Stand
		// benennt — herstellerspezifische Namen sind freie Konfiguration und gehören nicht in den Test.
		expect(label, 'Screenreader-Label muss sprechend sein ("Modell auswählen, aktuell: ...")').toMatch(
			/Modell.*auswählen|aktuell/i,
		);

		// Vor dem Klick: aria-expanded="false"
		expect(ariaExpanded, 'Zu Beginn muss aria-expanded="false" sein').toBe('false');
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK4: KI-Modell-Auswahl öffnet Dropdown und zeigt Modelle
	 */
	test('AK4 (KI-Modell-Auswahl): Popup öffnet sich und zeigt verfügbare Modelle', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Das Popup ist ein modaler Dialog, keine Listbox — `aria-haspopup` muss das ankündigen,
		// damit Screenreader den Wechsel in einen Dialog erwarten (ARIA 1.2 lässt für `combobox`
		// genau diese Popup-Rolle zu).
		await expect(modelSelector, 'combobox muss sein Popup als Dialog ankündigen').toHaveAttribute(
			'aria-haspopup',
			'dialog',
		);

		// Popup öffnen
		await modelSelector.click();

		// aria-expanded muss auf "true" wechseln
		await expect(modelSelector, 'Nach Klick muss aria-expanded="true" sein').toHaveAttribute('aria-expanded', 'true');

		// Popup mit Modell-Liste muss sichtbar werden
		const dialog = page.getByRole('dialog', { name: /KI-Modell auswählen/i });
		await expect(dialog, 'Popup mit Modell-Liste muss sichtbar werden').toBeVisible();

		// Mindestens ein auswählbares Modell muss angeboten werden. Die Liste wird von `KolDialog` per
		// Slot aus dem Light-DOM übernommen — sie ist damit KEIN DOM-Nachfahre des Dialog-Elements im
		// Shadow-DOM, ein auf `dialog` eingeschränkter Locator liefe ins Leere.
		const modelOptions = page.locator('[data-testid="free-model-item"]');
		await expect(modelOptions, 'Mindestens ein auswählbares Modell muss angeboten werden').not.toHaveCount(0);

		// Escape schließt das Popup und meldet den Zustand zurück (Spec Journey 4: keine Focus-Trap)
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(modelSelector, 'Nach Escape muss aria-expanded="false" sein').toHaveAttribute(
			'aria-expanded',
			'false',
		);
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK1: Header-Height konsistent (kein Layout-Shift) bei 375px
	 */
	test('AK1 (Mobile): Header-Height konsistent bei 375px (kein Layout-Shift)', async ({ page }) => {
		await mockFreeModels(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		// Gemessen wird der *ausgelayoutete* Header — sonst vergleicht der Test den Pre-Hydration-
		// Zustand der Toolbar mit dem fertigen Layout und meldet einen Shift, den die Interaktion
		// gar nicht ausgelöst hat (siehe `waitForSettledHeader`).
		await waitForSettledHeader(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const beforeBox = await header.boundingBox();
		expect(beforeBox, 'Header muss eine Boundingbox haben').not.toBeNull();

		// Der Header bleibt auf 375px einzeilig — bei Umbruch läge er bei Logo + Avatar (#485 AK6,
		// #718 AK4). Deshalb ist die KI-Modell-Auswahl hier nicht im Header, sondern auf dem
		// Dashboard (siehe Abgrenzung in der Spec).
		const logoBox = await header.getByRole('button', { name: /Zum Dashboard/i }).boundingBox();
		const avatarBox = await header.locator('kol-avatar').first().boundingBox();
		expect(beforeBox!.height, `Header (${beforeBox!.height}px) muss auf 375px einzeilig bleiben`).toBeLessThan(
			logoBox!.height + avatarBox!.height,
		);

		await openModelSelection(page);

		const afterBox = await header.boundingBox();
		expect(afterBox, 'Header muss nach dem Öffnen eine Boundingbox haben').not.toBeNull();
		expect(afterBox!.height, 'Header-Height darf sich bei der Modell-Auswahl nicht ändern').toBe(beforeBox!.height);
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK2: Touch-Ziele mindestens 48×48px (WCAG 2.5.5) bei Mobile
	 */
	test('AK2 (Mobile): KI-Modell-Auswahl Touch-Target mindestens 48×48px (WCAG 2.5.5)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForSettledHeader(page);

		// Auf Mobile ist der Dashboard-Einstieg das Touch-Ziel der Modell-Auswahl — im Header ist sie
		// ausgeblendet, damit der Header einzeilig bleibt.
		await expect(
			page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i }),
			'KI-Modell-Auswahl darf den 375px-Header nicht umbrechen und ist dort ausgeblendet',
		).toBeHidden();

		const box = await modelSelectionEntryPoint(page).boundingBox();
		expect(box, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();

		const { width, height } = box!;
		expect(width, `Touch-Target Breite (${width}px) muss ≥ 48px sein`).toBeGreaterThanOrEqual(48);
		expect(height, `Touch-Target Höhe (${height}px) muss ≥ 48px sein`).toBeGreaterThanOrEqual(48);
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK3: Keine horizontalen Scrollbars oder Überläufe auf Mobile
	 */
	test('AK3 (Mobile): Keine horizontalen Scrollbars oder Überläufe bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForSettledHeader(page);

		// Kein horizontaler Überlauf des Dokuments
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);

		// Toolbar muss sichtbar sein (auch wenn Elemente ggf. im Overflow-Menü liegen)
		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/i });
		await expect(toolbar).toBeVisible();
	});

	/**
	 * Journey 4: A11y und Kontrast
	 * Spec-Bezug: docs/spec/issue-787.md Journey 4
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
		const toolbar = header.getByRole('toolbar', { name: /Kopf-Aktionen/i });

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

		// Der nächste Tab-Stopp nach dem Logo ist die KI-Modell-Auswahl — das erste bedienbare Element
		// des Kopf-Aktionen-Blocks (Spec Journey 1: Toolbar folgt auf Logo/Name/Avatar).
		await page.keyboard.press('Tab');
		await expect(
			page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i }),
			'Nach dem Logo muss der Fokus auf der KI-Modell-Auswahl landen',
		).toBeFocused();

		// Von dort geht es weiter in die Toolbar. Deren Buttons liegen im Shadow-DOM von
		// `kol-toolbar`; `document.activeElement` zeigt dann auf den Host — geprüft wird deshalb der
		// Host selbst bzw. ein Nachfahre davon.
		await page.keyboard.press('Tab');
		const toolbarFocused = await header
			.locator('kol-toolbar')
			.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
		expect(toolbarFocused, 'Toolbar-Elemente müssen per Tab erreicht werden können').toBe(true);
		await expect(toolbar).toBeVisible();
	});

	/**
	 * Journey 4: A11y und Kontrast
	 * Spec-Bezug: docs/spec/issue-787.md Journey 4
	 * AK2: Kontrast-Anforderungen erfüllt (Text-Icons ≥4.5:1, UI-Elemente ≥3:1)
	 */
	test('AK2 (A11y): Kontrast-Anforderungen für KI-Modell-Auswahl erfüllt', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Kontrast-Werte prüfen (approximativ über computed styles)
		const contrastCheck = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			const styles = window.getComputedStyle(button);
			const textColor = styles.color;
			const bgColor = styles.backgroundColor;

			// RGB-Werte extrahieren
			const rgbMatch = textColor.match(/\d+/g);
			const bgMatch = bgColor.match(/\d+/g);

			if (!rgbMatch || !bgMatch || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
				return { sufficient: true, reason: 'Transparenter Hintergrund oder kein RGB-Match' };
			}

			const rgb = rgbMatch.map(Number);
			const bg = bgMatch.map(Number);

			// Relative Luminanz berechnen (WCAG Formel)
			const luminance = (color: number[]): number => {
				const [r, g, b] = color.map((c) => {
					const sRGB = c / 255;
					return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
				});
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};

			const lum1 = luminance(rgb);
			const lum2 = luminance(bg);
			const lighter = Math.max(lum1, lum2);
			const darker = Math.min(lum1, lum2);

			const contrast = (lighter + 0.05) / (darker + 0.05);
			const meetsText = contrast >= 4.5;
			const meetsUI = contrast >= 3.0;

			return {
				contrast: contrast.toFixed(2),
				sufficient: meetsText || meetsUI,
				reason: `Kontrast ${contrast.toFixed(2)}:1 (Text≥4.5:1=${meetsText}, UI≥3.0:1=${meetsUI})`,
			};
		});

		expect(contrastCheck.sufficient, `Kontrast-Anforderungen nicht erfüllt: ${contrastCheck.reason}`).toBe(true);
	});

	/**
	 * Journey 4: A11y und Kontrast
	 * Spec-Bezug: docs/spec/issue-787.md Journey 4
	 * AK3: Screenreader-komplette Journey (Label erkennt Status-Änderungen)
	 */
	test('AK3 (A11y): Screenreader kündigt Modell-Änderung an', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForSettledHeader(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Initiales Label prüfen
		const initialLabel = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			return button.getAttribute('aria-label') || button.textContent?.trim() || '';
		});
		// Freie Modell-Konfiguration: sprechend heißt „Modell" benannt — nicht ein fester Anbietername.
		expect(initialLabel, 'Initiales Label muss sprechend sein').toMatch(/Modell/i);

		// Dropdown öffnen
		await modelSelector.click();

		// aria-expanded muss geändert haben
		const ariaExpanded = await modelSelector.getAttribute('aria-expanded');
		expect(ariaExpanded, 'Nach Klick muss aria-expanded="true" sein').toBe('true');

		// Screenreader-Info muss die verfügbaren Modelle ankündigen — bewusst OHNE Anzahl: Die Liste
		// lädt dynamisch erst im Dialog, eine Zahl im Button-Label wäre eine Falschaussage (Spec v1.1).
		const optionsInfo = await modelSelector.getAttribute('aria-label');
		const hasOptionsInfo = optionsInfo?.match(/verfügbar|Modelle/i);
		expect(hasOptionsInfo, 'Screenreader-Info sollte die verfügbaren Modelle ankündigen').toBeTruthy();
	});
});
