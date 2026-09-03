import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für #1187 — OS-Einstellung „Bewegung reduzieren" transparent machen.
 *
 * Spezifikation: `docs/spec/issue-1187.md`. Das reduced-motion-Banner existiert noch nicht
 * → RED: die Banner-Lokatoren treffen in keinem Test, alle Specs laufen in ihren
 * Ziel-Assertionen rot.
 *
 * Konventionen wie `issue-1169-confetti.spec.ts` und `settings-page.spec.ts`: echtes Backend
 * (In-Memory-DB, Vite-Proxy), API-Seed pro Test, `afterEach` räumt alle Tasks ab.
 * Das Banner wird über `kol-alert` + Text „Bewegung reduzieren" adressiert (Muster
 * `issue-1028-alert-host-padding-radius.spec.ts:81`) — der exakte Wortlaut ist der
 * Umsetzung freigegeben, verbindlich ist nur das Thema im zugänglichen Text.
 *
 * AK3 (reduce unterdrückt Konfetti bei eingeschaltetem Schalter) ist bereits durch
 * `issue-1169-confetti.spec.ts` AK6 erschlagend getestet (emulateMedia reduce +
 * beforeEach-Key `pp-animations-enabled` → kein Overlay) und wird hier nicht dupliziert.
 */
test.describe('Priority Pilot — „Bewegung reduzieren" transparent machen (#1187)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `Reduce ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	const fetchStatus = async (page: Page, id: number): Promise<string> => {
		const response = await page.request.get(`/api/v1/tasks/${id}`);
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { status: string };
		return task.status;
	};

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	// Wie `issue-1169-confetti.spec.ts`: AK5 prüft das Konfetti-Verhalten unter
	// EINGESCHALTETEM Schalter — ohne Key-Vorbelegung bliebe der Effekt aus dem falschen
	// Grund aus (Default aus, #1183).
	test.beforeEach(async ({ page }) => {
		await page.addInitScript((key) => localStorage.setItem(key, 'true'), 'pp-animations-enabled');
	});

	/** Öffnet die Einstellungen über den Zahnrad-Toolbar-Button; „Allgemein" ist aktiv. */
	const openSettings = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await toolbar.getByRole('button', { name: /Einstellungen/i }).click();
		await expect(page).toHaveURL(/\/settings\//);
	};

	/** Das reduced-motion-Banner im Tab „Allgemein" — Host + Textanker „Bewegung reduzieren". */
	const reducedMotionBanner = (page: Page) =>
		page.locator('[slot="tab-0"] kol-alert', { hasText: /Bewegung reduzieren/ });

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	const doneToggle = (page: Page, id: number) =>
		item(page, id)
			.locator('[role="toolbar"]')
			.getByRole('button', { name: /Erledigt|Wieder öffnen/i });

	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	test('AK1: bei reduce erscheint die Info-Meldung im Tab „Allgemein"', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await openSettings(page);
		await expect(reducedMotionBanner(page)).toBeVisible();
	});

	test('AK2: Systemwechsel bei offener App blendet die Meldung ein und aus — ohne Neuladen', async ({ page }) => {
		await openSettings(page);
		// Ohne Systemeinstellung gibt es das Banner nicht (bedingtes Rendern, nicht nur hidden).
		await expect(reducedMotionBanner(page)).toHaveCount(0);

		// System-„Bewegung reduzieren" EINSCHALTEN — ohne page.reload().
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(reducedMotionBanner(page)).toBeVisible();

		// Und wieder AUSschalten — Meldung verschwindet live.
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(reducedMotionBanner(page)).toHaveCount(0);
	});

	test('AK5: reduce NACH App-Load aktiviert → nächste Erledigt-Fete bleibt aus (ohne Reload)', async ({ page }) => {
		const id = await createTask(page, uniqueTitle('Live'));
		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();

		// Systemwechsel bei OFFENER App — kein page.reload(), sonst wäre der Test wertlos.
		await page.emulateMedia({ reducedMotion: 'reduce' });

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// Der Statuswechsel funktioniert trotzdem …
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// … aber der Effekt bleibt live aus (Frühcheck in launchConfetti pro Aufruf).
		await page.waitForTimeout(1_000);
		expect(await page.getByTestId('confetti-overlay').count()).toBe(0);
	});

	test('AK6: auf 375×667 ist die Info-Meldung sichtbar und nicht geclippt', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await openSettings(page);
		const banner = reducedMotionBanner(page);
		await expect(banner).toBeVisible();

		// „Lesbar" = nicht horizontal geclippt: Bounding-Box vollständig im Viewport
		// (App-Shell clippt overflow-x — scrollWidth-Aussagen hätten keinen Biss, s. Spec).
		const box = await banner.boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
		}
	});
});
