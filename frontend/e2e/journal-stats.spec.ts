import { expect, test, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Journal-Statistik (#2213, docs/spec/issue-2213.md) gegen das echte Backend: Eintragsanzahl
 * neben dem Balance-Verlauf, Zeitraum und Granularität umschaltbar (AK5) und Mobile-Layout
 * bei 375 px (AK6, Bounding-Box statt scrollWidth — die App-Shell clippt).
 */
const heute = (): string => new Date().toISOString().slice(0, 10);

/** Kalendertag `tage` vor heute als `YYYY-MM-DD` (UTC). */
const vorTagen = (tage: number): string => {
	const datum = new Date();
	datum.setUTCDate(datum.getUTCDate() - tage);
	return datum.toISOString().slice(0, 10);
};

const openStats = async (page: Page, label: string, seed?: (page: Page) => Promise<void>): Promise<void> => {
	await registerOwnSession(page, label);
	await page.goto('/app/');
	await waitForStableView(page);
	// Vor dem Tab-Klick seeden: die Statistik lädt beim Mount des Journal-Tabs.
	if (seed) await seed(page);
	await page.getByRole('tab', { name: 'Journal', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuer Eintrag' })).toBeVisible();
	await openAccordionSection(page, 'Statistik');
};

const seedEntry = async (page: Page, text: string, date?: string, pillarId?: number): Promise<void> => {
	const response = await page.request.post('/api/v1/journal', {
		data: { text, ...(date ? { date } : {}), ...(pillarId !== undefined ? { pillarId } : {}) },
	});
	expect(response.status(), 'Journal-Eintrag muss per API seedbar sein').toBe(201);
};

const statsSection = (page: Page) => page.locator('.journal-stats');

/** Datums-Label eines Fensters, wie `formatDate` in `lib/journalDate.ts` (de-DE, UTC). */
const datumLabel = (tag: string): string =>
	new Date(`${tag}T00:00:00Z`).toLocaleDateString('de-DE', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	});

test.describe('#2213 Journal-Statistik', () => {
	test('AK5: Eintragsanzahl je Säule und gesamt, Zeitraum und Granularität umschaltbar', async ({ page }) => {
		await openStats(page, 'journal-stats', async (current) => {
			const pillars = (await (await current.request.get('/api/v1/pillars')).json()) as { id: number }[];
			await seedEntry(current, 'Eintrag mit Säule', heute(), pillars[0]!.id);
			await seedEntry(current, 'Eintrag ohne Säule', heute());
			// Dritter Eintrag genau eine Woche zurück (gleicher Wochentag, Vorwoche): so landet er garantiert
			// in einem anderen Wochenfenster — 3 Tage rutschten ab Donnerstag ins heutige Fenster (Montag-Beginn).
			await seedEntry(current, 'Früherer Eintrag', vorTagen(7), pillars[0]!.id);
		});

		const stats = statsSection(page);
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();
		await expect(stats.getByText('Gesamt: 1', { exact: true })).toBeVisible();
		await expect(stats.getByText('Ohne Säule: 1', { exact: true })).toBeVisible();

		// Granularität Wochenansicht: Fenster-Label „Woche vom …", Zählwerte bleiben erhalten.
		await stats.locator('kol-input-radio').getByText('Wöchentlich', { exact: true }).click();
		await expect(stats.getByText(/^Woche vom /).first()).toBeVisible();
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();
		await expect(stats.getByText('Ohne Säule: 1', { exact: true })).toBeVisible();

		// Zeitraum auf den heutigen Tag eingrenzen: das Ein-Tages-Fenster bleibt, der Rest fällt weg.
		const dateInputs = stats.locator('kol-input-date input');
		await dateInputs.first().fill(heute());
		await dateInputs.nth(1).fill(heute());
		await expect(stats.getByText(/^Woche vom /)).toHaveCount(0);
		await expect(stats.getByText('Gesamt: 2', { exact: true })).toBeVisible();
		await expect(stats.getByText('Gesamt: 1', { exact: true })).toHaveCount(0);
		await expect(stats.getByText(datumLabel(heute()), { exact: true })).toBeVisible();
	});

	test('AK6: 375 px ohne Überlauf, Bedienelemente mindestens 44 px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openStats(page, 'journal-stats-mobile', async (current) => {
			await seedEntry(current, 'Mobiler Eintrag', heute());
		});

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
