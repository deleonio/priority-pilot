import { expect, test, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Journal-Statistik (#2213, docs/spec/issue-2213.md) gegen das echte Backend: Eintragsanzahl
 * neben dem Balance-Verlauf, Zeitraum und Granularität umschaltbar (AK5) und Mobile-Layout
 * bei 375 px (AK6, Bounding-Box statt scrollWidth — die App-Shell clippt).
 */
const heute = (): string => new Date().toISOString().slice(0, 10);

const openStats = async (page: Page, label: string): Promise<void> => {
	await registerOwnSession(page, label);
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Journal', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuer Eintrag' })).toBeVisible();
	await openAccordionSection(page, 'Statistik');
};

const seedEntry = async (page: Page, text: string, date?: string, pillarId?: number): Promise<void> => {
	const response = await page.request.post('/journal', {
		data: { text, ...(date ? { date } : {}), ...(pillarId !== undefined ? { pillarId } : {}) },
	});
	expect(response.status(), 'Journal-Eintrag muss per API seedbar sein').toBe(201);
};

const statsSection = (page: Page) => page.locator('.journal-stats');

test.describe('#2213 Journal-Statistik', () => {
	test('AK5: Eintragsanzahl je Säule und gesamt, Zeitraum und Granularität umschaltbar', async ({ page }) => {
		await openStats(page, 'journal-stats');
		const pillars = (await (await page.request.get('/pillars')).json()) as { id: number }[];
		await seedEntry(page, 'Eintrag mit Säule', heute(), pillars[0]!.id);
		await seedEntry(page, 'Eintrag ohne Säule', heute());

		const stats = statsSection(page);
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();
		await expect(stats.getByText('Ohne Säule: 1', { exact: true })).toBeVisible();
		// Vorbelegter Zeitraum (letzte 28 Tage) listet auch leere Tage mit 0.
		await expect(stats.getByText('Gesamt: 0', { exact: true }).first()).toBeVisible();

		// Granularität Wochenansicht: Fenster-Label „Woche vom …", Summen bleiben.
		await stats.locator('kol-input-radio').getByText('Wöchentlich', { exact: true }).click();
		await expect(stats.getByText(/^Woche vom /).first()).toBeVisible();
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();

		// Zeitraum auf den heutigen Tag eingrenzen: die 0er-Fenster verschwinden.
		const dateInputs = stats.locator('kol-input-date input');
		await dateInputs.first().fill(heute());
		await dateInputs.nth(1).fill(heute());
		await expect(stats.getByText('Gesamt: 0', { exact: true })).toHaveCount(0);
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();
	});

	test('AK6: 375 px ohne Überlauf, Bedienelemente mindestens 44 px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openStats(page, 'journal-stats-mobile');
		await seedEntry(page, 'Mobiler Eintrag', heute());

		const stats = statsSection(page);
		await expect(stats.getByText(/^Gesamt: /).first()).toBeVisible();

		// Sektion bleibt innerhalb des Viewports (nichts geclippt, App-Shell clippt sonst still).
		const box = await stats.boundingBox();
		expect(box, 'Statistik-Sektion sichtbar').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		// Datumseingaben und Radio-Optionszeilen (label.kol-input-radio, #1977-Muster) ≥ 44 px.
		for (const dateInput of await stats.locator('kol-input-date').all()) {
			const inputBox = await dateInput.boundingBox();
			expect(inputBox, 'Datumseingabe sichtbar').not.toBeNull();
			expect(inputBox!.height).toBeGreaterThanOrEqual(44);
		}
		for (const option of await stats.locator('kol-input-radio label.kol-input-radio').all()) {
			const optionBox = await option.boundingBox();
			expect(optionBox, 'Radio-Option sichtbar').not.toBeNull();
			expect(optionBox!.height).toBeGreaterThanOrEqual(44);
		}
	});
});
