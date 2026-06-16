import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ApiFixture } from './fixtures';

/** JSON-Antwort für eine gemockte Route bauen. */
const json = (body: unknown, status = 200) => ({
	status,
	contentType: 'application/json',
	body: JSON.stringify(body),
});

/** Endpunkte, die optional einen 500-Fehler liefern sollen (für den Fehlerzustand). */
export interface ApiErrorOverrides {
	tasks?: boolean;
	pillars?: boolean;
	forest?: boolean;
	next?: boolean;
}

/**
 * Registriert die API-Mocks für alle vier Endpunkte. **Muss vor `page.goto('/')` aufgerufen werden**,
 * damit der initiale Lade-Schwung der App (`App.tsx` lädt `/tasks`, `/forest`, `/next`, `/pillars`
 * parallel) abgefangen wird und der Vite-Proxy gar nicht erst getroffen wird (kein Backend nötig).
 *
 * Pfad-Matching bewusst exakt am Pfad-Ende (`**\/tasks` ohne nachfolgenden Slash), damit z. B.
 * `/tasks/{id}` nicht versehentlich getroffen wird (für die Snapshots ohnehin irrelevant).
 */
export const mockApi = async (
	page: Page,
	fixture: ApiFixture,
	errors: ApiErrorOverrides = {},
): Promise<void> => {
	const fail = (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
		route.fulfill(json({ message: 'Interner Serverfehler (Datenbank nicht erreichbar).' }, 500));

	await page.route('**/tasks', (route) =>
		errors.tasks === true ? fail(route) : route.fulfill(json(fixture.tasks)),
	);
	await page.route('**/pillars', (route) =>
		errors.pillars === true ? fail(route) : route.fulfill(json(fixture.pillars)),
	);
	await page.route('**/forest', (route) =>
		errors.forest === true ? fail(route) : route.fulfill(json(fixture.forest)),
	);
	await page.route('**/next', (route) =>
		errors.next === true ? fail(route) : route.fulfill(json(fixture.next)),
	);
};

/**
 * Wartet, bis die Ansicht für einen stabilen Screenshot bereit ist:
 *  1. ein bekanntes, stabiles Element ist sichtbar (Standard: KolHeading „Priority Pilot"),
 *  2. die KoliBri-Web-Components sind hydriert (asynchrone Registrierung in `main.tsx`),
 *  3. die Schriftarten — inkl. KolIcons-Font — sind geladen (`document.fonts.ready`).
 */
export const waitForStableView = async (page: Page, readyText = 'Priority Pilot'): Promise<void> => {
	// 1. Stabiles Element abwarten (rendert erst nach React-Mount + KoliBri-Upgrade sichtbar).
	await expect(page.getByText(readyText, { exact: true }).first()).toBeVisible();

	// 2. Auf das Upgrade der KoliBri-Custom-Elements warten: ein definiertes Element (`kol-button`)
	//    muss registriert sein und sein Shadow-DOM aufgebaut haben. Solange noch ein nicht-aufgelöstes
	//    Custom-Element existiert (`:not(:defined)`), ist die Hydration nicht abgeschlossen.
	await page.waitForFunction(() => {
		const pending = document.querySelectorAll(':not(:defined)');
		if (pending.length > 0) {
			return false;
		}
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen im Screenshot.
	await page.evaluate(() => document.fonts.ready);
};
