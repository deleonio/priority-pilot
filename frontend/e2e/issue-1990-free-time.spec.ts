import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * E2E #1990 (AK5/AK6, Spec docs/spec/issue-1990.md): Mit verbundenem Kalender und einer offenen,
 * kleinen Aufgabe zeigt das Dashboard die Karte „Freie Zeit" (Zeitraum + Aufgabentitel). Bei 375 px
 * prüfen Bounding-Boxen, dass nichts über den Viewport ragt (App-Shell clippt, scrollWidth taugt nicht).
 * Die Lückenberechnung läuft serverseitig ab „jetzt" bis 22:00 — nach 21:00 Ortszeit gibt es keine
 * 30-Min-Lücke mehr, dann wird übersprungen.
 */

const TASK = 'E2E Freie Zeit 1990';
const stamp = (date: Date): string =>
	date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

let ics: http.Server;
let icsUrl = '';

test.beforeAll(async () => {
	// Termin morgen: verbindet den Kalender, blockiert aber nicht das heutige Fenster.
	const start = new Date(Date.now() + 24 * 3_600_000);
	const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:e2e-1990@test\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(new Date(start.getTime() + 3_600_000))}\r\nSUMMARY:Morgen\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
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
	test(`AK5/AK6: Karte „Freie Zeit" mit Zeitraum und Aufgabe (${viewport.name})`, async ({ page }) => {
		test.skip(new Date().getHours() >= 21, 'Keine 30-Min-Lücke mehr vor 22:00');
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await registerOwnSession(page, 'free-time-1990');

		const source = await page.request.post('/api/v1/calendar-sources', { data: { url: icsUrl, name: 'E2E' } });
		expect(source.ok(), 'Kalenderquelle muss angelegt werden').toBeTruthy();
		const task = await page.request.post('/api/v1/tasks', { data: { title: TASK, estimatedEffort: 0.1 } });
		expect(task.ok(), 'Aufgabe muss angelegt werden').toBeTruthy();

		await page.goto('/app/');
		await waitForStableView(page);
		const card = page.getByTestId('free-time-card');
		await expect(card).toBeVisible();
		await expect(card).toContainText('Freie Zeit');
		await expect(card).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
		await expect(card).toContainText(TASK);
		if (viewport.width === 375) {
			const box = (await card.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(-0.5);
			expect(box.x + box.width, 'Karte ragt bei 375 px aus dem Viewport').toBeLessThanOrEqual(375.5);
		}
	});
}

test('AK4: ohne Kalender keine Karte „Freie Zeit"', async ({ page }) => {
	await registerOwnSession(page, 'free-time-none-1990');
	await page.goto('/app/');
	await waitForStableView(page);
	await expect(page.getByTestId('free-time-card')).toHaveCount(0);
});
