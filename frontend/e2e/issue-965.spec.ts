import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #965 "KI-Modell-Auswahl als Icon-Only-Button — immer sichtbar, vor Einstellungen"
 * (Stufe 1 TDD: der einklagbare Vertrag, rot bis zur Umsetzung).
 *
 * Spezifikation: docs/spec/issue-965.md
 *
 * Der bisherige Klartext-Button „KI-Modell: <Kurzname>“ (nur ≥ 48rem, #929) wird ersetzt durch
 * einen icon-only Button mit statischem Accessible Name „KI-Modell auswählen“ — an 3. Stelle,
 * auf allen Breiten. Der Button lebt als KoliBri-Item im Shadow-DOM der `kol-toolbar`; geprüft
 * wird ausschließlich über die öffentliche Schnittstelle (Rolle/Name/Geometrie).
 */

/** Einstieg über die öffentliche Schnittstelle: Rolle Button, statischer Accessible Name. */
const modelButton = (page: import('@playwright/test').Page) =>
	page.getByRole('button', { name: 'KI-Modell auswählen' });

test.describe('#965 KI-Modell-Button: icon-only, immer sichtbar, Position 3', () => {
	/**
	 * AK1 + AK2: Statischer Accessible Name, Modellname nicht im Button.
	 * Spec-Bezug: docs/spec/issue-965.md AK1/AK2.
	 *
	 * Spiegel-Test: Sollwert ist die tatsächlich konfigurierte `GET /api/v1/llm-config` — nicht
	 * ein hartcodierter Modellname. Der Accessible Name muss das konfigurierte Modell NICHT
	 * enthalten (Umkehrung des bisherigen #787-Klartext-Vertrags) und darf kein `KI-Modell:`-
	 * Präfix und keinen Ladezustand („Laden…“) mehr tragen — der Name ist statisch und hängt
	 * nicht mehr vom Config-Fetch ab.
	 */
	test('AK1/AK2: Accessible Name ist statisch „KI-Modell auswählen“ — ohne Modellname', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const button = modelButton(page);
		await expect(button).toBeVisible();

		const accessibleName = await button.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');
		expect(accessibleName.trim(), 'Kein alter „KI-Modell:“-Präfix und kein Ladezustand').not.toMatch(
			/^KI-Modell:|Laden/i,
		);

		// Modellname aus der führenden Quelle (API) lesen — er darf im Button-Namen nicht auftauchen.
		const configuredModel = await page.request
			.get('/api/v1/llm-config')
			.then((response) => response.json())
			.then((config: { openrouterModel: string }) => config.openrouterModel.toLowerCase());
		const shortSegments = configuredModel.split(/[:/]+/).filter((segment) => segment.length >= 3);
		for (const segment of shortSegments) {
			expect(
				accessibleName.toLowerCase(),
				`Modellbestandteil „${segment}“ darf nicht im Button-Namen stehen (AK2: Modell nur im Dialog)`,
			).not.toContain(segment);
		}
	});

	/**
	 * AK3: Der Button wird auf allen Viewport-Breiten gerendert — die #929-Ausblendung unter
	 * 48rem ist rückgebaut. Spec-Bezug: docs/spec/issue-965.md AK3.
	 *
	 * Ersetzt den #787-Vertrag „mobil kein Einstieg“ (`toHaveCount(0)` bei 375px), der AK3
	 * direkt widerspricht (Test-Pflege, siehe PR-Body). Touch-Ziel ≥ 44px (WCAG 2.5.5) bleibt
	 * Bestandteil des Mobil-Vertrags — der Button darf nicht auf Sichtbarkeit getrimmt werden.
	 */
	test('AK3: Button ist bei 375px sichtbar (Touch-Target ≥ 44px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const button = modelButton(page);
		await expect(button, 'Mobile-Header muss den KI-Modell-Button rendern (AK3)').toBeVisible();

		const box = await button.boundingBox();
		expect(box, 'Button muss eine Boundingbox haben').not.toBeNull();
		expect(box!.width, `Touch-Target Breite (${box!.width}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
		expect(box!.height, `Touch-Target Höhe (${box!.height}px) muss ≥ 44px sein`).toBeGreaterThanOrEqual(44);
	});

	/**
	 * AK4: Position 3 — hinter „Säulen-Berater“, direkt vor „Einstellungen“ — auf allen Breiten
	 * identisch. Spec-Bezug: docs/spec/issue-965.md AK4. Geprüft wird die visuelle
	 * Links-nach-rechts-Ordnung innerhalb der Toolbar (Muster aus #787/#912), nicht der DOM-Index
	 * im KoliBri-Shadow-DOM.
	 */
	for (const viewport of [
		{ name: 'Desktop 1280px', width: 1280, height: 800 },
		{ name: 'Mobile 375px', width: 375, height: 812 },
	]) {
		test(`AK4 (${viewport.name}): Reihenfolge Säulen-Berater → KI-Modell → Einstellungen`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.goto('/');
			await waitForStableView(page);

			const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/i });
			const advisor = toolbar.getByRole('button', { name: 'Säulen-Berater' });
			const model = modelButton(page);
			const settings = toolbar.getByRole('button', { name: 'Einstellungen' });

			const advisorBox = await advisor.boundingBox();
			const modelBox = await model.boundingBox();
			const settingsBox = await settings.boundingBox();
			expect(advisorBox, 'Säulen-Berater muss eine Boundingbox haben').not.toBeNull();
			expect(modelBox, 'KI-Modell-Button muss eine Boundingbox haben').not.toBeNull();
			expect(settingsBox, 'Einstellungen müssen eine Boundingbox haben').not.toBeNull();

			expect(
				advisorBox!.x + advisorBox!.width,
				'KI-Modell-Button muss hinter „Säulen-Berater“ stehen',
			).toBeLessThanOrEqual(modelBox!.x + 1);
			expect(
				modelBox!.x + modelBox!.width,
				'KI-Modell-Button muss direkt vor „Einstellungen“ stehen',
			).toBeLessThanOrEqual(settingsBox!.x + 1);
		});
	}
});
