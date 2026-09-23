import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1525 (Spec docs/spec/issue-1525.md AK1/AK6) — Paket-Sperre am KI-Schalter
 * bei 375×812.
 *
 * Läuft gegen das echte Backend (Muster `issue-1484-plan-badges.spec.ts`): eine frische Session
 * über `POST /auth/test-login` liegt standardmäßig auf Paket `free` — Free hat keine
 * `ai_assist`-Berechtigung, der Schalter „KI-Features aktiv" ist also deaktiviert und trägt einen
 * Paket-Alert.
 *
 * AK1: der Schalter ist deaktiviert, darüber steht ein Alert mit Paketnamen und Sprung-CTA.
 * AK6: bei 375px liegt der Alert vollbreit ÜBER dem Schalter (getrennte Zeilen, Alert-Unterkante
 * oberhalb der Schalter-Oberkante) und die Karte „KI-Funktionen" bleibt innerhalb des Viewports
 * (Bounding-Box, keine `scrollWidth`-Prüfung, MEMORY 2026-08-24 — die App-Shell clippt mit
 * `overflow-x: hidden`).
 *
 * Heute rot: kein Paket-Alert, kein `_disabled` am Schalter — die Karte bleibt unverändert.
 */

const TEST_EMAIL = 'ai-gate-viewport-1525@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'AI Gate Viewport Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
	await page.unroute('**/auth/me');
};

/** Bounding-Box-Messung mit Nachwarten (Muster `issue-1484-plan-badges.spec.ts`). */
const boundingBoxWhenLaidOut = async (locator: ReturnType<Page['locator']>) => {
	for (let attempt = 0; attempt < 30; attempt++) {
		const box = await locator.boundingBox();
		if (box !== null) return box;
		await locator.page().waitForTimeout(100);
	}
	return null;
};

const expectWithinViewport = async (locator: ReturnType<Page['locator']>): Promise<void> => {
	const box = await boundingBoxWhenLaidOut(locator);
	expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
	expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
};

test.describe('Priority Pilot — #1525: KI-Schalter Paket-Sperre (375px)', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
	});

	test('AK1: Free-Konto — Schalter deaktiviert, Paket-Alert mit Sprung-CTA zum Pakete-Reiter', async ({ page }) => {
		await page.goto('/app/settings/llm');
		await waitForStableView(page, 'Priority Pilot');

		const aiSwitch = page
			.getByRole('switch', { name: /^KI-Features aktiv$/ })
			.or(page.getByRole('checkbox', { name: /^KI-Features aktiv$/ }));
		await expect(aiSwitch).toBeVisible();
		await expect(aiSwitch).toBeDisabled();

		const planAlert = page.locator('.settings-llm-switch-row kol-alert');
		await expect(planAlert).toBeVisible();
		await expect(planAlert).toContainText('Pro');

		await planAlert.getByRole('button').click();
		await expect(page.getByRole('heading', { name: 'Pakete im Vergleich' })).toBeVisible();
	});

	test('AK6: bei 375px liegt der Alert über dem Schalter, die Karte bleibt im Viewport', async ({ page }) => {
		await page.goto('/app/settings/llm');
		await waitForStableView(page, 'Priority Pilot');

		const card = page.locator('kol-card[_label="KI-Funktionen"]');
		await expectWithinViewport(card);

		const aiSwitch = page
			.getByRole('switch', { name: /^KI-Features aktiv$/ })
			.or(page.getByRole('checkbox', { name: /^KI-Features aktiv$/ }));
		const planAlert = page.locator('.settings-llm-switch-row kol-alert');

		const alertBox = await boundingBoxWhenLaidOut(planAlert);
		const switchBox = await boundingBoxWhenLaidOut(aiSwitch);
		expect(alertBox, 'Alert muss eine Bounding-Box haben').not.toBeNull();
		expect(switchBox, 'Schalter muss eine Bounding-Box haben').not.toBeNull();

		// Getrennte Zeilen, Alert oberhalb: seine Unterkante liegt über der Schalter-Oberkante.
		expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(switchBox!.y + 1);
		// Alert liegt vollbreit über dem Schalter (annähernd gleiche linke Kante, keine Nebeneinander-Anordnung).
		expect(Math.abs(alertBox!.x - switchBox!.x)).toBeLessThanOrEqual(2);
	});
});
