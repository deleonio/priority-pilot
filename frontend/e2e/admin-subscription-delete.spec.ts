import { expect, test, type Page } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * E2E für #2295 (AK6/AK7): In der Nutzerverwaltung lassen sich Abos eines Nutzers nach einem
 * Bestätigungsdialog löschen — Abbrechen sendet nichts, Bestätigen löscht und lädt neu; Aktionen
 * und Dialog bleiben bei 375px ohne Überlauf bedienbar.
 *
 * Echte Admin-Session über `POST /auth/test-login` (Muster `admin-invoices.spec.ts`, ohne
 * `./fixtures`). Abos entstehen nur über PayPal-Abschluss/Webhook und das Löschen kündigt bei
 * PayPal — beides ist in E2E nicht echt lauffähig: Die Abo-Routen sind gegroutet, die echte
 * Nutzerliste bekommt per `route.fetch` nur den Abo-Status gesetzt. Die Backend-Regeln
 * (PayPal-Fehler, Plan-Neuberechnung, 403/404) deckt `server/src/express/admin-subscription-delete.test.ts` ab.
 */

const MOBILE = { width: 375, height: 812 } as const;
const ADMIN = { email: 'admin-2295@example.com', displayName: 'Anna Admin' };
const SUB = {
	id: 41,
	provider: 'paypal',
	plan: 'pro',
	status: 'active',
	currentPeriodEnd: null,
	createdAt: '2026-10-01T00:00:00.000Z',
};

/** Session + Routen; `deletes()` zählt abgesetzte DELETE-Requests (Abbrechen darf keinen senden). */
const setup = async (page: Page): Promise<{ deletes: () => number }> => {
	const login = await page.request.post('/auth/test-login', {
		data: { email: ADMIN.email, displayName: ADMIN.displayName, role: 'admin' },
	});
	expect(login.status(), 'test-login muss eine Admin-Session liefern').toBe(200);
	let subscriptions = [SUB];
	let deletes = 0;
	await page.route('**/api/v1/admin/users', async (route) => {
		if (route.request().method() !== 'GET') return route.fallback();
		const response = await route.fetch();
		const users = (await response.json()) as { email: string; subscriptionStatus: string | null }[];
		const patched = users.map((user) =>
			user.email === ADMIN.email ? { ...user, subscriptionStatus: subscriptions.length ? 'active' : null } : user,
		);
		return route.fulfill({ response, json: patched });
	});
	await page.route('**/api/v1/admin/users/*/subscriptions**', (route) => {
		if (route.request().method() === 'DELETE') {
			deletes += 1;
			subscriptions = [];
			return route.fulfill({ status: 200, json: {} });
		}
		return route.fulfill({ status: 200, json: subscriptions });
	});
	return { deletes: () => deletes };
};

const openSubscriptions = async (page: Page): Promise<void> => {
	await page.goto('/app/settings/nutzer');
	await waitForStableView(page, 'Balamentum');
	await page.getByText(`Abos von ${ADMIN.displayName}`).click();
	await expect(page.getByRole('button', { name: 'Abo #41 löschen' })).toBeVisible();
};

/** Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x: hidden. */
const expectInViewport = async (page: Page, name: string): Promise<void> => {
	const box = await page.getByRole('button', { name }).boundingBox();
	expect(box, `„${name}“ muss vermessen sein`).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width, `„${name}“ ragt bei 375px aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
};

test.describe('#2295 Admin: Abos löschen', () => {
	test('AK6/AK7: bei 375px Abbrechen ohne Request, Bestätigen löscht und lädt neu', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		const { deletes } = await setup(page);
		await openSubscriptions(page);
		await expectInViewport(page, 'Abo #41 löschen');
		await expectInViewport(page, 'Alle Abos dieses Nutzers löschen');

		await page.getByRole('button', { name: 'Alle Abos dieses Nutzers löschen' }).click();
		await expectInViewport(page, 'Jetzt löschen');
		await expectInViewport(page, 'Abbrechen');
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('button', { name: 'Jetzt löschen' })).toBeHidden();
		expect(deletes(), 'Abbrechen darf keinen Lösch-Request absetzen').toBe(0);

		await page.getByRole('button', { name: 'Abo #41 löschen' }).click();
		const [response] = await Promise.all([
			page.waitForResponse((res) => res.request().method() === 'DELETE'),
			page.getByRole('button', { name: 'Jetzt löschen' }).click(),
		]);
		expect(response.url()).toContain('/subscriptions/41');
		// Neu geladen: ohne Abo verschwindet der Abo-Bereich der Zeile.
		await expect(page.getByText(`Abos von ${ADMIN.displayName}`)).toHaveCount(0);
	});

	test('AK6: Desktop — „Alle Abos dieses Nutzers löschen“ sendet DELETE ohne Abo-Id', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await setup(page);
		await openSubscriptions(page);
		await page.getByRole('button', { name: 'Alle Abos dieses Nutzers löschen' }).click();
		const [response] = await Promise.all([
			page.waitForResponse((res) => res.request().method() === 'DELETE'),
			page.getByRole('button', { name: 'Jetzt löschen' }).click(),
		]);
		expect(new URL(response.url()).pathname).toMatch(/\/admin\/users\/\d+\/subscriptions$/);
	});
});
