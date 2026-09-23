import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * Rote Spec-E2E für #1565 (Spec `docs/spec/issue-1565.md`, AK1/AK4/AK5): Der kostenfreie
 * Paket-Selbstwechsel des Admins liegt in einer eigenen Karte im Tab „Pakete"
 * (`/settings/pakete`) — nicht mehr in der Zeile der Nutzerverwaltung (#1556). Mitglieder
 * sehen die Karte nicht; bei 375px bleibt sie vollständig im Viewport ohne eigenen
 * Scroll-Container (die Matrix scrollt bewusst in sich selbst, #1529/ADR 0014).
 *
 * Mocks nach `issue-1529-pakete-abo.spec.ts` (/plans, /auth/me) und
 * `issue-1556-admin-plan-switch.spec.ts` (zustandsbehafteter Plan-PATCH): Backend-Vertrag
 * deckt `server/src/express/admin.api.test.ts` ab, hier geht es um den Frontend-Vertrag.
 */

const MOBILE = { width: 375, height: 812 } as const;

/** Mutierbare Fixture — der Plan wechselt im zustandsbehafteten Mock unten. */
type FixtureUser = {
	id: number;
	displayName: string;
	email: string;
	role: 'admin' | 'member';
	plan: 'free' | 'pro' | 'max' | 'ultimate';
	entitlements: Record<string, unknown>;
	subscription: null;
};

const ADMIN_USER: FixtureUser = {
	id: 1,
	displayName: 'Anna Admin',
	email: 'anna@example.com',
	role: 'admin',
	plan: 'free',
	entitlements: {},
	subscription: null,
};

const MEMBER_USER: FixtureUser = {
	id: 2,
	displayName: 'Test User',
	email: 'test@example.com',
	role: 'member',
	plan: 'pro',
	entitlements: {},
	subscription: null,
};

const CATALOG = {
	features: [{ feature: 'ai_assist', allowedPlans: ['pro', 'max', 'ultimate'] }],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		pro: { monthly: 799, quarterly: 2157, yearly: 7670 },
		max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
		ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
	},
};

/** /auth/me LAZY stringifizieren: der Plan wechselt über den PATCH-Mock, ein Reload (und der
 *  /auth/me-Refresh der Karte) muss den frischen Wert bekommen (AK1 „sofort + nach Neuladen"). */
const mockAuthMe = async (page: Page, user: FixtureUser) => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

/**
 * Zustandsbehafteter Mock des Plan-PATCH + /plans-Katalog. Der PATCH-Handler notiert Id und
 * Paket für die Assertions (expect.poll) und mutiert den Nutzer, damit der /auth/me-Refresh der
 * Karte das neue Paket liefert.
 */
const mockPlansApi = async (page: Page): Promise<{ patchedId: () => number; patchedPlan: () => string }> => {
	let lastPatchedId = 0;
	let lastPatchedPlan = '';
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	// KolTabs hängt alle Panels in den DOM — die Nutzerverwaltung lädt ihre Liste auch im
	// Pakete-Tab; leer gemockt, damit kein 403-Alert den Baum stört.
	await page.route('**/api/v1/admin/users', (route: Route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
	});
	await page.route('**/api/v1/admin/users/*/plan', (route: Route) => {
		if (route.request().method() !== 'PATCH') {
			return route.fallback();
		}
		const id = Number(/\/admin\/users\/(\d+)\/plan/.exec(route.request().url())?.[1]);
		const { plan } = route.request().postDataJSON() as { plan: FixtureUser['plan'] };
		lastPatchedId = id;
		lastPatchedPlan = plan;
		ADMIN_USER.plan = plan;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_USER) });
	});
	return { patchedId: () => lastPatchedId, patchedPlan: () => lastPatchedPlan };
};

/** Die eigene Auswahl-Karte im Pakete-Panel — über der Matrix-Karte „Pakete im Vergleich". */
const ownPlanCard = (page: Page) => page.locator('.settings-plans kol-card', { hasText: 'Eigenes Paket' });

test.describe('#1565 Paket-Selbstwechsel — eigene Karte im Tab Pakete', () => {
	test('AK1: Admin wechselt in der eigenen Karte kostenfrei (PATCH auf eigene Id, sofort und nach Neuladen)', async ({
		page,
	}) => {
		await mockAuthMe(page, ADMIN_USER);
		const { patchedId, patchedPlan } = await mockPlansApi(page);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Balamentum');

		// Die Karte existiert, benennt die Abgrenzung zur Bezahl-Matrix und trägt die Auswahl.
		const card = ownPlanCard(page);
		await expect(card).toBeVisible();
		await expect(card).toContainText('kostenfrei');
		const selection = card.getByRole('combobox');
		await expect(selection).toBeVisible();

		// KI-UX: KolSingleSelect (Combobox öffnen, Option per Label wählen). Nutzt die
		// Implementierung stattdessen das tolerierte native KolSelect, ist diese Zeile auf
		// `selection.selectOption({ label: 'Pro' })` umzustellen (Spec, Testkonzept).
		await selection.click();
		await page.getByRole('option', { name: 'Pro', exact: true }).click();

		// AK1/AK3: der einzige Call ist der Plan-PATCH auf die eigene Id (kein Zahlungsweg).
		await expect.poll(() => patchedId()).toBe(ADMIN_USER.id);
		await expect.poll(() => patchedPlan()).toBe('pro');

		// AK1: UI sofort aktuell — der /auth/me-Refresh verschiebt „(dein Paket)" ohne Reload.
		await expect(page.locator('.settings-plans')).toContainText('Pro (dein Paket)');
		await expect(page.locator('.settings-plans')).not.toContainText('Free (dein Paket)');

		// AK1: nach dem Neuladen weiterhin „Pro" (/auth/me-Mock liefert den gemutierten Plan).
		await page.reload();
		await waitForStableView(page, 'Balamentum');
		await expect(page.locator('.settings-plans')).toContainText('Pro (dein Paket)');
	});

	test('AK4: Mitglied sieht im Tab Pakete keine Auswahl-Karte (Matrix bleibt)', async ({ page }) => {
		await mockAuthMe(page, MEMBER_USER);
		await mockPlansApi(page);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Balamentum');

		await expect(ownPlanCard(page)).toHaveCount(0);
		await expect(page.locator('.settings-plans').getByRole('combobox')).toHaveCount(0);

		// Der Tab selbst bleibt für Mitglieder unverändert: Matrix lädt.
		await expect(page.getByTestId('plans-section')).toBeVisible();
	});

	test('AK5: bei 375px liegt die Auswahl-Karte vollständig im Viewport ohne eigenen Scroll-Container', async ({
		page,
	}) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockPlansApi(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Balamentum');

		const card = ownPlanCard(page);
		await expect(card).toBeVisible();
		// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x: hidden (MEMORY 2026-08-24).
		const box = await card.boundingBox();
		expect(box, 'Karte muss vermessen sein').not.toBeNull();
		expect(box!.x, 'Karte beginnt innerhalb des Viewports').toBeGreaterThanOrEqual(-0.5);
		expect(box!.x + box!.width, 'Karte ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);

		// Kein horizontaler Scroll-Container INNERHALB der Karte (inkl. Shadow-DOM); der
		// Matrix-Scroller daneben ist bewusst (#1529) und wird hier nicht geprüft.
		const measured = await card.evaluate(measureHorizontalScroll);
		expect(measured.scroller, 'Karte erzeugt keinen horizontalen Overflow').toBeNull();
	});
});
