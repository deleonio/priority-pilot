import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * E2E-Spec für #1959 (Spec docs/spec/issue-1959.md, AK4): Zeilen-Aktionen „Abo sperren“ /
 * „Abo stornieren“ in der Nutzerverwaltung mit je einem Ja/Nein-Bestätigungsdialog — Abbrechen
 * setzt keinen Request ab, Bestätigen führt die Aktion aus, Fokus zurück auf den auslösenden
 * Button (verbindliches Pattern `docs/ux-pattern-sequential-confirmation.md`), alles bei 375px.
 *
 * `/auth/me` und die Admin-Endpunkte werden gemockt (Muster `issue-1300-admin-users.spec.ts`):
 * Die Backend-Autorisierung deckt `server/src/express/admin-subscriptions.test.ts` ab, hier geht
 * es um den Frontend-Vertrag.
 */

const MOBILE = { width: 375, height: 812 } as const;

const ADMIN_USER = { id: 1, displayName: 'Anna Admin', email: 'anna@example.com', role: 'admin' as const };
const MEMBER_USER = { id: 2, displayName: 'Bernd Beta', email: 'bernd@example.com', role: 'member' as const };

const mockAuthMe = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_USER) }),
	);
};

/**
 * Zustandsbehafteter Mock der Admin-Abo-Routen: `AdminUsersSection` lädt nach jeder Aktion die
 * Liste neu — das GET muss die Sperrung widerspiegeln. `lockPosts()` zählt abgesetzte POSTs
 * (AK4-Negativvertrag: Abbrechen darf keinen absetzen).
 */
const mockAdminSubscriptions = async (page: Page): Promise<{ lockPosts: () => number }> => {
	const users = [
		{ ...ADMIN_USER, plan: 'free', subscriptionStatus: null, createdAt: '2026-01-01T00:00:00Z' },
		{ ...MEMBER_USER, plan: 'pro', subscriptionStatus: 'active', createdAt: '2026-01-02T00:00:00Z' },
	];
	let lockPosts = 0;
	await page.route('**/api/v1/admin/users', (route: Route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
	});
	await page.route('**/api/v1/admin/users/*/subscription/lock', (route: Route) => {
		lockPosts += 1;
		const member = users.find((user) => user.id === MEMBER_USER.id)!;
		member.subscriptionStatus = 'locked';
		member.plan = 'free';
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(member) });
	});
	await page.route('**/api/v1/admin/users/*/subscription/cancel', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
	);
	return { lockPosts: () => lockPosts };
};

const openUserList = async (page: Page): Promise<void> => {
	await page.setViewportSize(MOBILE);
	await page.goto('/app/settings/nutzer');
	await waitForStableView(page, 'Balamentum');
	await expect(page.getByText('Bernd Beta', { exact: true })).toBeVisible();
};

const memberRow = (page: Page) => page.locator('li.admin-user', { hasText: 'Bernd Beta' });

test.describe('#1959 Admin: Abo sperren/stornieren — Nutzerverwaltung bei 375px', () => {
	test('AK4: Aktionen je Zeile sichtbar, Panel ohne horizontalen Überlauf', async ({ page }) => {
		await mockAuthMe(page);
		const { lockPosts } = await mockAdminSubscriptions(page);
		await openUserList(page);

		await expect(memberRow(page).getByRole('button', { name: 'Abo sperren' })).toBeVisible();
		await expect(memberRow(page).getByRole('button', { name: 'Abo stornieren' })).toBeVisible();
		expect(lockPosts(), 'ohne Bestätigung noch kein Request').toBe(0);

		const panel = page.locator('.settings-admin-users');
		const { scroller } = await panel.evaluate(measureHorizontalScroll);
		expect(scroller, 'kein horizontaler Scroll-Container im Nutzerverwaltungs-Panel bei 375px').toBeNull();
	});

	test('AK4: „Abbrechen“ im Sperr-Dialog setzt keinen Request ab und schließt den Dialog', async ({ page }) => {
		await mockAuthMe(page);
		const { lockPosts } = await mockAdminSubscriptions(page);
		await openUserList(page);

		const trigger = memberRow(page).getByRole('button', { name: 'Abo sperren' });
		await trigger.click();
		const confirm = page.getByRole('button', { name: 'Jetzt sperren' });
		await expect(confirm).toBeVisible();

		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(confirm).toBeHidden();

		// Erneut öffnen: beweist, dass zwischendurch (auch nach dem Abbruch) kein Request lief.
		await trigger.click();
		await expect(confirm).toBeVisible();
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(confirm).toBeHidden();
		expect(lockPosts(), 'Abbrechen darf keinen Sperr-Request absetzen').toBe(0);
	});

	test('AK4: Bestätigen löst die Sperrung aus — Request 200 und „Gesperrt“ in der Zeile', async ({ page }) => {
		await mockAuthMe(page);
		await mockAdminSubscriptions(page);
		await openUserList(page);

		await memberRow(page).getByRole('button', { name: 'Abo sperren' }).click();
		const [response] = await Promise.all([
			page.waitForResponse('**/api/v1/admin/users/*/subscription/lock'),
			page.getByRole('button', { name: 'Jetzt sperren' }).click(),
		]);
		expect(response.status(), 'Sperr-Request muss 200 sein').toBe(200);

		await expect(memberRow(page).getByText('Gesperrt', { exact: true })).toBeVisible();
	});

	test('AK4: Bestätigen der Stornierung ruft die Cancel-Route auf', async ({ page }) => {
		await mockAuthMe(page);
		await mockAdminSubscriptions(page);
		await openUserList(page);

		await memberRow(page).getByRole('button', { name: 'Abo stornieren' }).click();
		const [response] = await Promise.all([
			page.waitForResponse('**/api/v1/admin/users/*/subscription/cancel'),
			page.getByRole('button', { name: 'Jetzt stornieren' }).click(),
		]);
		expect(response.status(), 'Storno-Request muss 200 sein').toBe(200);
		await expect(page.getByRole('button', { name: 'Jetzt stornieren' })).toBeHidden();
	});

	test('AK4 (UX-Pattern): nach „Abbrechen“ liegt der Fokus zurück auf dem auslösenden Button', async ({ page }) => {
		await mockAuthMe(page);
		await mockAdminSubscriptions(page);
		await openUserList(page);

		const trigger = memberRow(page).getByRole('button', { name: 'Abo sperren' });
		await trigger.click();
		await page.getByRole('button', { name: 'Abbrechen' }).click();

		// KoliBri-Shadow-Fokus: toBeFocused pierct nativ; als Poll (MEMORY 2026-08-25), weil der
		// Fokus-Restore nach dem Dialog-Schließen asynchron durchläuft.
		await expect
			.poll(
				async () => {
					try {
						await expect(trigger).toBeFocused({ timeout: 100 });
						return true;
					} catch {
						return false;
					}
				},
				{ timeout: 3000 },
			)
			.toBe(true);
	});
});
