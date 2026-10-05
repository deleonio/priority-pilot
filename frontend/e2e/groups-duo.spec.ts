import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1991 (AK3/AK5, docs/spec/issue-1991.md) — Duo anlegen, Einladungslink,
 * Beitritt des Partners, Duo-Karte. Echtes Backend, zweiter Nutzer per `POST /auth/test-login`
 * in eigenem Context (Muster `groups-invite-links.spec.ts`). AK5 per Bounding-Box, nicht scrollWidth.
 */

const createDuoViaUi = async (page: Page, name: string): Promise<void> => {
	await page.goto('/app/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await page.getByRole('searchbox', { name: 'Name' }).fill(name);
	await page.locator('kol-input-radio').getByText('Duo', { exact: true }).click();
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await waitForStableView(page, 'Gruppen');
};

const openGroup = async (page: Page, name: string): Promise<void> => {
	await page.getByText(name, { exact: true }).first().click();
};

test.describe('Duo (#1991)', () => {
	test.afterEach(async ({ page }) => {
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
		for (const group of groups) await page.request.delete(`/api/v1/groups/${group.id}`);
	});

	test('Duo anlegen, Link erzeugen, Partner tritt bei: Karte zeigt beide, Einladen weg, keine Partner-Aufgaben (AK1-AK3)', async ({
		page,
		baseURL,
	}) => {
		await page.request.post('/auth/test-login', { data: { email: 'duo-a@example.com', displayName: 'Dana Duo' } });
		await createDuoViaUi(page, 'E2E Duo');
		await openGroup(page, 'E2E Duo');
		await expect(page.getByText(/Noch niemand dabei/)).toBeVisible();

		await page.getByText('Einladungslinks', { exact: true }).click();
		await page.getByRole('button', { name: 'Link erzeugen' }).click();
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
		const groupId = groups.find((entry) => entry.name === 'E2E Duo')!.id;
		const links = (await (await page.request.get(`/api/v1/groups/${groupId}/invite-links`)).json()) as unknown[];
		expect(links.length, 'Link muss über die UI erzeugt worden sein').toBeGreaterThan(0);

		// Partner: Link per API (Admin-Kontext) erzeugen und mit zweitem Context einlösen.
		const token = (
			(await (await page.request.post(`/api/v1/groups/${groupId}/invite-links`)).json()) as { token: string }
		).token;
		const login = await page.request.post('/auth/test-login', {
			data: { email: 'duo-b@example.com', displayName: 'Ben Beitritt' },
		});
		const [cookieName, cookieValue] = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')[0]
			.value.split(';')[0]
			.split('=');
		const partnerContext = await page.context().browser()!.newContext();
		await partnerContext.addCookies([{ name: cookieName.trim(), value: cookieValue.trim(), url: baseURL! }]);
		const partnerPage = await partnerContext.newPage();
		try {
			await partnerPage.goto(`/app/gruppen/beitreten?token=${token}`);
			await partnerPage.getByRole('button', { name: 'Gruppe beitreten' }).click();
			await expect(partnerPage.getByText(/beigetreten/i)).toBeVisible();
		} finally {
			await partnerContext.close();
		}

		await page.goto('/app/settings/gruppen');
		await waitForStableView(page, 'Gruppen');
		await openGroup(page, 'E2E Duo');
		await expect(page.getByTestId('duo-member')).toHaveCount(2);
		await expect(page.getByText('Ben Beitritt')).toBeVisible();
		await expect(page.getByText('Einladungslinks', { exact: true })).toBeHidden();
	});

	test('Duo-Karte bleibt bei 375px innerhalb des Viewports (AK5)', async ({ page }) => {
		await page.request.post('/auth/test-login', { data: { email: 'duo-a@example.com', displayName: 'Dana Duo' } });
		await createDuoViaUi(page, 'E2E Duo Schmal');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/gruppen');
		await waitForStableView(page, 'Gruppen');
		await openGroup(page, 'E2E Duo Schmal');

		const box = await page
			.locator('[data-comp="kol-card"], kol-card')
			.filter({ has: page.getByTestId('duo-member') })
			.first()
			.boundingBox();
		expect(box, 'Duo-Karte muss sichtbar sein').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width, 'Karte ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(375);
	});
});
