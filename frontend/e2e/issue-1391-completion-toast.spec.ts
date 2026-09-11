import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * E2E-Smoke-Test (#1391, docs/spec/issue-1391.md AK6) für den In-App-Hinweis auf eine erledigte,
 * fremd angelegte Aufgabe — Mobile-First (375px).
 *
 * Anders als beim PWA-Update-Prompt (#353, siehe pwa-update-prompt.spec.ts) hängt `PushToast`
 * nicht an einem echten Service-Worker-Lebenszyklus, sondern ist unbedingt gemountet und hört auf
 * `message`-Events. Ein `MessageEvent` lässt sich deterministisch auf dem echten
 * `navigator.serviceWorker` der laufenden App dispatchen — kein Stellvertreter-Proxy nötig.
 */

/** Antwortet auf `GET /auth/me` mit 200 + User → die App zeigt die Haupt-App. */
const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com' }),
		}),
	);
};

const dispatchPush = (page: Page, payload: { title: string; body: string }) =>
	page.evaluate((p) => {
		navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'push', payload: p } }));
	}, payload);

test.describe('Priority Pilot — Erledigt-Hinweis Mobile-First (#1391)', () => {
	test('AK6: bei 375px liegt der Hinweis vollständig im Viewport, Schließen-Button ≥44px, Klick schließt ihn', async ({
		page,
	}) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

		await dispatchPush(page, { title: 'Aufgabe erledigt', body: 'Bob Empfänger hat „Rasen mähen" erledigt.' });

		const toast = page.getByTestId('push-toast');
		await expect(toast).toBeVisible();
		await expect(toast).toContainText('Aufgabe erledigt');

		const toastBox = await toast.boundingBox();
		expect(toastBox, 'Hinweis-Bounding-Box muss messbar sein').not.toBeNull();
		expect(toastBox!.x).toBeGreaterThanOrEqual(0);
		expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(375);

		const closeButton = page.getByTestId('push-toast-close');
		const closeBox = await closeButton.boundingBox();
		expect(closeBox, 'Schließen-Button-Bounding-Box muss messbar sein').not.toBeNull();
		expect(closeBox!.width).toBeGreaterThanOrEqual(44);
		expect(closeBox!.height).toBeGreaterThanOrEqual(44);

		// Hauptnavigation bleibt erreichbar — nicht dauerhaft verdeckt (AK6).
		await expect(page.getByRole('tab', { name: 'Aufgaben', exact: true })).toBeVisible();

		await closeButton.click();
		await expect(toast).toHaveCount(0);
	});
});
