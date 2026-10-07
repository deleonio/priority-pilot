import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * E2E #2210 (AK1/AK3/AK4/AK5): ICS-Adresse in den Einstellungen verbinden → Termin in der Tageskarte
 * der Wochenansicht → Kalender entfernen → Termin weg. Läuft gegen das echte Backend; der ICS-Abruf
 * geschieht serverseitig (`page.route` greift nicht), die Datei liefert ein lokaler HTTP-Stub
 * (`ICS_ALLOW_INTERNAL_HOSTS=1` in `playwright.config.ts`). Bei 375 px prüfen Bounding-Boxen, dass
 * nichts über den Viewport ragt (die App-Shell clippt `overflow-x`, `scrollWidth` taugt nicht).
 */

const TITLE = 'E2E Zahnarzt 2210';
const stamp = (date: Date): string =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

let ics: http.Server;
let icsUrl = '';

test.beforeAll(async () => {
	// Heute 12:00–13:00 UTC: liegt in jeder Zeitzone am selben Kalendertag.
	const start = new Date();
	start.setUTCHours(12, 0, 0, 0);
	const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:e2e-2210@test\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(new Date(start.getTime() + 3_600_000))}\r\nSUMMARY:${TITLE}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
	ics = http.createServer((_req, res) => {
		res.setHeader('Content-Type', 'text/calendar');
		res.end(body);
	});
	await new Promise<void>((resolve) => ics.listen(0, '127.0.0.1', resolve));
	icsUrl = `http://127.0.0.1:${(ics.address() as AddressInfo).port}/privat.ics`;
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => ics.close(() => resolve()));
});

for (const viewport of [
	{ name: '1280 px', width: 1280, height: 900 },
	{ name: '375 px', width: 375, height: 812 },
]) {
	test(`AK1/AK3/AK4/AK5: Kalender verbinden, Termin in der Wochenansicht, entfernen (${viewport.name})`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await registerOwnSession(page, 'calendar-2210');

		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Allgemein');
		await openAccordionSection(page, 'Kalender');
		const addressInput = page.getByLabel('Kalender-Adresse (ICS)');
		await addressInput.fill(icsUrl);
		await page.getByLabel('Name (optional)').fill('E2E Kalender');
		await page.getByRole('button', { name: 'Verbinden' }).click();

		const row = page.getByTestId('calendar-source-row');
		await expect(row).toContainText('E2E Kalender');
		await expect(page.getByTestId('calendar-sources-panel')).not.toContainText('127.0.0.1');
		if (viewport.width === 375) {
			const box = (await page.getByTestId('calendar-sources-panel').boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(-0.5);
			expect(box.x + box.width, 'Kalender-Abschnitt ragt bei 375 px aus dem Viewport').toBeLessThanOrEqual(375.5);
		}

		const openWeek = async (): Promise<void> => {
			await page.goto('/app/?planview=week');
			await waitForStableView(page);
		};
		await openWeek();
		const event = page.locator('.week-view-event', { hasText: TITLE });
		await expect(event).toBeVisible();
		await expect(event).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
		if (viewport.width === 375) {
			const box = (await event.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(-0.5);
			expect(box.x + box.width, 'Termin ragt bei 375 px aus dem Viewport').toBeLessThanOrEqual(375.5);
		}

		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Allgemein');
		await openAccordionSection(page, 'Kalender');
		await page.getByRole('button', { name: /^Entfernen/ }).click();
		await page.getByRole('button', { name: 'Endgültig entfernen' }).click();
		await expect(page.getByTestId('calendar-source-row')).toHaveCount(0);

		await openWeek();
		await expect(page.locator('.week-view-day').first()).toBeVisible();
		await expect(page.locator('.week-view-event')).toHaveCount(0);
	});
}
