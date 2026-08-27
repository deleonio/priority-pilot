import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1051 „Header-Toolbar-Buttons einheitlich + Mikrofon-Button im Such-Dialog ausrichten".
 *
 * AK1: Alle sechs Toolbar-Buttons haben dieselbe KoliBri-Variante (gleiche berechnete Hintergrundfarbe).
 * AK2: Mikrofon-Button im Such-Dialog ist vertikal mittig in der Inputbox ausgerichtet.
 * AK3: Gleiche Prüfung bei 375px Viewportbreite.
 *
 * Diese Tests sind **rot**, bis App.tsx:402 `_variant: 'primary'` → `'secondary'` und
 * app.css:1279-1283 die Mic-Button-Positionierung korrigiert ist.
 */
test.describe('#1051 Header-Toolbar einheitlich + Mic-Button ausrichten', () => {
	const TOOLBAR_LABEL = /Kopf-Aktionen/;
	const SEARCH_BTN_LABEL = 'Suche';

	/**
	 * AK1 — Alle sechs Toolbar-Buttons rendern mit derselben KoliBri-Variante.
	 * Geprüft über berechnete Hintergrundfarbe (computed `backgroundColor`),
	 * da die Variante nur im Shadow-DOM sichtbar wird.
	 */
	test('AK1: Alle Toolbar-Buttons haben dieselbe berechnete Hintergrundfarbe', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: TOOLBAR_LABEL });
		await expect(toolbar).toBeVisible();

		const buttons = toolbar.getByRole('button');
		const count = await buttons.count();
		expect(count).toBe(6);

		const bgColors = await buttons.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));

		// Alle Farben müssen identisch sein — Currently "Neuen Task anlegen" ist primary,
		// die anderen secondary → unterschiedliche Hintergrundfarben → ROT.
		const uniqueColors = new Set(bgColors);
		expect(
			uniqueColors.size,
			`Erwartet 1 einheitliche Hintergrundfarbe, gefunden: ${[...uniqueColors].join(', ')}`,
		).toBe(1);
	});

	/**
	 * AK2 — Mikrofon-Button im Such-Dialog ist vertikal mittig in der Inputbox.
	 * Prüft per Bounding-Box: Mic-Button Center-Y liegt innerhalb [input.y, input.y+input.height]
	 * und die rechte Mic-Kante überschreitet die rechte Input-Kante nicht.
	 */
	test('AK2: Mikrofon-Button ist vertikal in der Inputbox zentriert', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Such-Modal öffnen.
		await page.getByRole('button', { name: SEARCH_BTN_LABEL, exact: true }).click();
		const searchbox = page.getByRole('searchbox', { name: /Suchbegriff eingeben/i });
		await expect(searchbox).toBeVisible();

		// Mikrofon-Button (Light-DOM innerhalb VoiceField).
		const micButton = page.locator('.voice-field--input > .mic-button');
		await expect(micButton).toBeVisible();

		const micBox = await micButton.boundingBox();
		const inputBox = await searchbox.boundingBox();
		expect(micBox).not.toBeNull();
		expect(inputBox).not.toBeNull();

		const micCenterY = micBox!.y + micBox!.height / 2;
		const inputTop = inputBox!.y;
		const inputBottom = inputBox!.y + inputBox!.height;

		// Mic-Button vertikale Mitte muss innerhalb der Inputbox liegen.
		expect(
			micCenterY,
			`Mic-Button Center-Y (${micCenterY}) muss innerhalb Inputbox [${inputTop}, ${inputBottom}] liegen`,
		).toBeGreaterThanOrEqual(inputTop);
		expect(
			micCenterY,
			`Mic-Button Center-Y (${micCenterY}) muss innerhalb Inputbox [${inputTop}, ${inputBottom}] liegen`,
		).toBeLessThanOrEqual(inputBottom);

		// Mic-Button darf nicht über die rechte Input-Kante hinausragen.
		expect(
			micBox!.x + micBox!.width,
			`Mic-Button rechte Kante (${micBox!.x + micBox!.width}) muss ≤ Input rechte Kante (${inputBox!.x + inputBox!.width}) sein`,
		).toBeLessThanOrEqual(inputBox!.x + inputBox!.width + 1); // +1px Toleranz für Subpixel
	});

	/**
	 * AK3 — Mobile-First (375×812): AK1 + AK2 gelten auch bei schmalem Viewport.
	 */
	test('AK3: Bei 375px Viewport: Toolbar einheitlich + Mic-Button ausgerichtet', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		// AK1: Toolbar-Varianten einheitlich.
		const toolbar = page.getByRole('toolbar', { name: TOOLBAR_LABEL });
		await expect(toolbar).toBeVisible();
		const buttons = toolbar.getByRole('button');
		const count = await buttons.count();
		expect(count).toBe(6);

		const bgColors = await buttons.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
		const uniqueColors = new Set(bgColors);
		expect(uniqueColors.size, `375px: Erwartet 1 Hintergrundfarbe, gefunden: ${uniqueColors.size}`).toBe(1);

		// AK2: Such-Modal öffnen und Mic-Button prüfen.
		// Auf 375px kann der „Suche"-Button im Overflow-Menü liegen — `headerAction`
		// oder direkter Klick auf den Button (falls sichtbar).
		const searchBtn = page.getByRole('button', { name: SEARCH_BTN_LABEL, exact: true });
		await searchBtn.click();
		const searchbox = page.getByRole('searchbox', { name: /Suchbegriff eingeben/i });
		await expect(searchbox).toBeVisible();

		const micButton = page.locator('.voice-field--input > .mic-button');
		await expect(micButton).toBeVisible();

		const micBox = await micButton.boundingBox();
		const inputBox = await searchbox.boundingBox();
		expect(micBox).not.toBeNull();
		expect(inputBox).not.toBeNull();

		const micCenterY = micBox!.y + micBox!.height / 2;
		expect(
			micCenterY >= inputBox!.y && micCenterY <= inputBox!.y + inputBox!.height,
			`375px: Mic-Button Center-Y (${micCenterY}) muss in Inputbox [${inputBox!.y}, ${inputBox!.y + inputBox!.height}] liegen`,
		).toBe(true);
	});
});
