import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1231 — „Session abgelaufen: Dialog zum Neuladen der App anbieten".
 *
 * **Spec-Bezug:** docs/spec/issue-1231.md (Journey + AK1/AK4/AK5).
 *
 * Ablauf: Auf der Deep-Route `/aufgaben` schlägt eine API-Aktion mit Session-401 fehl
 * (`POST /api/v1/tasks/parse-text` → 401 „Nicht eingeloggt.", Muster issue-620-Spec für den
 * Schnell-Dialog). Vertrag: Die Fehlermeldung der Aktion bleibt sichtbar UND der globale
 * Dialog „Session abgelaufen" erscheint. Klick auf „Neu laden" → Reload → `/auth/me` 401 →
 * stiller Login mit `?returnTo=/aufgaben` (erfolgreich gemockt) → Landung auf derselben
 * Route (AK4). AK3 wird über den vorab gesetzten `pp_silent_attempted`-Marker eingeklagt:
 * Der erste authentifizierte Ladevorgang muss ihn zurücksetzen, sonst würde der stille
 * Versuch nach dem Reload unterbleiben.
 *
 * Auth-Mocks wie in silent-login.spec.ts (echter OAuth-Zyklus nicht deterministisch).
 */

const USER = { id: 1, displayName: 'Peter', email: 'peter@example.com' };

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

/** Stubt die Lade-Endpunkte, damit die Haupt-App (mit Task) rendert. */
const stubAppData = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/tasks', (route: Route) =>
		route.request().method() === 'GET' ? route.fulfill(fulfillJson([SAMPLE_TASK])) : route.continue(),
	);
	await page.route('**/api/v1/forest', (route: Route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/next', (route: Route) => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/v1/suggestions', (route: Route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/pillars', (route: Route) => route.fulfill(fulfillJson([])));
};

/**
 * Zustandsvollständiger Auth-Kreis: `/auth/me` je nach `authed`-Flag, Silent-Einstieg
 * erfasst seine URL (returnTo-Assertion, AK4), meldet still erfolgreich zurück auf `/aufgaben`.
 */
const mockAuthCycle = (page: Page): { authed: { value: boolean }; silentReturnTo: () => string | null } => {
	const state = { authed: true, returnTo: null as string | null };
	void page.route('**/auth/me', (route: Route) =>
		route.fulfill(
			state.authed
				? fulfillJson(USER)
				: { status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Nicht eingeloggt.' }) },
		),
	);
	void page.route('**/auth/google/silent**', (route: Route) => {
		const url = new URL(route.request().url());
		state.returnTo = url.searchParams.get('returnTo');
		// Stiller Login erfolgreich: Session etabliert, Rückkehr auf die App-Route.
		state.authed = true;
		route.fulfill({ status: 302, headers: { Location: '/aufgaben' } });
	});
	return { authed: state, silentReturnTo: () => state.returnTo };
};

/** Läuft die Journey bis zum offenen Session-Dialog (Fehlermeldung der Aktion bleibt sichtbar). */
const openSessionDialog = async (page: Page): Promise<void> => {
	// API-Aktion schlägt mit Session-401 fehl (Muster: issue-620-Spec, Schnell-Dialog).
	await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Nicht eingeloggt.' }),
		}),
	);

	await page.goto('/aufgaben');
	await waitForStableView(page, 'Aufgaben');

	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Session läuft ab');
	await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

	// AK1: ursprüngliche Fehlermeldung (Session-Text aus #948) bleibt sichtbar …
	await expect(page.getByText(/Bitte melde dich erneut an/).first()).toBeVisible();
	// … UND der globale Dialog „Session abgelaufen" erscheint.
	await expect(page.getByRole('dialog', { name: /Session abgelaufen/i })).toBeVisible();
};

test.describe('#1231 — Session-Expired-Dialog mit stillen Re-Login', () => {
	test('AK1+AK4: Session-401 zeigt Dialog neben Fehlermeldung; nach „Neu laden" Landung auf derselben Route', async ({
		page,
	}) => {
		await stubAppData(page);
		const { authed, silentReturnTo } = mockAuthCycle(page);

		// AK3: In dieser Browser-Session lief bereits ein stiller Versuch (Marker). Der erste
		// authentifizierte Ladevorgang muss ihn zurücksetzen (Spec: Root-Reset bei erfolgreicher Auth),
		// sonst unterbliebe der stille Versuch nach dem Reload.
		await page.addInitScript(() => sessionStorage.setItem('pp_silent_attempted', '1'));

		await openSessionDialog(page);

		// Session ist abgelaufen: nach dem Reload meldet /auth/me 401.
		authed.value = false;
		await page.getByTestId('session-reload').click();

		// Reload → 401 → stiller Login (erfolgreich) → Rückkehr auf dieselbe Route (AK4).
		await expect(page).toHaveURL(/\/aufgaben$/, { timeout: 10_000 });
		await waitForStableView(page, 'Aufgaben');
		// AK4 (Frontend-Hälfte): der Silent-Einstieg trägt den Return-Path der aktuellen Route.
		await expect.poll(() => silentReturnTo()).toBe('/aufgaben');
	});

	test('AK5 (375px): Dialog vollständig bedienbar, „Neu laden" per Tastatur (Fokus + Enter) auslösbar', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await stubAppData(page);
		const { authed } = mockAuthCycle(page);

		await openSessionDialog(page);

		// Layout (Memory 2026-08-24: Bounding-Box statt scrollWidth): Dialog clippt nichts.
		const dialog = page.getByRole('dialog', { name: /Session abgelaufen/i });
		const box = await dialog.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		// Tastatur: Reload-Button ist fokussiert (Fokus-Falle des Modals), Enter löst aus.
		const reload = page.getByTestId('session-reload');
		await expect(reload).toBeVisible();
		await expect(reload).toBeEnabled();
		authed.value = false;
		await expect(reload).toBeFocused();
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/aufgaben$/, { timeout: 10_000 });
	});
});
