import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2350 (Spec docs/spec/issue-2350.md, AK4/AK5): KI-Entwurf-Aktion in „Aufgabe
 * bearbeiten". Echtes Backend, eigene Session (MEMORY 2026-10-05); nur der LLM-getriebene
 * `POST …/ai-draft` ist per `page.route` gemockt (E2E-Backend läuft ohne LLM-Key). Bounding-Box
 * statt scrollWidth (MEMORY 2026-08-24).
 */
const DRAFT = 'Sehr geehrte Damen und Herren, hiermit beantrage ich eine Kur.';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: 'ai-draft-2350@example.com', displayName: 'Entwurf Tester' },
	});
	expect(res.status()).toBe(200);
	await page.unroute('**/auth/me');
};

const createTask = async (page: Page, title: string): Promise<number> => {
	const res = await page.request.post('/api/v1/tasks', { data: { title } });
	expect(res.status()).toBe(201);
	return ((await res.json()) as { id: number }).id;
};

const openEdit = async (page: Page, id: number): Promise<void> => {
	await page.getByTestId(`task-list-item-${id}`).getByRole('button', { name: 'Weitere Aktionen' }).click();
	await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await waitForStableView(page);
};

const box = async (page: Page, testId: string) => {
	const locator = page.getByTestId(testId);
	let b = await locator.boundingBox();
	for (let i = 0; i < 30 && b === null; i++) {
		await page.waitForTimeout(100);
		b = await locator.boundingBox();
	}
	expect(b).not.toBeNull();
	return b!;
};

test('#2350: Aktion nur an geeigneter Aufgabe; Entwurf getrennt anzeigen und löschen (375 px)', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await login(page);
	const suitableId = await createTask(page, 'E-Mail an Krankenkasse wegen Kur-Antrag entwerfen');
	const otherId = await createTask(page, 'Fenster putzen');
	await page.route('**/api/v1/tasks/*/ai-draft', async (route) => {
		if (route.request().method() === 'POST') {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ aiDraft: DRAFT }) });
		} else {
			await route.continue();
		}
	});
	await page.goto('/app/');
	await waitForStableView(page, 'Dashboard');
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

	// AK4: ungeeignete Aufgabe ohne Aktion
	await openEdit(page, otherId);
	await expect(page.getByTestId('ai-draft-action')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();

	// AK4/AK5: geeignete Aufgabe — Aktion bedienbar, Entwurf im eigenen Bereich
	await openEdit(page, suitableId);
	const action = page.getByTestId('ai-draft-action');
	await expect(action).toBeVisible();
	expect((await box(page, 'ai-draft-action')).height).toBeGreaterThanOrEqual(44);
	await action.click();
	const section = page.getByTestId('ai-draft-section');
	await expect(section).toContainText(DRAFT);
	const sectionBox = await box(page, 'ai-draft-section');
	expect(sectionBox.x + sectionBox.width).toBeLessThanOrEqual(375 + 1);
	const del = page.getByTestId('ai-draft-delete');
	expect((await box(page, 'ai-draft-delete')).height).toBeGreaterThanOrEqual(44);

	// AK4: löschen
	await del.click();
	await expect(page.getByTestId('ai-draft-section')).toHaveCount(0);
});
