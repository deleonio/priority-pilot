import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * Rote Spec-E2E für #1566 (Spec `docs/spec/issue-1566.md`): Rolle „Tester" — Admin ohne
 * Nutzerverwaltung. Nur das Tester-Delta: Admin/Member-Tab-Sichtbarkeit deckt
 * `issue-1300-admin-users.spec.ts` ab, den Admin-Paketwechsel-Flow `issue-1565-package-switch-tab.spec.ts`.
 *
 * Mocks nach `issue-1565-package-switch-tab.spec.ts` (/plans, zustandsbehafteter Plan-PATCH,
 * LAZY /auth/me); die Backend-Grenzen (403) deckt `server/src/express/admin.api.test.ts` ab —
 * hier geht es um den Frontend-Vertrag (Tab-Gating über `user.role === 'tester'`).
 */

const MOBILE = { width: 375, height: 812 } as const;

/** Mutierbare Fixture — der Plan wechselt über den zustandsbehafteten PATCH-Mock. */
type FixtureUser = {
	id: number;
	displayName: string;
	email: string;
	role: 'admin' | 'member' | 'tester';
	plan: 'free' | 'pro' | 'max' | 'ultimate';
	entitlements: Record<string, unknown>;
	subscription: null;
};

const TESTER_USER: FixtureUser = {
	id: 11,
	displayName: 'Tina Tester',
	email: 'tina@example.com',
	role: 'tester',
	plan: 'free',
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

const mockAuthMe = async (page: Page, user: FixtureUser) => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

/** Zustandsbehafteter Mock des Plan-PATCH (nur eigene Id des Testers erfolgreich) + Katalog. */
const mockPlansApi = async (page: Page): Promise<{ patchedId: () => number; patchedPlan: () => string }> => {
	let lastPatchedId = 0;
	let lastPatchedPlan = '';
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	// KolTabs hängt alle Panels in den DOM; die Nutzerverwaltung ist für Tester nicht gemountet
	// (kein isAdmin) — der Mock bleibt als Absicherung gegen 403-Alerts im Baum.
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
		TESTER_USER.plan = plan;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TESTER_USER) });
	});
	return { patchedId: () => lastPatchedId, patchedPlan: () => lastPatchedPlan };
};

/** Die eigene Auswahl-Karte im Pakete-Panel — über der Matrix-Karte „Pakete im Vergleich". */
const ownPlanCard = (page: Page) => page.locator('.settings-plans kol-card', { hasText: 'Eigenes Paket' });

/** KI-UX aus #1565 (unverändert übernommen): Combobox öffnen, Option per Label wählen. */
const choosePlan = async (page: Page, label: string) => {
	const selection = ownPlanCard(page).getByRole('combobox');
	await selection.click();
	await page.getByRole('option', { name: label, exact: true }).click();
};

test.describe('#1566 Rolle „Tester" — Admin ohne Nutzerverwaltung', () => {
	test('AK2: Tester sieht den Tab „Nutzerverwaltung" nicht; Deep-Link fällt auf „Säulen" zurück', async ({ page }) => {
		await mockAuthMe(page, TESTER_USER);
		await mockPlansApi(page);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Nutzerverwaltung' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Säulen' })).toHaveAttribute('aria-selected', 'true');
	});

	test('AK3: Tester wechselt durch alle vier Pakete inkl. Rückweg zu Free — PATCH nur auf die eigene Id, überlebt Reload', async ({
		page,
	}) => {
		await mockAuthMe(page, TESTER_USER);
		const { patchedId, patchedPlan } = await mockPlansApi(page);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Priority Pilot');

		// Dieselbe Karte wie ein Admin (#1565 AK1): sichtbar und mit Auswahl.
		const card = ownPlanCard(page);
		await expect(card).toBeVisible();
		await expect(card).toContainText('kostenfrei');

		// Alle vier Pakete nacheinander — inkl. Rückwechsel zu Free.
		for (const label of ['Pro', 'Max', 'Ultimate', 'Free']) {
			await choosePlan(page, label);
			await expect.poll(() => patchedId(), `PATCH-Ziel nach Wahl von ${label}`).toBe(TESTER_USER.id);
			await expect.poll(() => patchedPlan(), `PATCH-Paket nach Wahl von ${label}`).toBe(label.toLowerCase());
		}

		// AK3: Der Wechsel überlebt ein Neuladen (/auth/me-Mock liefert den gemutierten Plan).
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(page.locator('.settings-plans')).toContainText('Free (dein Paket)');
		await expect(ownPlanCard(page)).toBeVisible();
	});

	test('AK6: bei 375px fehlt der Tab Nutzerverwaltung, die Paketkarte bleibt im Viewport und ist bedienbar', async ({
		page,
	}) => {
		await mockAuthMe(page, TESTER_USER);
		const { patchedPlan } = await mockPlansApi(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Priority Pilot');

		// AK2 mobil: kein Nutzerverwaltungs-Tab in der gestapelten Leiste.
		await expect(page.getByRole('tab', { name: 'Nutzerverwaltung' })).toHaveCount(0);

		// AK3 mobil: Karte vollständig im Viewport (Bounding-Box, nicht scrollWidth — die
		// App-Shell clippt overflow-x: hidden, MEMORY 2026-08-24), ohne eigenen Scroll-Container.
		const card = ownPlanCard(page);
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box, 'Karte muss vermessen sein').not.toBeNull();
		expect(box!.x, 'Karte beginnt innerhalb des Viewports').toBeGreaterThanOrEqual(-0.5);
		expect(box!.x + box!.width, 'Karte ragt bei 375px aus den Viewport').toBeLessThanOrEqual(375 + 0.5);
		const measured = await card.evaluate(measureHorizontalScroll);
		expect(measured.scroller, 'Karte erzeugt keinen horizontalen Overflow').toBeNull();

		// Bedienbar: Der Paketwechsel klappt auch mobil.
		await choosePlan(page, 'Pro');
		await expect.poll(() => patchedPlan()).toBe('pro');
	});
});
