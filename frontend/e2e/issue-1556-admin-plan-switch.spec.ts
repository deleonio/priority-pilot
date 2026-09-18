import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1556 (Spec `docs/spec/issue-1556.md`, AK1–AK3/AK5/AK6): Paket-Badge je Zeile
 * der Admin-Nutzerverwaltung + kostenfreier Selbst-Wechsel über eine Auswahl in der eigenen
 * Zeile — ohne Reload wirksam (Liste lädt neu) und nach dem Neuladen (über `/auth/me`).
 *
 * `/auth/me`, `/admin/users` und der Plan-PATCH werden wie in `issue-1300-admin-users.spec.ts`
 * gemockt (zustandsbehaftet): Die Backend-Autorisierung deckt `server/src/express/admin.api.test.ts`
 * ab, hier geht es um den Frontend-Vertrag (Badge, Auswahl nur eigene Zeile, Layout bei 375px).
 */

const MOBILE = { width: 375, height: 812 } as const;

/** Mutierbare Fixture — der Plan wechselt im zustandsbehafteten Mock unten. */
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

/** Von der Auswahl geprüfte Optionstexte — Quelle der Wahrheit ist `planLabel` (planOffers.ts). */
const PLAN_LABELS = ['Free', 'Pro', 'Max', 'Ultimate'] as const;

const mockAuthMe = async (page: Page, user: FixtureUser) => {
	// Bewusst LAZY stringifizieren: der Plan wechselt über den PATCH-Mock, ein Reload muss den
	// frischen Wert bekommen (AK5 — „wirksam nach Neuladen" über /auth/me).
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

/**
 * Zustandsbehafteter Mock der Admin-API: `AdminUsersSection` lädt nach dem Plan-PATCH die Liste
 * neu — die GET-Antwort muss den Wechsel widerspiegeln. Der PATCH-Handler notiert Id und Paket
 * für die Assertions (expect.poll, Muster MEMORY 2026-08-28).
 */
const mockAdminUsers = async (page: Page): Promise<{ patchedId: () => number; patchedPlan: () => string }> => {
	const users = [
		{ ...ADMIN_USER, createdAt: '2026-01-01T00:00:00Z' },
		{ ...MEMBER_USER, createdAt: '2026-01-02T00:00:00Z' },
	];
	let lastPatchedId = 0;
	let lastPatchedPlan = '';
	await page.route('**/api/v1/admin/users', (route: Route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
	});
	await page.route('**/api/v1/admin/users/*/plan', (route: Route) => {
		if (route.request().method() !== 'PATCH') {
			return route.fallback();
		}
		const id = Number(/\/admin\/users\/(\d+)\/plan/.exec(route.request().url())?.[1]);
		const { plan } = route.request().postDataJSON() as { plan: FixtureUser['plan'] };
		const target = users.find((user) => user.id === id);
		if (!target) {
			return route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'nicht gefunden' }),
			});
		}
		lastPatchedId = id;
		lastPatchedPlan = plan;
		target.plan = plan;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(target) });
	});
	return { patchedId: () => lastPatchedId, patchedPlan: () => lastPatchedPlan };
};

/** Zeilen-Locator der Nutzerverwaltung — scoped auf den Namen, nicht seitenweit. */
const userRow = (page: Page, name: string) => page.locator('.settings-admin-users .admin-user', { hasText: name });

test.describe('#1556 Paket-Selbstbedienung — Nutzerverwaltung', () => {
	test('AK1/AK2: jede Zeile zeigt das Paket-Badge, nur die eigene Zeile hat die Paket-Auswahl', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.goto('/settings/nutzer');
		await waitForStableView(page, 'Priority Pilot');

		// AK1: Badge-Text in jeder Zeile (auch fremde), Rolle bleibt unangetastet.
		await expect(userRow(page, 'Anna Admin')).toContainText('Free', { ignoreCase: false });
		await expect(userRow(page, 'Test User')).toContainText('Pro', { ignoreCase: false });

		// AK2: Auswahl nur in der eigenen Zeile, mit genau den vier Paketen.
		const ownSelect = userRow(page, 'Anna Admin').getByRole('combobox');
		await expect(ownSelect).toBeVisible();
		const optionTexts = await ownSelect.locator('option').allTextContents();
		expect(optionTexts).toEqual([...PLAN_LABELS]);

		await expect(userRow(page, 'Test User').getByRole('combobox')).toHaveCount(0);
	});

	test('AK3/AK5: Wechsel auf „Pro" wirkt ohne Reload und nach dem Neuladen (eigene Id, kein Zahlungsweg)', async ({
		page,
	}) => {
		await mockAuthMe(page, ADMIN_USER);
		const { patchedId, patchedPlan } = await mockAdminUsers(page);
		await page.goto('/settings/nutzer');
		await waitForStableView(page, 'Priority Pilot');

		// KoliBri-Select: interne Options-Werte sind synthetisch — Auswahl per LABEL wählen
		// (Muster `issue-1357-token-expiry.spec.ts`).
		await userRow(page, 'Anna Admin').getByRole('combobox').selectOption({ label: 'Pro' });

		// AK3: der einzige Call ist der Plan-PATCH auf die eigene Id (kein Bestell-/Zahlungspfad).
		await expect.poll(() => patchedId()).toBe(ADMIN_USER.id);
		await expect.poll(() => patchedPlan()).toBe('pro');

		// AK3: Liste lädt neu — Badge zeigt das neue Paket ohne Seitenreload.
		await expect(userRow(page, 'Anna Admin')).toContainText('Pro', { ignoreCase: false });

		// AK5: nach dem Neuladen weiterhin „Pro" (/auth/me-Mock liefert den gemuteten Plan).
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(userRow(page, 'Anna Admin')).toContainText('Pro', { ignoreCase: false });
		await expect(userRow(page, 'Test User')).toContainText('Pro', { ignoreCase: false });
	});

	test('AK6: bei 375px bleiben alle Zeilen im Viewport und die Auswahl ist bedienbar', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/settings/nutzer');
		await waitForStableView(page, 'Priority Pilot');

		const rows = page.locator('.settings-admin-users .admin-user');
		await expect(rows).toHaveCount(2);
		const count = await rows.count();
		for (let index = 0; index < count; index += 1) {
			// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x: hidden (MEMORY 2026-08-24).
			const box = await rows.nth(index).boundingBox();
			expect(box, `Zeile ${index} muss vermessen sein`).not.toBeNull();
			expect(box!.x + box!.width, `Zeile ${index} ragt bei 375px aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
		}

		// Test-Pflege #1556 (Impl-Phase): KoliBri pinnt die native Auswahl im Theme auf 40px fest
		// (theme-default `.kol-select { min-height: calc(40 * 1rem / …) }`, kein Var-Hook) — das
		// 44px-Minimum gilt repo-weit auf den KoliBri-Container, nicht die innere Input-Box
		// (app.css voice-field-Kommentar; Muster issue-1098-geo-settings.spec.ts:117 misst den Host).
		const ownSelect = userRow(page, 'Anna Admin').getByRole('combobox');
		const selectHost = userRow(page, 'Anna Admin').locator('kol-select');
		const selectBox = await selectHost.boundingBox();
		expect(selectBox, 'Touch-Target der Auswahl mindestens 44px hoch').not.toBeNull();
		expect(selectBox!.height).toBeGreaterThanOrEqual(44 - 0.5);

		await ownSelect.selectOption({ label: 'Max' });
		await expect(userRow(page, 'Anna Admin')).toContainText('Max', { ignoreCase: false });
	});
});
