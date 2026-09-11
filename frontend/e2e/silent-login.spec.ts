import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für Issue #396 — „Automatisches Login", PR B (Silent Google Login via `prompt=none`).
 *
 * Ziel: Ein Nutzer mit gültiger Google-Session soll ohne Klick angemeldet werden. Die App versucht im
 * Zustand `unauthenticated` (einmalig, per Top-Level-Redirect) einen stillen Login über
 * `GET /auth/google/silent`. Schlägt dieser fehl (Interaktion nötig / Consent / neue Session), landet
 * der Nutzer an der manuellen `LoginPage` (Rückkehr `?silent=unavailable`) — ohne erneuten stillen
 * Versuch (Loop-Guard). Nach einem aktiven Logout wird ein stiller Re-Login unterdrückt
 * („gerade abgemeldet"-Marker), sonst wäre ein Ausloggen praktisch unmöglich.
 *
 * Wie in `login.spec.ts`/`logout.spec.ts` wird der Auth-Zustand per `page.route` gemockt, da der echte
 * Google-OAuth-Flow in der E2E-Umgebung nicht deterministisch durchlaufbar ist:
 *   - `GET /auth/me`            → 401 (unauthentifiziert) bzw. 200+User (authentifiziert)
 *   - `GET /auth/google/silent` → simuliert den stillen Ausgang (Erfolg / Interaktion erforderlich)
 *
 * Diese Tests sind ROT, bis PR B den stillen Einstieg + Loop-Guard + Logout-Sperre umsetzt.
 * AK7 (Mobile-First) ist ein Non-Regression-Test: er ist heute grün und sichert, dass die neuen
 * Login-Mechanismen das 375px-Layout nicht kaputt machen.
 */

const DISPLAY_NAME = 'Peter';
const USER = { id: 1, name: DISPLAY_NAME, email: 'peter@example.com' };

const SAMPLE_TASK = {
	id: 1,
	title: 'T1',
	status: 'open',
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

const fulfillJson = (body: unknown) => ({
	status: 200,
	contentType: 'application/json',
	body: JSON.stringify(body),
});

const UNAUTHENTICATED = {
	status: 401,
	contentType: 'application/json',
	body: JSON.stringify({ message: 'Unauthorized' }),
};

/** Antwortet auf `GET /auth/me` mit 401 (unauthentifiziert) → Login-Seite bzw. stiller Versuch. */
const mockUnauthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) => route.fulfill(UNAUTHENTICATED));
};

/**
 * Stubt die fachlichen Lade-Endpunkte so, dass die App in die eingeloggte Dashboard-Ansicht rendert
 * (mind. ein Task ⇒ kein EmptyState). Auth-spezifische Routen setzt jeder Test selbst.
 */
const stubAppData = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/tasks', (route) =>
		route.request().method() === 'GET' ? route.fulfill(fulfillJson([SAMPLE_TASK])) : route.continue(),
	);
	await page.route('**/api/v1/forest', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/next', (route) => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/v1/suggestions', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/pillars', (route) => route.fulfill(fulfillJson([])));
};

test.describe('#396 PR B — Silent Google Login (prompt=none)', () => {
	/**
	 * AK3: Bei fehlender App-Session (401) und ohne bisherigen stillen Versuch wird der stille Login
	 * angestoßen — die App steuert `/auth/google/silent` an, statt sofort den manuellen Button zu zeigen.
	 * Genau ein Versuch (keine Endlosschleife).
	 */
	test('AK3: Bei fehlender App-Session wird /auth/google/silent genau einmal angesteuert', async ({ page }) => {
		await mockUnauthenticated(page);
		let silentCount = 0;
		// Silent-Endpunkt abfangen, zählen und auf die manuelle Login-Seite weiterleiten
		// (simuliert „Interaktion erforderlich"), damit der Test deterministisch terminiert.
		await page.route('**/auth/google/silent*', (route) => {
			silentCount += 1;
			route.fulfill({ status: 302, headers: { Location: '/?silent=unavailable' } });
		});

		await page.goto('/');

		// Heute (ROT): es gibt keinen stillen Einstieg → silentCount bleibt 0 → Poll läuft in Timeout.
		await expect.poll(() => silentCount, { timeout: 5000 }).toBe(1);

		// Kein zweiter Versuch (Loop-Guard darf nicht endlos weiterleiten).
		await page.waitForTimeout(500);
		expect(silentCount).toBe(1);
	});

	/**
	 * AK4: Kehrt der stille Versuch mit „Interaktion erforderlich" zurück (`?silent=unavailable`),
	 * erscheint die manuelle LoginPage — OHNE dass der stille Versuch erneut angestoßen wird
	 * (Loop-Guard). Round-Trip: erst `/` (still wird ausgelöst) → Rückkehr `/?silent=unavailable`.
	 */
	test('AK4: Nach gescheitertem stillen Versuch (?silent=unavailable) erscheint die manuelle LoginPage ohne Wiederholung', async ({
		page,
	}) => {
		await mockUnauthenticated(page);
		let silentCount = 0;
		await page.route('**/auth/google/silent*', (route) => {
			silentCount += 1;
			route.fulfill({ status: 302, headers: { Location: '/?silent=unavailable' } });
		});

		await page.goto('/');

		// Erster stiller Versuch wird ausgelöst (ROT heute: bleibt aus).
		await expect.poll(() => silentCount, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

		// … terminiert an der manuellen Login-Seite …
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		await expect(page).toHaveURL(/silent=unavailable/);

		// … und wird NICHT erneut angestoßen (Loop-Guard): insgesamt genau ein Versuch.
		await page.waitForTimeout(500);
		expect(silentCount).toBe(1);
	});

	/**
	 * AK5: Ist der stille Login erfolgreich (Google-Session gültig, Consent erteilt), wird der Nutzer
	 * ohne eigenen Klick angemeldet und landet direkt in der Haupt-App.
	 */
	test('AK5: Bei erfolgreichem stillen Login wird der Nutzer ohne Klick angemeldet (Haupt-App)', async ({ page }) => {
		await stubAppData(page);
		let silentDone = false;
		// /auth/me: vor dem stillen Login 401, danach 200 (Session wurde serverseitig etabliert).
		await page.route('**/auth/me', (route) => route.fulfill(silentDone ? fulfillJson(USER) : UNAUTHENTICATED));
		// Stiller Login erfolgreich: etabliert die Session (silentDone) und leitet zurück zur App.
		await page.route('**/auth/google/silent*', (route) => {
			silentDone = true;
			route.fulfill({ status: 302, headers: { Location: '/' } });
		});

		await page.goto('/');

		// Haupt-App erscheint (Nutzer angemeldet) — ohne Klick auf den manuellen Login-Button.
		// Heute (ROT): stiller Versuch bleibt aus → /auth/me bleibt 401 → LoginPage → „Dashboard" nie sichtbar.
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: /Login with Google/i })).toHaveCount(0);
	});

	/**
	 * AK6 (Logout-Sperre): Klickt der Nutzer „Abmelden", wird beim anschließenden Login-Screen KEIN
	 * stiller Re-Login ausgelöst (sonst wäre ein Ausloggen praktisch unmöglich). Vertragsannahme: nach
	 * `handleLogout()` setzt die App einen „gerade abgemeldet"-Marker im `sessionStorage`
	 * (Schlüssel `pp_just_logged_out`), der den nächsten stillen Versuch unterdrückt.
	 */
	test('AK6 (Logout-Sperre): Nach Abmelden wird kein stiller Re-Login ausgelöst', async ({ page }) => {
		await stubAppData(page);
		let sessionActive = true;
		let silentCount = 0;
		await page.route('**/auth/me', (route) => route.fulfill(sessionActive ? fulfillJson(USER) : UNAUTHENTICATED));
		await page.route('**/auth/logout', (route) => {
			sessionActive = false;
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});
		await page.route('**/auth/google/silent*', (route) => {
			silentCount += 1;
			route.fulfill({ status: 302, headers: { Location: '/?silent=unavailable' } });
		});

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		// Nach dem Logout landet der Nutzer auf der Login-Seite …
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();

		// … und es wird KEIN stiller Re-Login ausgelöst (Logout-Sperre).
		await page.waitForTimeout(800);
		expect(silentCount).toBe(0);

		// „gerade abgemeldet"-Marker muss gesetzt sein (heute ROT: Marker fehlt komplett).
		await expect.poll(async () => page.evaluate(() => sessionStorage.getItem('pp_just_logged_out'))).toBeTruthy();
	});

	/**
	 * AK7 (Mobile-First 375px): Die Login-Seite bleibt bei 375px ohne horizontales Scrollen bedienbar
	 * (Muster `login.spec.ts`). Non-Regression-Test: sichert, dass die neuen Silent-Login-Mechanismen
	 * das schmale Layout nicht brechen.
	 */
	test('AK7 (Mobile-First 375px): Login-Seite ohne horizontales Scrollen bedienbar', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		const loginButton = page.getByRole('button', { name: /Login with Google/i });
		await expect(loginButton).toBeVisible();
		await expect(loginButton).toBeEnabled();

		// Kein horizontales Scrollen: der Seiteninhalt passt in den 375px-Viewport.
		const overflow = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));
		expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
	});
});
