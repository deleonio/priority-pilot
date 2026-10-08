import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1936 AK7/AK8 (Spec docs/spec/issue-1936.md) — Wissens-Einträge im Tab „KI“.
 *
 * Läuft gegen das echte Backend. Das Paket Pro kommt über `POST /auth/test-login` mit `plan: 'pro'`
 * (Test-Hook; der Parameter existiert heute nicht — Implementierung muss ihn ergänzen, Phasen-Notiz).
 * AK8: 375 px, Bounding-Box statt `scrollWidth` (App-Shell clippt mit `overflow-x: hidden`), Touch-Ziele ≥ 44 px.
 */

const TEXT = 'Ich trainiere dienstags im Verein.';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: 'knowledge-1936@example.com', displayName: 'Wissen Tester', plan: 'pro' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
	await page.unroute('**/auth/me');
};

const deleteAll = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/knowledge-entries');
	if (!res.ok()) return;
	for (const entry of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/knowledge-entries/${entry.id}`);
	}
};

test.describe('Balamentum — #1936: Wissens-Einträge', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
	});
	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	test('AK7/AK8: anlegen, ändern, löschen bei 375px ohne Überlauf, Touch-Ziele ≥ 44px', async ({ page }) => {
		await login(page);
		await page.goto('/app/settings/llm');
		await waitForStableView(page, 'Allgemein');

		const input = page.getByLabel(/eintrag/i).first();
		await expect(input).toBeVisible();
		await input.fill(TEXT);
		const create = page.getByRole('button', { name: /^(anlegen|hinzufügen)$/i });
		const createBox = await create.boundingBox();
		expect(createBox!.height).toBeGreaterThanOrEqual(44);
		expect(createBox!.x + createBox!.width).toBeLessThanOrEqual(376);
		await create.click();

		const row = page.getByTestId('knowledge-entry-row').filter({ hasText: TEXT });
		await expect(row).toBeVisible();
		const rowBox = await row.boundingBox();
		expect(rowBox!.x).toBeGreaterThanOrEqual(0);
		expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(376);

		await row.getByRole('button', { name: /bearbeiten/i }).click();
		await row.getByLabel(/eintrag/i).fill('Ich trainiere mittwochs.');
		await row.getByRole('button', { name: /speichern/i }).click();
		await expect(page.getByTestId('knowledge-entry-row').filter({ hasText: 'mittwochs' })).toBeVisible();

		const del = page.getByTestId('knowledge-entry-row').getByRole('button', { name: /löschen/i });
		expect((await del.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await del.click();
		await page
			.locator('kol-dialog')
			.getByRole('button', { name: /endgültig löschen/i })
			.click();
		await expect(page.getByTestId('knowledge-entry-row')).toHaveCount(0);
	});
});
