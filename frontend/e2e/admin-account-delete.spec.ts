import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * E2E für #2327 (AK5/AK7): Admin löscht in der Nutzerverwaltung ein fremdes Konto — Abbrechen
 * löscht nichts, Bestätigen entfernt den Nutzer aus der Liste; Dialog bei 375px vollständig im
 * Viewport. Echtes Backend, echte Admin-Session über `POST /auth/test-login` (Muster
 * `admin-subscription-delete.spec.ts`, ohne `./fixtures`); das Zielkonto legt ein zweiter
 * test-login über die separate `request`-Fixture an. Bounding-Box statt scrollWidth.
 */

const MOBILE = { width: 375, height: 812 } as const;
const ADMIN = { email: 'admin-2327@example.com', displayName: 'Anna Admin' };

const setup = async (page: Page, request: APIRequestContext, target: { email: string; displayName: string }) => {
	const created = await request.post('/auth/test-login', { data: { ...target, role: 'member' } });
	expect(created.status(), 'test-login Zielkonto').toBe(200);
	const login = await page.request.post('/auth/test-login', { data: { ...ADMIN, role: 'admin' } });
	expect(login.status(), 'test-login Admin').toBe(200);
	await page.goto('/app/settings/nutzer');
	await waitForStableView(page, 'Balamentum');
};

const expectInViewport = async (page: Page, name: string): Promise<void> => {
	const box = await page.getByRole('button', { name }).boundingBox();
	expect(box, `„${name}“ muss vermessen sein`).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width, `„${name}“ ragt bei 375px aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
	expect(box!.y + box!.height, `„${name}“ liegt unterhalb des Viewports`).toBeLessThanOrEqual(812);
};

const rowOf = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name });

test.describe('#2327 Admin: Konto löschen', () => {
	test('AK5/AK7: 375px — Abbrechen löscht nichts, Bestätigen entfernt den Nutzer; kein Button beim eigenen Eintrag', async ({
		page,
		request,
	}) => {
		await page.setViewportSize(MOBILE);
		const target = { email: 'ziel-2327-a@example.com', displayName: 'Zora Ziel' };
		await setup(page, request, target);
		await expect(rowOf(page, ADMIN.displayName).getByRole('button', { name: /Konto löschen/ })).toHaveCount(0);

		await rowOf(page, target.displayName)
			.getByRole('button', { name: /Konto löschen/ })
			.click();
		await expectInViewport(page, 'Weiter');
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(rowOf(page, target.displayName)).toHaveCount(1);

		await rowOf(page, target.displayName)
			.getByRole('button', { name: /Konto löschen/ })
			.click();
		await page.getByRole('button', { name: 'Weiter' }).click();
		await expectInViewport(page, 'Konto endgültig löschen');
		await expectInViewport(page, 'Abbrechen');
		const [response] = await Promise.all([
			page.waitForResponse((res) => res.request().method() === 'DELETE' && /\/admin\/users\/\d+$/.test(res.url())),
			page.getByRole('button', { name: 'Konto endgültig löschen' }).click(),
		]);
		expect(response.status()).toBe(204);
		await expect(page.getByText(target.displayName, { exact: true })).toHaveCount(0);
	});
});
