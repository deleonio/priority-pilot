import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1484 (T3b, Spec docs/spec/issue-1484.md AK8/AK9) — Paket-Badges an den
 * übrigen Grenzstellen bei 375×812.
 *
 * Läuft gegen das echte Backend (Muster `issue-1352-api-tokens.spec.ts`): eine frische Session
 * über `POST /auth/test-login` liegt standardmäßig auf Paket `free` — Free hat weder `ai_assist`
 * noch `voice_input` (seit #1484 A1) noch `mcp_readwrite`, jede Grenzstelle zeigt also den
 * Paket-Badge-Zweig (mit (i)-Schalter), nicht den Haken.
 *
 * AK8: Badge und umgebende Zeile bleiben innerhalb des 375px-Viewports (Bounding-Box, keine
 * `scrollWidth`-Prüfung, MEMORY 2026-08-24 — die App-Shell clippt mit `overflow-x: hidden`).
 * AK9: außerhalb des geöffneten Angebots-Dialogs erscheint kein Preis-/Werbetext.
 */

const TEST_EMAIL = 'plan-badges-1484@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Badge Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	if (!response.ok()) return;
	for (const task of (await response.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const deleteAllTokens = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/api-tokens');
	if (!res.ok()) return;
	for (const token of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/api-tokens/${token.id}`);
	}
};

/** Bounding-Box darf den 375px-Viewport nicht überragen (kein horizontales Scrollen). */
const expectWithinViewport = async (locator: ReturnType<Page['locator']>): Promise<void> => {
	const box = await locator.boundingBox();
	expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
	expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
};

test.describe('Priority Pilot — #1484: Paket-Badges an den übrigen Grenzstellen (375px)', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
	});

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllTokens(page);
	});

	test('AK3/AK8: Aufgabenformular zeigt ai_assist- und voice_input-Badges ohne horizontalen Overflow', async ({
		page,
	}) => {
		await page.goto('/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		const aiAssistBadge = page.getByTestId('plan-badge-ai_assist').first();
		await expect(aiAssistBadge).toBeVisible();
		await expectWithinViewport(aiAssistBadge);

		const voiceBadge = page.getByTestId('plan-badge-voice_input').first();
		await expect(voiceBadge).toBeVisible();
		await expectWithinViewport(voiceBadge);
	});

	test('AK5: der (i)-Schalter am ai_assist-Badge öffnet das Angebot, kein zweiter Dialog', async ({ page }) => {
		await page.goto('/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByTestId('plan-badge-info-ai_assist').first().click();

		// Genau EIN Angebots-Dialog (PlanOfferDialog, App.tsx) — kein Modal-in-Modal.
		await expect(page.getByRole('dialog').filter({ hasText: /Pro|Max|Ultimate/ })).toHaveCount(1);
	});

	test('AK3/AK8: Zugriff-Einstellungen zeigen das mcp_readwrite-Badge an der Rechte-Zeile ohne Overflow', async ({
		page,
	}) => {
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');
		await page.getByTestId('api-token-duration-select').selectOption({ label: '365 Tage (12 Monate)' });
		await page.getByRole('button', { name: 'Token erzeugen' }).click();

		const badge = page.getByTestId('plan-badge-mcp_readwrite').first();
		await expect(badge).toBeVisible();
		await expectWithinViewport(badge);
	});

	test('AK9: außerhalb des Angebots-Dialogs erscheint kein Preis-/Werbetext', async ({ page }) => {
		await page.goto('/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Kein offener Angebots-Dialog in diesem Zustand — daher darf kein Preistext (€) im
		// sichtbaren Formular stehen, außer innerhalb eines `PlanBadge`/`PlanOfferDialog`.
		await expect(page.getByRole('dialog').filter({ hasText: '€' })).toHaveCount(0);
		const priceOutsideBadge = page
			.locator('body >> text=/\\d+\\s?€/')
			.filter({ hasNot: page.locator('[data-testid^="plan-badge"]') });
		await expect(priceOutsideBadge).toHaveCount(0);
	});
});
