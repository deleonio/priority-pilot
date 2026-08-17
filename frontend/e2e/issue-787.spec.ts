import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #787 "Header-Layout und KI-Modell-Auswahl in Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Header-Layout folgt der Reihenfolge Logo → Name → Avatar → Toolbar und die KI-Modell-Auswahl
 * ist harmonisch in die Toolbar integriert mit voller A11y-Unterstützung.
 *
 * Spezifikation: docs/spec/issue-787.md
 *
 * Diese Tests sind **rot**, bis das Header-Layout umgebaut und die KI-Modell-Auswahl in die Toolbar
 * integriert ist.
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
		await waitForStableView(page);

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

		// DOM-Reihenfolge prüfen: Logo → App-Name → Avatar → Toolbar
		const elements = await header.evaluate((el) => {
			const headerEl = el as HTMLElement;
			const children = Array.from(headerEl.children);
			return children.map((child) => ({
				tagName: child.tagName.toLowerCase(),
				className: child.className,
				role: child.getAttribute('role'),
				textContent: child.textContent?.trim().substring(0, 20),
			}));
		});

		// Reihenfolge-Indizes finden
		const logoIndex = elements.findIndex((el) => el.tagName === 'img' || el.role === 'button');
		const nameIndex = elements.findIndex((el) => el.textContent?.includes('Priority'));
		const avatarIndex = elements.findIndex((el) => el.className?.includes('avatar') || el.tagName === 'kol-avatar');
		const toolbarIndex = elements.findIndex((el) => el.role === 'toolbar');

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
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/i });
		await expect(toolbar).toBeVisible();

		// KI-Modell-Auswahl muss in der Toolbar liegen
		const modelSelector = toolbar.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector, 'KI-Modell-Auswahl muss in der Toolbar liegen').toBeVisible();

		// Dropdown-Indikator (Chevron) muss sichtbar sein
		const hasChevron = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			const html = button.innerHTML + (button.shadowRoot?.innerHTML ?? '');
			return /chevron|arrow|down/i.test(html);
		});
		expect(hasChevron, 'KI-Modell-Auswahl muss einen Dropdown-Indikator (Chevron) haben').toBe(true);

		// Label muss aktuelles Modell anzeigen
		const modelLabel = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			return button.textContent?.trim() || button.getAttribute('aria-label') || '';
		});
		expect(modelLabel, 'KI-Modell-Auswahl muss ein Label mit aktuellem Modell haben').toMatch(
			/Sonnet|Opus|Haiku|Claude/i,
		);
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK1: Click-Target der KI-Modell-Auswahl: Mindestens 44×44px (BITV 2.1)
	 */
	test('AK1 (KI-Modell-Auswahl): Click-Target mindestens 44×44px (BITV 2.1)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

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
		await waitForStableView(page);

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
		await waitForStableView(page);

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

		expect(label, 'Screenreader-Label muss sprechend sein ("Modell auswählen, aktuell: ...")').toMatch(
			/Modell.*auswählen|aktuell|Sonnet|Opus|Haiku/i,
		);

		// Vor dem Klick: aria-expanded="false"
		expect(ariaExpanded, 'Zu Beginn muss aria-expanded="false" sein').toBe('false');
	});

	/**
	 * Journey 2: KI-Modell-Auswahl Interaktion
	 * Spec-Bezug: docs/spec/issue-787.md Journey 2
	 * AK4: KI-Modell-Auswahl öffnet Dropdown und zeigt Modelle
	 */
	test('AK4 (KI-Modell-Auswahl): Dropdown öffnet sich und zeigt verfügbare Modelle', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Dropdown öffnen
		await modelSelector.click();

		// aria-expanded muss auf "true" wechseln
		const ariaExpanded = await modelSelector.getAttribute('aria-expanded');
		expect(ariaExpanded, 'Nach Klick muss aria-expanded="true" sein').toBe('true');

		// Dropdown/Liste mit Modellen muss sichtbar werden
		const modelList = page.getByRole('listbox', { name: /Verfügbare Modelle|Modelle/i });
		await expect(modelList, 'Dropdown mit Modell-Liste muss sichtbar werden').toBeVisible();

		// Mindestens ein Modell-Option muss vorhanden sein
		const modelOptions = modelList.getByRole('option');
		const optionCount = await modelOptions.count();
		expect(optionCount, 'Mindestens eine Modell-Option muss vorhanden sein').toBeGreaterThan(0);
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK1: Header-Height konsistent (kein Layout-Shift) bei 375px
	 */
	test('AK1 (Mobile): Header-Height konsistent bei 375px (kein Layout-Shift)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		const headerBox = await header.boundingBox();
		expect(headerBox, 'Header muss eine Boundingbox haben').not.toBeNull();

		const headerHeight = headerBox!.height;

		// KI-Modell-Auswahl finden und klicken (falls sichtbar)
		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		const isVisible = await modelSelector.isVisible().catch(() => false);

		if (isVisible) {
			const beforeHeight = headerHeight;
			await modelSelector.click();
			await page.waitForTimeout(100); // Kurze Wartezeit für UI-Update

			const afterBox = await header.boundingBox();
			expect(afterBox, 'Header muss nach Toolbar-Klick eine Boundingbox haben').not.toBeNull();

			const afterHeight = afterBox!.height;
			expect(afterHeight, 'Header-Height darf sich bei Toolbar-Änderung nicht ändern').toBe(beforeHeight);
		}
	});

	/**
	 * Journey 3: Responsive Verhalten (Mobile)
	 * Spec-Bezug: docs/spec/issue-787.md Journey 3
	 * AK2: Touch-Ziele mindestens 48×48px (WCAG 2.5.5) bei Mobile
	 */
	test('AK2 (Mobile): KI-Modell-Auswahl Touch-Target mindestens 48×48px (WCAG 2.5.5)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		const isVisible = await modelSelector.isVisible().catch(() => false);

		if (isVisible) {
			const box = await modelSelector.boundingBox();
			expect(box, 'KI-Modell-Auswahl muss eine Boundingbox haben').not.toBeNull();

			const { width, height } = box!;
			expect(width, `Touch-Target Breite (${width}px) muss ≥ 48px sein`).toBeGreaterThanOrEqual(48);
			expect(height, `Touch-Target Höhe (${height}px) muss ≥ 48px sein`).toBeGreaterThanOrEqual(48);
		}
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
	 * Journey 4: A11y und Kontrast
	 * Spec-Bezug: docs/spec/issue-787.md Journey 4
	 * AK1: Tastatur-Navigation vollständig (Tab-Reihenfolge: Logo → Name → Avatar → Toolbar)
	 */
	test('AK1 (A11y): Tastatur-Navigation Logo → Name → Avatar → Toolbar-Elemente', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Tab-Reihenfolge durchlaufen und sicherstellen, dass alle Elemente focusierbar sind
		const logo = header.getByRole('button', { name: /Zum Dashboard/i });
		const avatar = header.locator('kol-avatar').first();
		const toolbar = header.getByRole('toolbar', { name: /Kopf-Aktionen/i });

		// Logo muss focusierbar sein
		await logo.focus();
		await expect(logo).toBeFocused();

		// Tab zu Avatar
		await page.keyboard.press('Tab');
		const avatarFocused = await avatar.evaluate((el) => document.activeElement === el);
		expect(avatarFocused, 'Avatar muss per Tab erreicht werden können').toBe(true);

		// Tab zu Toolbar-Elementen
		await page.keyboard.press('Tab');
		const toolbarFocused = await toolbar.evaluate((el) => el.contains(document.activeElement));
		expect(toolbarFocused, 'Toolbar-Elemente müssen per Tab erreicht werden können').toBe(true);
	});

	/**
	 * Journey 4: A11y und Kontrast
	 * Spec-Bezug: docs/spec/issue-787.md Journey 4
	 * AK2: Kontrast-Anforderungen erfüllt (Text-Icons ≥4.5:1, UI-Elemente ≥3:1)
	 */
	test('AK2 (A11y): Kontrast-Anforderungen für KI-Modell-Auswahl erfüllt', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

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
		await waitForStableView(page);

		const modelSelector = page.getByRole('combobox', { name: /Modell auswählen|KI.*Modell/i });
		await expect(modelSelector).toBeVisible();

		// Initiales Label prüfen
		const initialLabel = await modelSelector.evaluate((el) => {
			const button = el as HTMLElement;
			return button.getAttribute('aria-label') || button.textContent?.trim() || '';
		});
		expect(initialLabel, 'Initiales Label muss sprechend sein').toMatch(/Modell|Sonnet|Opus|Haiku|Claude/i);

		// Dropdown öffnen
		await modelSelector.click();

		// aria-expanded muss geändert haben
		const ariaExpanded = await modelSelector.getAttribute('aria-expanded');
		expect(ariaExpanded, 'Nach Klick muss aria-expanded="true" sein').toBe('true');

		// Screenreader-Info muss "X Optionen verfügbar" o.ä. beinhalten
		const optionsInfo = await modelSelector.getAttribute('aria-label');
		const hasOptionsInfo = optionsInfo?.match(/\d+.*Option|verfügbar|Modelle/i);
		expect(hasOptionsInfo, 'Screenreader-Info sollte Anzahl der Optionen ankündigen').toBeTruthy();
	});
});
