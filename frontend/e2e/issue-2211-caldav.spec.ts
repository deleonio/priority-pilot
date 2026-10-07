import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * E2E #2211 (AK7): CalDAV-Kalender in den Einstellungen bei 375 px verbinden — Typ-Wahl, Benutzername,
 * maskiertes App-Passwort. Der Abruf läuft serverseitig gegen einen lokalen CalDAV-Stub (REPORT → 207;
 * `ICS_ALLOW_INTERNAL_HOSTS=1` und `CALDAV_ENCRYPTION_KEY` in `playwright.config.ts`).
 */

const PASSWORD = 'e2e-app-passwort-2211';

let dav: http.Server;
let davUrl = '';

test.beforeAll(async () => {
	dav = http.createServer((req, res) => {
		req.resume();
		res.statusCode = 207;
		res.setHeader('Content-Type', 'application/xml; charset=utf-8');
		res.end('<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:"></d:multistatus>');
	});
	await new Promise<void>((resolve) => dav.listen(0, '127.0.0.1', resolve));
	davUrl = `http://127.0.0.1:${(dav.address() as AddressInfo).port}/dav/cal/`;
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => dav.close(() => resolve()));
});

test('AK7: CalDAV-Kalender bei 375 px verbinden, Passwort maskiert und nirgends sichtbar', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await registerOwnSession(page, 'caldav-2211');

	await page.goto('/app/settings/general');
	await waitForStableView(page, 'Allgemein');
	await openAccordionSection(page, 'Kalender');
	await page.getByRole('radio', { name: 'CalDAV' }).check();
	await page.getByLabel('Kalender-Adresse (CalDAV)').fill(davUrl);
	await page.getByLabel('Benutzername').fill('max@example.org');
	const password = page.getByLabel('App-Passwort');
	await expect(password).toHaveAttribute('type', 'password');
	await password.fill(PASSWORD);
	await page.getByLabel('Name (optional)').fill('E2E CalDAV');

	const panel = page.getByTestId('calendar-sources-panel');
	const box = (await panel.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(-0.5);
	expect(box.x + box.width, 'Kalender-Abschnitt ragt bei 375 px aus dem Viewport').toBeLessThanOrEqual(375.5);

	await page.getByRole('button', { name: 'Verbinden' }).click();
	await expect(page.getByTestId('calendar-source-row')).toContainText('E2E CalDAV · CalDAV');
	await expect(password).toHaveValue('');
	expect(await page.content()).not.toContain(PASSWORD);
	await expect(panel).not.toContainText('127.0.0.1');
});
