import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2349 (Spec docs/spec/issue-2349.md, AK4/AK5): Kennzeichnung der KI-Eignung in
 * der Aufgabenzeile. Echtes Backend, eigene Session (MEMORY 2026-10-05, Sharding). Ohne
 * `MONETIZATION_ENFORCED` ist `ai_assist` für jeden Nutzer frei — die Kennzeichnung erscheint also
 * auch für das Standard-Testkonto. Bounding-Box statt scrollWidth (MEMORY 2026-08-24).
 */
const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: 'ai-suitability-2349@example.com', displayName: 'Eignung Tester' },
	});
	expect(res.status()).toBe(200);
	await page.unroute('**/auth/me');
};

const createTask = async (page: Page, title: string): Promise<number> => {
	const res = await page.request.post('/api/v1/tasks', { data: { title } });
	expect(res.status()).toBe(201);
	return ((await res.json()) as { id: number }).id;
};

test('#2349: nur die geeignete Aufgabe trägt das Kategorie-Badge, bei 375 px ohne Ausbruch', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await login(page);
	const suitableId = await createTask(page, 'E-Mail an Krankenkasse wegen Kur-Antrag entwerfen');
	const otherId = await createTask(page, 'Fenster putzen');
	await page.goto('/app/');
	await waitForStableView(page, 'Dashboard');
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

	const suitableRow = page.getByTestId(`task-list-item-${suitableId}`);
	const badge = suitableRow.getByTestId('ai-suitability-badge');
	await expect(badge).toBeVisible();
	await expect(badge).toContainText('Entwurf');
	await expect(page.getByTestId(`task-list-item-${otherId}`).getByTestId('ai-suitability-badge')).toHaveCount(0);

	// AK5: rechte Badge-Kante liegt innerhalb der Zeile und des Viewports (Box ggf. nachmessen).
	let badgeBox = await badge.boundingBox();
	for (let i = 0; i < 30 && badgeBox === null; i++) {
		await page.waitForTimeout(100);
		badgeBox = await badge.boundingBox();
	}
	const rowBox = await suitableRow.boundingBox();
	expect(badgeBox).not.toBeNull();
	expect(rowBox).not.toBeNull();
	expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
	expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(375 + 1);
});
