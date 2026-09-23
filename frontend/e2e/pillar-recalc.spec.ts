import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E für die Säulen-Neuberechnung (#1614) an BEIDEN Einstiegen: Nutzer-Modal (Einstellungen →
 * Säulen) und Admin-Batch (Einstellungen → Nutzerverwaltung).
 *
 * Hintergrund: Der Admin-Batch blieb bei #1628 auf dem alten Stand, weil nur das Modal umgebaut und
 * nur dessen Unit-Tests angepasst wurden. Beide Einstiege teilen seitdem `useReassignRun`; diese
 * Spec prüft den gemeinsamen Vertrag in der echten App — Fortschritt während des Laufs, Fehlergründe
 * und „Fortsetzen“ nur der offenen Aufgaben.
 *
 * Die Endpunkte werden zustandsbehaftet gemockt: Die KI-Klassifikation ist im E2E-Backend nicht
 * verfügbar, und nur ein Mock kann Fehlschläge (429) und die Dauer einer Portion steuern.
 */

const TOTAL = 12;
/** Diese Aufgaben scheitern beim ersten Versuch mit 429 und gelingen beim Fortsetzen. */
const FLAKY = new Set([3, 8]);

interface FakeServer {
	/** Zahl der POST-Aufrufe — belegt, dass in Portionen gearbeitet wird. */
	calls: () => number;
}

/**
 * Zustandsbehafteter Server: merkt sich erfolgreich verarbeitete Aufgaben seit dem Laufstart wie der
 * echte (`pillarsRecalculatedAt` ≥ Start). `offset` überspringt nur die Fehlschläge der Serie.
 */
const installFakeServer = async (page: Page, runPath: RegExp, statusPath: RegExp): Promise<FakeServer> => {
	const done = new Set<number>();
	const failedOnce = new Set<number>();
	let startedAt: string | null = null;
	let calls = 0;

	await page.route(statusPath, (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ startedAt, total: TOTAL, pending: TOTAL - done.size }),
		}),
	);
	await page.route(runPath, async (route: Route) => {
		if (route.request().method() !== 'POST') {
			return route.fallback();
		}
		calls += 1;
		const query = new URL(route.request().url()).searchParams;
		const limit = Number(query.get('limit') ?? 200);
		const offset = Number(query.get('offset') ?? 0);
		if (query.get('restart') === 'true' || startedAt === null) {
			done.clear();
			startedAt = new Date().toISOString();
		}
		const pending = Array.from({ length: TOTAL }, (_, index) => index + 1).filter((id) => !done.has(id));
		const portion = pending.slice(offset, offset + limit);
		let updated = 0;
		let failed = 0;
		for (const id of portion) {
			if (FLAKY.has(id) && !failedOnce.has(id)) {
				failedOnce.add(id);
				failed += 1;
			} else {
				done.add(id);
				updated += 1;
			}
		}
		// Eine Portion dauert — sonst wäre der Fortschritt zwischen zwei Aufrufen nie zu sehen.
		await new Promise((resolve) => setTimeout(resolve, 400));
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				updated,
				failed,
				skipped: 0,
				users: 1,
				quotaExhausted: false,
				remaining: Math.max(0, pending.length - offset - portion.length),
				...(failed > 0 ? { failureReasons: { 'HTTP 429': failed } } : {}),
			}),
		});
	});
	return { calls: () => calls };
};

/** Während des Laufs: Zwischenstand „n / 12“ mit 0 < n < 12 — der Balken steht nicht auf 0 / 0. */
const expectLiveProgress = async (page: Page): Promise<void> => {
	await expect(page.getByText(/Verarbeite Aufgaben… ?([1-9]|1[01]) \/ 12/)).toBeVisible();
};

test.describe('Säulen-Neuberechnung (#1614)', () => {
	test('Nutzer-Modal: Fortschritt, Fehlergründe und Fortsetzen nur der offenen Aufgaben', async ({ page }) => {
		const server = await installFakeServer(
			page,
			/\/api\/v1\/tasks\/reassign-pillars(\?[^/]*)?$/,
			/\/api\/v1\/tasks\/reassign-pillars\/status/,
		);
		await page.goto('/app/settings/pillars');
		await waitForStableView(page, 'Balamentum');

		await page.getByRole('button', { name: 'Säulen aller Aufgaben neu berechnen' }).click();
		await page.getByRole('button', { name: 'Start' }).click();
		await expectLiveProgress(page);

		await expect(page.getByText('10 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
		await expect(page.getByText('HTTP 429 (Rate-Limit des KI-Anbieters): 2')).toBeVisible();
		expect(server.calls(), 'in Portionen, nicht in einem Request').toBeGreaterThan(1);

		await page.getByRole('button', { name: 'Fortsetzen (2 offen)' }).click();
		await expect(page.getByText('2 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
		await expect(page.getByRole('button', { name: /Fortsetzen/ })).toHaveCount(0);
	});

	test('Admin-Batch: Fortschritt, Fehlergründe und Fortsetzen nur der offenen Aufgaben', async ({ page }) => {
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 1,
					displayName: 'Anna Admin',
					email: 'anna@example.com',
					role: 'admin',
					plan: 'pro',
					entitlements: { ai_assist: { allowed: true, requiredPlan: 'pro' } },
				}),
			}),
		);
		await page.route('**/api/v1/admin/users', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 1,
						displayName: 'Anna Admin',
						email: 'anna@example.com',
						role: 'admin',
						plan: 'pro',
						createdAt: '2026-01-01T00:00:00Z',
					},
				]),
			}),
		);
		const server = await installFakeServer(
			page,
			/\/api\/v1\/admin\/tasks\/reassign-pillars(\?[^/]*)?$/,
			/\/api\/v1\/admin\/tasks\/reassign-pillars\/status/,
		);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		await page.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }).click();
		await page.getByRole('button', { name: 'Weiter' }).click();
		await page.getByRole('button', { name: 'Jetzt neu berechnen' }).click();
		await expectLiveProgress(page);

		await expect(page.getByText('10 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
		await expect(page.getByText('HTTP 429 (Rate-Limit des KI-Anbieters): 2')).toBeVisible();
		expect(server.calls(), 'in Portionen, nicht in einem Request').toBeGreaterThan(1);

		await page.getByRole('button', { name: 'Fortsetzen (2 offen)' }).click();
		await page.getByRole('button', { name: 'Jetzt fortsetzen' }).click();
		await expect(page.getByText('2 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
		await expect(page.getByRole('button', { name: /Fortsetzen/ })).toHaveCount(0);
	});
});
