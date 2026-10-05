import { expect, test } from '@playwright/test';

/**
 * #1979 (Vertrag: docs/spec/issue-1979.md) — Balance-Check: fünf Fragen, Ergebnis ohne Konto, teilbar per URL,
 * kein Netzwerk/Storage, mobil ohne Überlauf (Bounding-Box statt scrollWidth, App-Shell clippt).
 */
const answerAll = async (page: import('@playwright/test').Page, values: number[]) => {
	for (const [index, value] of values.entries()) {
		await page.locator(`input[name="q${index}"][value="${value}"]`).check({ force: true });
	}
};

test.describe('Balance-Check (#1979)', () => {
	test('Ergebnis erst nach fünf Antworten, ohne Netzwerk/Storage, mit App-Link', async ({ page, context }) => {
		const requests: string[] = [];
		page.on('request', (request) => requests.push(new URL(request.url()).pathname));
		const response = await page.goto('/balance-check/');
		expect(response?.status()).toBe(200);
		await expect(page.locator('input[type="radio"]')).toHaveCount(25);
		await expect(page.locator('[data-result]')).toBeHidden();
		await answerAll(page, [4, 3, 2, 1]);
		await expect(page.locator('[data-result]')).toBeHidden();
		await answerAll(page, [4, 3, 2, 1, 0]);
		await expect(page.locator('[data-result]')).toBeVisible();
		await expect(page.locator('[data-result] a[href="/app/"]')).toBeVisible();
		await expect(page).toHaveURL(/\?a=43210$/);
		expect(requests.filter((path) => path.startsWith('/api/') || path.startsWith('/auth/'))).toEqual([]);
		expect(await context.cookies()).toEqual([]);
		expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
	});

	test('Ergebnis-URL zeigt frisch geöffnet dasselbe Ergebnis', async ({ page, context }) => {
		await page.goto('/balance-check/');
		await answerAll(page, [4, 3, 2, 1, 0]);
		const shown = await page.locator('[data-result]').innerText();
		const fresh = await context.newPage();
		await fresh.goto(page.url());
		await expect(fresh.locator('[data-result]')).toBeVisible();
		expect(await fresh.locator('[data-result]').innerText()).toBe(shown);
	});

	test('manipulierte URL führt zum leeren Fragebogen', async ({ page }) => {
		for (const raw of ['50123', '4012', 'abcde']) {
			const response = await page.goto(`/balance-check/?a=${raw}`);
			expect(response?.status()).toBe(200);
			await expect(page.locator('input[type="radio"]')).toHaveCount(25);
			await expect(page.locator('[data-result]')).toBeHidden();
			await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
		}
	});

	test('Ablauf läuft mobil nicht horizontal über, Touch-Ziele >= 44 px', async ({ page }) => {
		await page.goto('/balance-check/');
		await answerAll(page, [1, 2, 3, 4, 0]);
		await expect(page.locator('[data-result]')).toBeVisible();
		const viewport = page.viewportSize()?.width ?? 375;
		const elements = await page.locator('main h1, main h2, main p, main label, main a, main button').all();
		expect(elements.length, 'Seite muss sichtbaren Inhalt haben').toBeGreaterThan(10);
		for (const element of elements) {
			const box = await element.boundingBox();
			if (!box) continue;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(viewport + 1);
		}
		for (const label of await page.locator('main label:has(input[type="radio"])').all()) {
			const box = await label.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
			expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		}
		await expect(page.locator('[data-share]')).toBeVisible();
	});
});
