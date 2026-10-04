import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableBox, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2014 — Kategorien als Chips statt Kartenzeilen (Spec docs/spec/issue-2014.md).
 *
 * - AK1: Mehrere Chips teilen sich eine Zeile (Desktop); bei 375px Umbrechen ohne horizontalen
 *   Überlauf (Bounding-Box-Assertions, Muster #1098) und ohne echten Scroll-Container in der
 *   Liste (`measureHorizontalScroll`, Muster #1258).
 * - AK2: Bearbeiten (vorbelegter Form-Dialog) und Löschen (Bestätigungsdialog) bleiben je Chip
 *   (`data-category-id`) adressierbar und lauffähig.
 * - AK3: Die Aktions-Schalter je Chip messen mindestens 44×44px (KoliBri `--a11y-min-size`).
 *
 * Gegen das echte Backend (Vite-Proxy, Muster `categories.spec.ts`): Stammdaten per API, das
 * Aufräumen ist auf das eigene `E2E-2014-`-Präfix eingegrenzt — fremde Stammdaten gehen diese
 * Spec nichts an.
 */

const PREFIX = 'E2E-2014-';
let runId = 0;
const uniqueName = (label: string): string => `${PREFIX}${label}-${(runId += 1)}`;

/** Legt eine Kategorie über die echte API an. */
const createCategoryViaApi = async (page: Page, name: string, color = '#b42318'): Promise<number> => {
	const response = await page.request.post('/api/v1/categories', { data: { name, color } });
	expect(response.ok(), `Kategorie ${name} konnte nicht angelegt werden`).toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

/** Räumt die eigenen Präfix-Kategorien ab (vor und nach jedem Test). */
const resetData = async (page: Page): Promise<void> => {
	const categories = (await (await page.request.get('/api/v1/categories')).json()) as {
		id: number;
		name: string;
	}[];
	for (const category of categories.filter((entry) => entry.name.startsWith(PREFIX))) {
		await page.request.delete(`/api/v1/categories/${category.id}`);
	}
};

test.describe('Balamentum — #2014: Kategorie-Chips', () => {
	test.beforeEach(async ({ page }) => {
		await resetData(page);
	});

	test.afterEach(async ({ page }) => {
		await resetData(page);
	});

	test('AK1 — Desktop: mehrere Kategorie-Chips teilen sich eine Zeile', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const names = [uniqueName('Hausbau'), uniqueName('Steuer'), uniqueName('Verein')];
		for (const name of names) {
			await createCategoryViaApi(page, name);
		}

		await page.goto('/app/settings/kategorien');
		await waitForStableView(page, 'Balamentum');

		const chipLocators = names.map((name) => page.locator('li[data-category-id]').filter({ hasText: name }));
		for (const chip of chipLocators) {
			await expect(chip).toHaveCount(1);
		}
		await waitForStableBox(page, chipLocators[0]);

		// AK1 Kern: EINE umbrechende Flex-Zeile statt Karten-Grid. Heute ist die Liste am Desktop das
		// Säulen-Grid (app.css:2399, `display:grid` — Karten stehen nebeneinander wie Säulen), nach dem
		// Umbau eine wrap-fähige Flex-Zeile. Computed Style statt Source-Match: ausgewertet wird das
		// tatsächliche Layout-Verhalten der gerenderten Liste.
		const listLayout = await chipLocators[0].evaluate((chip) => {
			const style = getComputedStyle(chip.parentElement as Element);
			return { display: style.display, flexWrap: style.flexWrap };
		});
		expect(listLayout.display, 'Kategorien als umbrechende Zeile (heute: Säulen-Grid)').toBe('flex');
		expect(listLayout.flexWrap, 'Zeile bricht bei Platzmangel um').toBe('wrap');

		const boxes: ({ x: number; y: number; width: number; height: number } | null)[] = [];
		for (const chip of chipLocators) {
			boxes.push(await chip.boundingBox());
		}

		// Semantischer Zweitbeleg: mindestens zwei Chips teilen sich dieselbe visuelle Zeile.
		const sharesRow = boxes.some((a, i) =>
			boxes.some((b, j) => j > i && a !== null && b !== null && a.y < b.y + b.height && b.y < a.y + a.height),
		);
		expect(sharesRow, 'mindestens zwei Kategorie-Chips liegen in derselben Zeile').toBe(true);
	});

	test('AK1/AK3 — 375px: Chips umbrechen ohne Überlauf, Touch-Ziele ≥ 44px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const names = [uniqueName('Mobil'), uniqueName('Umbau'), uniqueName('Reflow')];
		for (const name of names) {
			await createCategoryViaApi(page, name);
		}

		await page.goto('/app/settings/kategorien');
		await waitForStableView(page, 'Balamentum');

		const chips = page.locator('li[data-category-id]');
		await expect(chips.filter({ hasText: names[0] })).toHaveCount(1);
		await waitForStableBox(page, chips.first());

		// Bounding-Box statt scrollWidth: Die App-Shell clippt mit overflow-x:hidden, ein Überlauf
		// würde sich dort verbergen (Memory-Muster #1098). Kein Chip ragt über den Viewport.
		const count = await chips.count();
		expect(count).toBeGreaterThanOrEqual(3);
		for (let i = 0; i < count; i++) {
			const box = await chips.nth(i).boundingBox();
			expect(box, `Chip ${i} nicht messbar`).not.toBeNull();
			expect(box!.x + box!.width, `Chip ${i} ragt über 375px hinaus`).toBeLessThanOrEqual(375 + 1);
		}

		// Kein echter horizontaler Scroll-Container innerhalb der Liste (Muster #1258).
		const scroll = await page.locator('.category-list').evaluate(measureHorizontalScroll);
		expect(scroll.scroller, 'horizontal scrollbarer Container in der Kategorie-Liste').toBeNull();

		// AK3: Aktions-Schalter im eigenen Chip sind volle Touch-Ziele.
		const myChip = chips.filter({ hasText: names[0] });
		for (const action of [/bearbeiten/i, /löschen/i]) {
			const box = await myChip.getByRole('button', { name: action }).boundingBox();
			expect(box, `Touch-Ziel ${action} fehlt`).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('AK2 — Bearbeiten und Löschen bleiben je Chip lauffähig', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const nameA = uniqueName('Bearb');
		const nameB = uniqueName('Bleibt');
		await createCategoryViaApi(page, nameA);
		await createCategoryViaApi(page, nameB);

		await page.goto('/app/settings/kategorien');
		await waitForStableView(page, 'Balamentum');

		const chipA = page.locator('li[data-category-id]').filter({ hasText: nameA });
		await expect(chipA).toHaveCount(1);

		// Bearbeiten: Dialog öffnet mit genau dieser Kategorie vorbelegt.
		await chipA.getByRole('button', { name: /bearbeiten/i }).click();
		const dialog = page.locator('kol-dialog');
		await expect(dialog.getByRole('searchbox', { name: 'Name' })).toHaveValue(nameA);
		await dialog.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(dialog).toHaveCount(0);

		// Löschen: Bestätigung nennt die Kategorie, Bestätigen nimmt den Chip aus der Liste.
		await chipA.getByRole('button', { name: /löschen/i }).click();
		await expect(dialog.getByText(`„${nameA}“`)).toBeVisible();
		await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(chipA).toHaveCount(0);
		await expect(page.locator('li[data-category-id]').filter({ hasText: nameB })).toBeVisible();
	});
});
