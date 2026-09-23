import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1556 (Spec `docs/spec/issue-1556.md`, AK1/AK6 — Zeilen-Badges + 375px-Layout)
 * mit der #1565-Anpassung (Spec `docs/spec/issue-1565.md`, AK2): Die Nutzerverwaltung ist rein
 * lesend — das Paket jeder Zeile steht als Badge, eine Paket-Auswahl gibt es hier nicht mehr
 * (der Selbst-Wechsel läuft über die eigene Karte im Tab Pakete, issue-1565-package-switch-tab.spec.ts).
 *
 * `/auth/me` und `/admin/users` werden wie in `issue-1300-admin-users.spec.ts` gemockt: Die
 * Backend-Autorisierung deckt `server/src/express/admin.api.test.ts` ab, hier geht es um den
 * Frontend-Vertrag (Badges, keine Auswahl, Layout bei 375px).
 */

const MOBILE = { width: 375, height: 812 } as const;

type FixtureUser = {
	id: number;
	displayName: string;
	email: string;
	role: 'admin' | 'member';
	plan: 'free' | 'pro' | 'max' | 'ultimate';
};

const ADMIN_USER: FixtureUser = {
	id: 1,
	displayName: 'Anna Admin',
	email: 'anna@example.com',
	role: 'admin',
	plan: 'free',
};
const MEMBER_USER: FixtureUser = {
	id: 2,
	displayName: 'Test User',
	email: 'test@example.com',
	role: 'member',
	plan: 'pro',
};

const mockAuthMe = async (page: Page, user: FixtureUser) => {
	await page.route('**/auth/me', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

const mockAdminUsers = async (page: Page): Promise<void> => {
	const users = [
		{ ...ADMIN_USER, createdAt: '2026-01-01T00:00:00Z' },
		{ ...MEMBER_USER, createdAt: '2026-01-02T00:00:00Z' },
	];
	await page.route('**/api/v1/admin/users', (route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
	});
};

/** Zeilen-Locator der Nutzerverwaltung — scoped auf den Namen, nicht seitenweit. */
const userRow = (page: Page, name: string) => page.locator('.settings-admin-users .admin-user', { hasText: name });

test.describe('#1556/#1565 Nutzerverwaltung — Paket-Badges ohne Auswahl', () => {
	test('AK1/AK2: jede Zeile zeigt das Paket-Badge, keine Zeile hat eine Paket-Auswahl', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		// AK1: Badge-Text in jeder Zeile (auch fremde), Rolle bleibt unangetastet.
		await expect(userRow(page, 'Anna Admin')).toContainText('Free', { ignoreCase: false });
		await expect(userRow(page, 'Test User')).toContainText('Pro', { ignoreCase: false });

		// AK2 (#1565): rein lesend — auch die eigene Zeile hat kein Select/Combobox mehr.
		await expect(userRow(page, 'Anna Admin').getByRole('combobox')).toHaveCount(0);
		await expect(userRow(page, 'Test User').getByRole('combobox')).toHaveCount(0);
	});

	test('AK6: bei 375px bleiben alle Zeilen im Viewport', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		const rows = page.locator('.settings-admin-users .admin-user');
		await expect(rows).toHaveCount(2);
		const count = await rows.count();
		for (let index = 0; index < count; index += 1) {
			// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x: hidden (MEMORY 2026-08-24).
			const box = await rows.nth(index).boundingBox();
			expect(box, `Zeile ${index} muss vermessen sein`).not.toBeNull();
			expect(box!.x + box!.width, `Zeile ${index} ragt bei 375px aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
		}
	});
});
