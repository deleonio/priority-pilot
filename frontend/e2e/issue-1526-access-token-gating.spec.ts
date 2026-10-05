import { expect, test, type Page } from './fixtures';
import { accordionTrigger, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1526 (Spec docs/spec/issue-1526.md) — AK1 Tab-Beschriftung „Access-Token" und
 * AK8 375px-Sichtbarkeit von Gating-Alerts. Seit #1903 liegen die Access-Token im Tab „KI" (AK1
 * nachgezogen, AK6 ergänzt).
 *
 * Läuft gegen das echte Backend (Muster `issue-1484-plan-badges.spec.ts`): eine frische Session
 * über `POST /auth/test-login` liegt auf Paket `free` — weder `mcp_read` noch `mcp_readwrite` sind
 * enthalten, beide Gating-Alerts aus AK2/AK4 erscheinen also.
 *
 * Rot, bis der Tab „Access-Token" heißt (AK1) und beide Alerts existieren (AK8 misst sonst nichts).
 */

const TEST_EMAIL = 'access-token-gating-1526@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Gating Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
	// Siehe issue-1484-plan-badges.spec.ts: der Fixture-Mock von `/auth/me` liefert keine
	// Entitlement-Map, diese Spec braucht die echte Serverantwort (Paket `free`).
	await page.unroute('**/auth/me');
};

const seedApiToken = async (page: Page): Promise<void> => {
	// Erzeugen läuft direkt über die API, nicht über die (bei Paket `free` gesperrte) UI — AK2
	// deaktiviert „Token erzeugen" gerade für diese Session.
	const res = await page.request.post('/api/v1/api-tokens', { data: { name: 'e2e-gating', expiresInDays: 30 } });
	expect(res.status(), 'API-Token muss serverseitig anlegbar sein (Guard bleibt unverändert)').toBe(201);
};

const deleteAllTokens = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/api-tokens');
	if (!res.ok()) return;
	for (const token of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/api-tokens/${token.id}`);
	}
};

/** s. issue-1484-plan-badges.spec.ts: `boundingBox()` nachmessen statt einmal zu greifen. */
const boundingBoxWhenLaidOut = async (locator: ReturnType<Page['locator']>) => {
	for (let attempt = 0; attempt < 30; attempt++) {
		const box = await locator.boundingBox();
		if (box !== null) return box;
		await locator.page().waitForTimeout(100);
	}
	return null;
};

test.describe('Balamentum — #1526: Access-Token-Reiter und Gating', () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.afterEach(async ({ page }) => {
		await deleteAllTokens(page);
	});

	// Test-Pflege #1903 AK8: der Reiter „Access-Token" ist im Tab „KI" aufgegangen.
	test('AK1: /settings/zugriff öffnet den Reiter „KI" mit den Access-Token', async ({ page }) => {
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await expect(page.getByRole('tab', { name: 'KI', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByTestId('api-tokens-panel')).toBeVisible();
	});

	// #1903 AK6 (Q2=B): Free sperrt alles im Tab „KI" — auch mit eigenem Provider.
	test('#1903 AK6: Free — Tab „KI" sichtbar, Schalter, Provider und Token gesperrt, auch mit eigenem Provider', async ({
		page,
	}) => {
		const created = await page.request.post('/api/v1/llm-providers', {
			data: {
				name: 'Gating-Provider-1903',
				endpoint: 'http://llm.invalid/v1',
				apiKey: 'test-key',
				model: 'test-model',
			},
		});
		expect(created.ok(), 'Custom-LLM-Provider muss serverseitig anlegbar sein').toBe(true);
		const { id } = (await created.json()) as { id: number };
		try {
			await page.goto('/app/settings/llm');
			await waitForStableView(page, 'Allgemein');

			await expect(page.getByRole('tab', { name: 'KI', exact: true })).toBeVisible();
			await expect(
				page
					.getByRole('switch', { name: /^KI aktivieren$/ })
					.or(page.getByRole('checkbox', { name: /^KI aktivieren$/ })),
			).toBeDisabled();
			// Test-Pflege: Provider und Token liegen in KolAccordions, die bei gesperrter KI zu UND gesperrt
			// sind (`_disabled`, `SettingsPage.tsx:1018-1019`) — ihr Inhalt ist nicht erreichbar, der Kopf trägt
			// `aria-disabled`.
			await expect(accordionTrigger(page, 'KI-Provider')).toHaveAttribute('aria-disabled', 'true');
			await expect(accordionTrigger(page, 'Access-Token')).toHaveAttribute('aria-disabled', 'true');
		} finally {
			await page.request.delete(`/api/v1/llm-providers/${id}`);
		}
	});

	// Test-Pflege: Die Gating-Alerts im Access-Token-Akkordeon sind bei gesperrter KI nicht erreichbar
	// (Akkordeon zu und gesperrt) — geprüft wird der gesperrte Kopf im Viewport.
	test('AK8: gesperrtes Access-Token-Akkordeon liegt bei 375px ohne horizontales Scrollen im Sichtbereich', async ({
		page,
	}) => {
		await seedApiToken(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const trigger = accordionTrigger(page, 'Access-Token');
		await expect(trigger).toHaveAttribute('aria-disabled', 'true');
		const box = await boundingBoxWhenLaidOut(trigger);
		expect(box, 'Akkordeon-Kopf muss Layout haben').not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
	});
});
