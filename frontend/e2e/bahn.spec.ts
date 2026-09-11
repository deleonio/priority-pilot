import type { Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#225) für die öffentliche Route `/bahn` mit Bahn-Routenplaner-UI.
 *
 * AK 1 — Öffentlicher Zugang: `/bahn` ohne Login erreichbar (kein Redirect, keine Auth-Gate).
 * AK 2 — Autocomplete: Eingabe „Berlin" im Start-Feld → Vorschlagsliste erscheint.
 * AK 3 — Verbindungssuche: Start + Ziel gesetzt, Suche ausgelöst → Verbindungskarte sichtbar.
 * AK 4 — Fehlerzustand: Backend antwortet mit Fehler → nutzerfreundliche Fehlermeldung.
 *
 * Alle Transit-API-Routen werden gemockt (kein echtes Transitous-Backend nötig).
 * `/auth/me` wird NICHT gemockt — `/bahn` soll ohne Auth-Check funktionieren.
 */

const GEOCODE_BERLIN = [
	{ id: 'de:11000:900003201', name: 'Berlin Hbf', lat: 52.5250839, lon: 13.3696281 },
	{ id: 'de:11000:900100001', name: 'Berlin Ostbahnhof', lat: 52.5102048, lon: 13.4346554 },
];

const GEOCODE_MUENCHEN = [{ id: 'de:09162:2', name: 'München Hbf', lat: 48.1402033, lon: 11.5600363 }];

const PLAN_RESULT = {
	itineraries: [
		{
			duration: 6300,
			startTime: '2026-07-01T10:00:00+02:00',
			endTime: '2026-07-01T11:45:00+02:00',
			transfers: 0,
			legs: [
				{
					mode: 'RAIL',
					from: { name: 'Berlin Hbf', departure: '2026-07-01T10:00:00+02:00' },
					to: { name: 'München Hbf', arrival: '2026-07-01T11:45:00+02:00' },
					delay: 0,
				},
			],
		},
	],
};

test.describe('AK 1 — Öffentlicher Zugang (#225)', () => {
	test('AK1a: /bahn ohne Login zeigt Routenplaner-UI (kein Login-Redirect)', async ({ page }) => {
		// auth/me wird NICHT gemockt — die Route muss ohne Auth-Check funktionieren.
		await page.goto('/bahn');

		// Routenplaner-Überschrift muss sichtbar sein …
		await expect(page.getByRole('heading', { name: /Routenplaner/i })).toBeVisible();
		// … Start- und Ziel-Eingabefelder müssen vorhanden sein …
		await expect(page.getByLabel(/Startbahnhof|Start/i)).toBeVisible();
		await expect(page.getByLabel(/Zielbahnhof|Ziel/i)).toBeVisible();
		// … Login-Button darf NICHT erscheinen.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});

	test('AK1b: /bahn ist unabhängig vom Auth-Zustand erreichbar (explizit 401)', async ({ page }) => {
		// Selbst wenn auth/me 401 zurückgibt, muss /bahn funktionieren.
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) }),
		);
		await page.goto('/bahn');

		await expect(page.getByRole('heading', { name: /Routenplaner/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});
});

test.describe('AK 2 — Autocomplete (#225)', () => {
	test('AK2: Eingabe „Berlin" im Start-Feld → mindestens ein Vorschlag erscheint', async ({ page }) => {
		await page.route('**/api/transit/geocode**', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(GEOCODE_BERLIN),
			}),
		);

		await page.goto('/bahn');
		await expect(page.getByRole('heading', { name: /Routenplaner/i })).toBeVisible();

		const startInput = page.getByLabel(/Startbahnhof|Start/i);
		await startInput.fill('Berlin');

		// Nach Debounce-Zeit muss mindestens ein Vorschlag sichtbar sein.
		await expect(page.getByRole('option', { name: /Berlin/i }).first()).toBeVisible({ timeout: 3000 });
		// Die gemockten Daten enthalten „Berlin Hbf" — dieser spezifische Eintrag muss erscheinen.
		await expect(page.getByRole('option', { name: /Berlin Hbf/i })).toBeVisible();
	});
});

test.describe('AK 3 — Verbindungssuche (#225)', () => {
	test('AK3: Start + Ziel gesetzt, Suche ausgelöst → Verbindungskarte mit Abfahrt/Ankunft/Dauer', async ({ page }) => {
		await page.route('**/api/transit/geocode**', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([...GEOCODE_BERLIN, ...GEOCODE_MUENCHEN]),
			}),
		);
		await page.route('**/api/transit/plan**', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(PLAN_RESULT),
			}),
		);

		await page.goto('/bahn');
		await expect(page.getByRole('heading', { name: /Routenplaner/i })).toBeVisible();

		// Start auswählen
		const startInput = page.getByLabel(/Startbahnhof|Start/i);
		await startInput.fill('Berlin');
		await expect(page.getByRole('option', { name: /Berlin Hbf/i })).toBeVisible({ timeout: 3000 });
		await page.getByRole('option', { name: /Berlin Hbf/i }).click();

		// Ziel auswählen
		const zielInput = page.getByLabel(/Zielbahnhof|Ziel/i);
		await zielInput.fill('München');
		await expect(page.getByRole('option', { name: /München Hbf/i })).toBeVisible({ timeout: 3000 });
		await page.getByRole('option', { name: /München Hbf/i }).click();

		// Suche starten
		await page.getByRole('button', { name: /Verbindungen suchen/i }).click();

		// Mindestens eine Verbindungskarte muss erscheinen.
		const connectionCard = page.locator('[data-testid="connection-card"]').first();
		await expect(connectionCard).toBeVisible({ timeout: 5000 });

		// Abfahrtszeit, Ankunftszeit und Dauer müssen sichtbar sein.
		await expect(page.getByText(/10:00/)).toBeVisible();
		await expect(page.getByText(/11:45/)).toBeVisible();
		// Dauer: 6300 Sekunden = 1h 45min
		await expect(page.getByText(/1.{0,5}45|105\s*min/i)).toBeVisible();
	});
});

test.describe('AK 4 — Fehlerzustand (#225)', () => {
	test('AK4: Backend-Fehler bei Suche → nutzerfreundliche Fehlermeldung, kein JS-Fehler', async ({ page }) => {
		await page.route('**/api/transit/geocode**', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(GEOCODE_BERLIN),
			}),
		);
		await page.route('**/api/transit/plan**', (route: Route) =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Bad Gateway — Upstream nicht erreichbar' }),
			}),
		);

		const uncaughtErrors: string[] = [];
		page.on('pageerror', (err) => uncaughtErrors.push(err.message));

		await page.goto('/bahn');
		await expect(page.getByRole('heading', { name: /Routenplaner/i })).toBeVisible();

		const startInput = page.getByLabel(/Startbahnhof|Start/i);
		await startInput.fill('Berlin');
		await expect(page.getByRole('option', { name: /Berlin Hbf/i })).toBeVisible({ timeout: 3000 });
		await page.getByRole('option', { name: /Berlin Hbf/i }).click();

		const zielInput = page.getByLabel(/Zielbahnhof|Ziel/i);
		await zielInput.fill('Berlin');
		await expect(page.getByRole('option', { name: /Berlin/i }).first()).toBeVisible({ timeout: 3000 });
		await page.getByRole('option', { name: /Berlin Ostbahnhof/i }).click();

		await page.getByRole('button', { name: /Verbindungen suchen/i }).click();

		// Fehlermeldung muss sichtbar sein (kein „undefined", kein Stack-Trace, keine leere UI).
		await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
		// Fehlermeldung soll Deutsch und verständlich sein.
		await expect(page.getByRole('alert')).toContainText(/Fehler|nicht erreichbar|Verbindung|Problem/i);

		// Kein unbehandelter JS-Fehler.
		expect(uncaughtErrors).toHaveLength(0);
	});
});
