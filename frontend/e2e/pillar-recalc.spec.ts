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
	/** Zahl der POST-Aufrufe — belegt, dass der Client den Lauf nur startet. */
	calls: () => number;
}

/**
 * Zustandsbehafteter Server: merkt sich erfolgreich verarbeitete Aufgaben seit dem Laufstart wie der
 * echte (`pillarsRecalculatedAt` ≥ Start). Test-Pflege #1642: EIN POST startet den Hintergrundlauf,
 * der Server verarbeitet alle offenen Aufgaben selbst; `.../status` meldet währenddessen `running`
 * mit `processed` und danach das Ergebnis.
 */
const installFakeServer = async (page: Page, runPath: RegExp, statusPath: RegExp): Promise<FakeServer> => {
	// Lang genug, dass das Polling (1,5 s) einen Zwischenstand abfängt.
	const RUN_MS = 4000;
	const done = new Set<number>();
	const failedOnce = new Set<number>();
	let startedAt: string | null = null;
	let calls = 0;
	let run: {
		startedMs: number;
		pendingAtStart: number;
		result: {
			updated: number;
			failed: number;
			skipped: number;
			quotaExhausted: boolean;
			failureReasons?: Record<string, number>;
		};
	} | null = null;

	await page.route(statusPath, (route: Route) => {
		const processed = run === null ? 0 : run.result.updated + run.result.failed;
		const elapsed = run === null ? RUN_MS : Date.now() - run.startedMs;
		const body =
			run !== null && elapsed < RUN_MS
				? (() => {
						const shown = Math.max(1, Math.floor((elapsed / RUN_MS) * processed));
						return { startedAt, total: TOTAL, pending: run.pendingAtStart - shown, running: true, processed: shown };
					})()
				: {
						startedAt,
						total: TOTAL,
						pending: TOTAL - done.size,
						running: false,
						processed,
						...(run === null ? {} : { result: run.result }),
					};
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
	});
	await page.route(runPath, async (route: Route) => {
		if (route.request().method() !== 'POST') {
			return route.fallback();
		}
		calls += 1;
		const query = new URL(route.request().url()).searchParams;
		if (query.get('restart') === 'true' || startedAt === null) {
			done.clear();
			startedAt = new Date().toISOString();
		}
		const pending = Array.from({ length: TOTAL }, (_, index) => index + 1).filter((id) => !done.has(id));
		let updated = 0;
		let failed = 0;
		for (const id of pending) {
			if (FLAKY.has(id) && !failedOnce.has(id)) {
				failedOnce.add(id);
				failed += 1;
			} else {
				done.add(id);
				updated += 1;
			}
		}
		run = {
			startedMs: Date.now(),
			pendingAtStart: pending.length,
			result: {
				updated,
				failed,
				skipped: 0,
				quotaExhausted: false,
				...(failed > 0 ? { failureReasons: { 'HTTP 429': failed } } : {}),
			},
		};
		return route.fulfill({
			status: 202,
			contentType: 'application/json',
			body: JSON.stringify({ running: true, processed: 0 }),
		});
	});
	return { calls: () => calls };
};

/** Während des Laufs: Zwischenstand „n / 12“ mit 0 < n < 12 — der Balken steht nicht auf 0 / 0. */
const expectLiveProgress = async (page: Page): Promise<void> => {
	await expect(page.getByText(/Verarbeite Aufgaben… ?([1-9]|1[01]) \/ 12/)).toBeVisible();
};

/**
 * #1642: Serverseitiger Hintergrundlauf — EIN POST startet, `.../status` liefert danach `running`
 * mit Fortschritt (`processed`) bzw. nach Ende das Ergebnis in `result`. Bewusst simuliert der Mock
 * eine kurze, aber messbare Laufzeit (mehrere Sekunden), damit der Test den Zwischenstand sicher
 * abfangen kann, bevor er auf `running: false` wartet.
 */
const installBackgroundFakeServer = async (page: Page, runPath: RegExp, statusPath: RegExp): Promise<void> => {
	const RUN_MS = 1500;
	let startedAt: string | null = null;
	let runStartedAtMs = 0;

	await page.route(statusPath, (route: Route) => {
		if (startedAt === null) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ startedAt: null, total: 0, pending: 0, running: false }),
			});
		}
		const elapsed = Date.now() - runStartedAtMs;
		const running = elapsed < RUN_MS;
		const processed = Math.min(TOTAL, Math.floor((elapsed / RUN_MS) * TOTAL));
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				running
					? { startedAt, total: TOTAL, pending: TOTAL - processed, running: true, processed }
					: {
							startedAt,
							total: TOTAL,
							pending: 0,
							running: false,
							result: { updated: TOTAL, failed: 0, skipped: 0, quotaExhausted: false },
						},
			),
		});
	});
	await page.route(runPath, async (route: Route) => {
		if (route.request().method() !== 'POST') {
			return route.fallback();
		}
		startedAt = new Date().toISOString();
		runStartedAtMs = Date.now();
		// Kurze Verzögerung: gibt einem noch nicht umgestellten, synchronen Client ein Zeitfenster,
		// in dem „Abbrechen" während `run.phase === 'processing'` überhaupt klickbar ist. Die
		// Legacy-Felder (`updated`/`remaining: 0`) lassen dessen alte Portionsschleife nach genau
		// einem Aufruf sauber enden, statt endlos weiterzuportionieren.
		await new Promise((resolve) => setTimeout(resolve, 800));
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				running: true,
				updated: TOTAL,
				failed: 0,
				skipped: 0,
				remaining: 0,
				quotaExhausted: false,
			}),
		});
	});
};

test.describe('Säulen-Neuberechnung — Hintergrundlauf (#1642)', () => {
	test('Modal schließen und wieder öffnen zeigt den Lauf ohne Klick; kein Start während running', async ({ page }) => {
		await installBackgroundFakeServer(
			page,
			/\/api\/v1\/tasks\/reassign-pillars(\?[^/]*)?$/,
			/\/api\/v1\/tasks\/reassign-pillars\/status/,
		);
		await page.goto('/app/settings/pillars');
		await waitForStableView(page, 'Balamentum');

		await page.getByRole('button', { name: 'Säulen aller Aufgaben neu berechnen' }).click();
		await page.getByRole('button', { name: 'Start' }).click();
		await expect(page.getByText(/Verarbeite Aufgaben/)).toBeVisible();

		// Schließen während des Laufs darf ihn nicht abbrechen (AK6) — beim Wiedereinstieg muss der
		// tatsächliche Stand ohne erneuten Klick sichtbar sein (AK7).
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await page.getByRole('button', { name: 'Säulen aller Aufgaben neu berechnen' }).click();

		await expect(page.getByText(/Verarbeite Aufgaben/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Fortsetzen/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /neu starten/ })).toHaveCount(0);

		await expect(page.getByText('12 Aufgaben neu zugeordnet', { exact: false })).toBeVisible({ timeout: 5000 });
	});

	// AK8 (375px, kein horizontaler Überlauf) bekommt bewusst keinen eigenen Test: die Laufanzeige im
	// Modal ist `ReassignProgressView`, dieselbe Markup-/CSS-Struktur wie im bestehenden #1614-Flow —
	// ein reiner Layout-Test dagegen wäre heute schon grün (keine roten Zähne) und liefe der Dedup-
	// Regel (SKILL.md Schritt 3) zuwider. `measureHorizontalScroll`-Helper steht für die
	// Implementierungsphase bereit, falls #1642 dort neue Elemente in die Laufanzeige einführt.
});

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
		expect(server.calls(), 'ein Start, die Portionen holt der Server selbst').toBe(1);

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
		expect(server.calls(), 'ein Start, die Portionen holt der Server selbst').toBe(1);

		await page.getByRole('button', { name: 'Fortsetzen (2 offen)' }).click();
		await page.getByRole('button', { name: 'Jetzt fortsetzen' }).click();
		await expect(page.getByText('2 Aufgaben neu zugeordnet', { exact: false })).toBeVisible();
		await expect(page.getByRole('button', { name: /Fortsetzen/ })).toHaveCount(0);
	});
});
