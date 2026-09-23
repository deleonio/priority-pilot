import type { Locator, Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * E2E-Spec für das Rollensystem admin/member (Fixup PR #1300, Finding #3): Tab „Nutzerverwaltung"
 * bei 375px — Sichtbarkeit je Rolle und Rollenwechsel-Radiogruppe ohne horizontalen Überlauf.
 *
 * `/auth/me` und die `/admin/users`-Endpunkte werden gemockt (Muster `fixtures.ts`): Die
 * Backend-Autorisierung selbst deckt `server/src/express/admin.api.test.ts` ab, hier geht es
 * um den Frontend-Vertrag (Tab-Sichtbarkeit, Layout bei 375px).
 */

/**
 * Findet eine Rollen-Option (Admin/Mitglied/Tester) in der Zeile eines Nutzers — als `radio`
 * oder (Fallback) als `option`/`button`, da die exakte ARIA-Rolle des KoliBri-Webcomponents
 * `kol-input-radio` nicht fest zugesichert ist. Muster: `appearanceOption` in
 * `settings-appearance.spec.ts` (#1566: Rollen-Radiogruppe ersetzt den alten Toggle-Button).
 */
const roleOption = (row: Locator, name: string): Locator =>
	row.getByRole('radio', { name }).or(row.getByRole('option', { name })).or(row.getByRole('button', { name }));

const MOBILE = { width: 375, height: 812 } as const;

/** Mutierbare Fixture (die Rolle wechselt im zustandsbehafteten Mock unten). */
type FixtureUser = { id: number; displayName: string; email: string; role: 'admin' | 'member' };

const ADMIN_USER: FixtureUser = { id: 1, displayName: 'Anna Admin', email: 'anna@example.com', role: 'admin' };
const MEMBER_USER: FixtureUser = { id: 2, displayName: 'Test User', email: 'test@example.com', role: 'member' };

const mockAuthMe = async (page: Page, user: FixtureUser) => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

/**
 * Zustandsbehafteter Mock der Admin-API: `AdminUsersSection` lädt nach jedem PATCH die Liste neu —
 * die GET-Antwort muss den Rollenwechsel also widerspiegeln, sonst bliebe das Button-Label stehen.
 * Frischer Zustand pro Aufruf (kein Test-übergreifendes Leck).
 */
const mockAdminUsers = async (page: Page): Promise<void> => {
	const users = [
		{ ...ADMIN_USER, createdAt: '2026-01-01T00:00:00Z' },
		{ ...MEMBER_USER, createdAt: '2026-01-02T00:00:00Z' },
	];
	await page.route('**/api/v1/admin/users', (route: Route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
	});
	await page.route('**/api/v1/admin/users/*/role', (route: Route) => {
		const id = Number(/\/admin\/users\/(\d+)\/role/.exec(route.request().url())?.[1]);
		const { role } = route.request().postDataJSON() as { role: 'admin' | 'member' };
		const target = users.find((user) => user.id === id);
		if (!target) {
			return route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'nicht gefunden' }),
			});
		}
		target.role = role;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(target) });
	});
};

test.describe('#1300 Rollensystem admin/member — Tab „Nutzerverwaltung" bei 375px', () => {
	test('Member sieht den Tab „Nutzerverwaltung" nicht', async ({ page }) => {
		await mockAuthMe(page, MEMBER_USER);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');

		await expect(page.getByRole('tab', { name: 'Nutzerverwaltung' })).toHaveCount(0);
	});

	test('Member per Deep-Link /settings/nutzer landet auf „Säulen" statt auf einem leeren Panel', async ({ page }) => {
		await mockAuthMe(page, MEMBER_USER);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		await expect(page.getByRole('tab', { name: 'Nutzerverwaltung' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Säulen' })).toHaveAttribute('aria-selected', 'true');
	});

	test('Admin sieht den Tab „Nutzerverwaltung", die Nutzerliste lädt ohne horizontalen Überlauf', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		const tab = page.getByRole('tab', { name: 'Nutzerverwaltung' });
		await expect(tab).toBeVisible();
		await expect(tab).toHaveAttribute('aria-selected', 'true');

		await expect(page.getByText('Anna Admin', { exact: true })).toBeVisible();
		await expect(page.getByText('Test User', { exact: true })).toBeVisible();

		const testUserRow = page.locator('li.admin-user', { hasText: 'Test User' });
		const adminOption = roleOption(testUserRow, 'Admin');
		await expect(adminOption).toBeVisible();

		// Touch-Target sitzt nicht auf dem nativen `<input>` selbst (das misst nur `--input-size`,
		// deutlich unter 44px), sondern auf dem umschließenden `<label>`, das KoliBri per
		// `--a11y-min-size` auf mindestens 44px setzt (`kol-input-radio.js`) — das Label ist die
		// tatsächlich tappbare Fläche (native Label-Klick-Weiterleitung an den Input).
		const adminOptionTarget = adminOption.locator('xpath=parent::label');
		const box = await adminOptionTarget.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.height, 'Rollen-Option mindestens 44px hoch (Touch-Target)').toBeGreaterThanOrEqual(44 - 0.5);

		const panel = page.locator('.settings-admin-users');
		const { scroller } = await panel.evaluate(measureHorizontalScroll);
		expect(scroller, 'kein horizontaler Scroll-Container im Nutzerverwaltungs-Panel bei 375px').toBeNull();

		const [response] = await Promise.all([page.waitForResponse('**/api/v1/admin/users/*/role'), adminOption.click()]);
		expect(response.status(), 'Rollenwechsel-Antwort muss 200 sein').toBe(200);
		// Gezielt der `radio`-Rolle zugewiesen (kein `option`/`button`-Fallback wie bei `roleOption`):
		// `toBeChecked()` setzt eine Checkbox/Radio-Semantik voraus und würde über den Fallback einen
		// technischen statt einen fachlichen Fehler werfen (PR #1616 Finding #3).
		await expect(testUserRow.getByRole('radio', { name: 'Admin' })).toBeChecked();
	});

	// Fixup PR #1602, Finding #3: 375px-Nachweis der zweistufigen Bestätigungs-Dialogleiste
	// (Säulenverteilung neu berechnen) — zwei Modals mit je zwei Buttons und ein Button mit sehr
	// langem Label sind genau der Fall, der auf Telefonbreite umbricht.
	test('Dialogleiste „Säulenverteilung neu berechnen" bricht bei 375px nicht um', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		// Regex statt Glob: der Aufruf trägt seit #1614 die Statusauswahl als Query (`?status=all`),
		// und ein Glob ohne Platzhalter am Ende matcht eine URL mit Query-String nicht mehr.
		// Verankert auf das Ende, damit der GET auf `…/reassign-pillars/status` (eigener Mock
		// unten) nicht mitgefangen und mit der POST-Antwort beantwortet wird (Review-Fund #4).
		// Test-Pflege #1642: der POST startet nur den Hintergrundlauf (202), `.../status` meldet danach
		// einmal `running` mit Fortschritt und anschließend das Ergebnis.
		let startedAt: string | null = null;
		let statusPolls = 0;
		await page.route(/\/api\/v1\/admin\/tasks\/reassign-pillars(\?[^/]*)?$/, (route: Route) => {
			startedAt = new Date().toISOString();
			return route.fulfill({
				status: 202,
				contentType: 'application/json',
				body: JSON.stringify({ running: true, processed: 0 }),
			});
		});
		await page.route(/\/api\/v1\/admin\/tasks\/reassign-pillars\/status/, (route: Route) => {
			if (startedAt !== null) {
				statusPolls += 1;
			}
			const body =
				startedAt === null
					? { total: 0, pending: 0, startedAt: null, running: false }
					: statusPolls === 1
						? { total: 3, pending: 2, startedAt, running: true, processed: 1 }
						: {
								total: 3,
								pending: 0,
								startedAt,
								running: false,
								processed: 3,
								result: { updated: 2, failed: 0, skipped: 1, quotaExhausted: false },
							};
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
		});
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		await page.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }).click();
		await expect(page.getByRole('heading', { name: 'Säulenverteilung neu berechnen' })).toBeVisible();
		const intentDialog = page.locator('kol-dialog');
		const { scroller: intentScroller } = await intentDialog.evaluate(measureHorizontalScroll);
		expect(intentScroller, 'kein horizontaler Scroll im Bestätigungs-Dialog bei 375px').toBeNull();

		await page.getByRole('button', { name: 'Weiter' }).click();
		await expect(page.getByRole('heading', { name: 'KI-Kosten bestätigen' })).toBeVisible();
		const costsDialog = page.locator('kol-dialog');
		const { scroller: costsScroller } = await costsDialog.evaluate(measureHorizontalScroll);
		expect(costsScroller, 'kein horizontaler Scroll im Kosten-Dialog bei 375px').toBeNull();

		const runButton = page.getByRole('button', { name: 'Jetzt neu berechnen' });
		await expect(runButton).toBeVisible();
		const box = await runButton.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.height, 'Primär-Button im Kosten-Dialog mindestens 44px hoch (Touch-Target)').toBeGreaterThanOrEqual(
			44 - 0.5,
		);

		const [response] = await Promise.all([
			page.waitForResponse(/\/api\/v1\/admin\/tasks\/reassign-pillars(\?[^/]*)?$/),
			runButton.click(),
		]);
		expect(response.status(), 'Start des Hintergrundlaufs muss 202 sein').toBe(202);
		await expect(page.getByText('2 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
	});
});
