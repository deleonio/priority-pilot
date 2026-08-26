import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1037 „Schalter im Tab ‚KI-Provider' wie im Tab ‚Allgemein' stylen".
 *
 * Spec-Bezug: docs/spec/issue-1037.md — Erwartetes Ergebnis AK1–AK5.
 *
 * Status quo: `KolButton _label="Neuer Provider"` und die Aktionsleiste
 * `.llm-provider-admin__actions` (Testen/Bearbeiten/Löschen) tragen keine Layout-Klasse wie
 * `.settings-action-btn` (#1017) — sie sind daher in ALLEN Viewports inhaltsbreit statt mobil
 * die Container-Innenbreite zu füllen. → AK1/AK2 sind rot, bis eine gemeinsame Regel existiert.
 *
 * Gemessen wird das HOST-Element `kol-button` (Repo-Konvention wie
 * `settings-action-buttons.spec.ts` — `align-self` wirkt auf den Host, nicht auf das
 * Shadow-DOM-Innere). Die Container-Innenbreite wird aus dem gerenderten Computed Style
 * gelesen, nicht hartkodiert.
 */

interface ProviderDto {
	id: number;
	name: string;
	endpoint: string;
	model: string;
	isActive: boolean;
	kind: 'custom' | 'builtin';
	hasApiKey: boolean;
}

/** Öffnet den KI-Provider-Tab der Einstellungen. */
const openLlmTab = async (page: import('@playwright/test').Page): Promise<void> => {
	await page.goto('/settings/llm');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'KI-Provider', exact: true })).toBeVisible();
};

/** Räumt alle Custom-Provider ab (Builtins bleiben — sie sind nicht löschbar). */
const cleanupCustomProviders = async (page: import('@playwright/test').Page): Promise<void> => {
	const providers = (await (await page.request.get('/api/v1/llm-providers')).json()) as ProviderDto[];
	for (const provider of providers.filter((p) => p.kind === 'custom')) {
		await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
	}
};

/** Legt einen Custom-Provider per API an, damit „Bearbeiten"/„Löschen" gerendert werden. */
const createCustomProvider = async (page: import('@playwright/test').Page): Promise<void> => {
	const response = await page.request.post('/api/v1/llm-providers', {
		data: {
			name: 'Issue-1037 Provider',
			endpoint: 'http://localhost:9/v1',
			apiKey: 'test-key',
			model: 'test-model',
		},
	});
	expect(response.ok()).toBe(true);
};

/** Container-Geometrie aus dem gerenderten Style: Innenbreite + linker Innenrand (nicht hartkodiert). */
async function containerMetrics(
	page: import('@playwright/test').Page,
): Promise<{ innerLeft: number; innerWidth: number }> {
	return page
		.locator('.settings-llm')
		.first()
		.evaluate((el) => {
			const rect = el.getBoundingClientRect();
			const style = window.getComputedStyle(el);
			const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
			const paddingRight = Number.parseFloat(style.paddingRight) || 0;
			return {
				innerLeft: rect.x + paddingLeft,
				innerWidth: rect.width - paddingLeft - paddingRight,
			};
		});
}

/** Host-Element des „Neuer Provider"-Buttons — `_label` liegt auf dem Host (nicht im Shadow-DOM). */
const newProviderButtonHost = (page: import('@playwright/test').Page) =>
	page.locator('kol-button[_label="Neuer Provider"]');

/** Aktions-Buttons der zuletzt angelegten Custom-Provider-Zeile (Testen/Bearbeiten/Löschen). */
const customRowActionButtons = (page: import('@playwright/test').Page) =>
	page.locator('.llm-provider-admin__item', { hasText: 'Issue-1037 Provider' }).locator('kol-button');

test.describe('#1037 Aktions-Buttons „KI-Provider" responsiv wie „Allgemein"', () => {
	test.beforeEach(async ({ page }) => {
		await cleanupCustomProviders(page);
		await createCustomProvider(page);
	});

	/**
	 * AK1/AK2 (rot): Mobil (<768px) füllt „Neuer Provider" ≥90 % der Container-Innenbreite,
	 * die Provider-Zeilen-Buttons (Testen/Bearbeiten/Löschen) füllen je ≥90 % ihres Containers
	 * und stehen untereinander (jeder folgende beginnt unterhalb des vorherigen).
	 */
	test('AK1/AK2: mobil (375px) füllen alle Aktions-Buttons die Innenbreite und stehen untereinander', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 900 });
		await openLlmTab(page);
		await expect(newProviderButtonHost(page)).toBeVisible();

		const { innerWidth } = await containerMetrics(page);
		const newProviderBox = await newProviderButtonHost(page).boundingBox();
		expect(newProviderBox).toBeTruthy();
		expect(newProviderBox!.width).toBeGreaterThanOrEqual(0.9 * innerWidth);

		const rowButtons = customRowActionButtons(page);
		const count = await rowButtons.count();
		expect(count).toBeGreaterThanOrEqual(3); // Testen + Bearbeiten + Löschen (Custom-Provider)

		let previousBottom: number | null = null;
		for (let i = 0; i < count; i++) {
			const box = await rowButtons.nth(i).boundingBox();
			expect(box).toBeTruthy();
			expect(box!.width).toBeGreaterThanOrEqual(0.9 * innerWidth);
			if (previousBottom !== null) {
				expect(box!.y).toBeGreaterThanOrEqual(previousBottom);
			}
			previousBottom = box!.y + box!.height;
		}
	});

	/**
	 * AK3/AK4 (rot): Desktop (1280px) ist „Neuer Provider" inhaltsbreit und linksbündig am
	 * Innenrand; die Provider-Zeilen-Buttons stehen nebeneinander (gleiche y-Position) und
	 * sind je inhaltsbreit statt die Zeile zu füllen.
	 */
	test('AK3/AK4: desktop (1280px) sind alle Aktions-Buttons inhaltsbreit, Zeilen-Buttons nebeneinander', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openLlmTab(page);
		await expect(newProviderButtonHost(page)).toBeVisible();

		const { innerLeft, innerWidth } = await containerMetrics(page);
		const newProviderBox = await newProviderButtonHost(page).boundingBox();
		expect(newProviderBox).toBeTruthy();
		expect(newProviderBox!.width).toBeLessThan(0.5 * innerWidth);
		expect(Math.abs(newProviderBox!.x - innerLeft)).toBeLessThanOrEqual(2);

		const rowButtons = customRowActionButtons(page);
		const count = await rowButtons.count();
		expect(count).toBeGreaterThanOrEqual(3);

		const boxes = [];
		for (let i = 0; i < count; i++) {
			const box = await rowButtons.nth(i).boundingBox();
			expect(box).toBeTruthy();
			boxes.push(box!);
		}
		const rowWidth = Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x));
		for (const box of boxes) {
			expect(box.width).toBeLessThan(0.5 * rowWidth);
			expect(Math.abs(box.y - boxes[0].y)).toBeLessThanOrEqual(2);
		}
	});

	/**
	 * AK5 (Schutz): Bei 320px, 375px und 1280px wird keiner der Aktions-Buttons horizontal
	 * geclippt (`x + width ≤ viewportWidth`).
	 */
	for (const width of [320, 375, 1280]) {
		test(`AK5: kein horizontales Clipping der Aktions-Buttons bei ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await openLlmTab(page);
			await expect(newProviderButtonHost(page)).toBeVisible();

			const viewportWidth = page.viewportSize()?.width ?? 0;
			const newProviderBox = await newProviderButtonHost(page).boundingBox();
			expect(newProviderBox).toBeTruthy();
			expect(newProviderBox!.x + newProviderBox!.width).toBeLessThanOrEqual(viewportWidth);

			const rowButtons = customRowActionButtons(page);
			const count = await rowButtons.count();
			expect(count).toBeGreaterThanOrEqual(3);
			for (let i = 0; i < count; i++) {
				const box = await rowButtons.nth(i).boundingBox();
				expect(box).toBeTruthy();
				expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
			}
		});
	}
});
