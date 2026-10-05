import { expect, test } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * ROTE Spec-e2e für #1849 (Spec: docs/spec/issue-1849.md, AK4) — im Tab „Säulen“ erklärt jede der
 * fünf Beschreibungen das Wochen-Soll („pro Woche“) und liegt bei 375 px vollständig im Viewport
 * (Bounding-Box statt `scrollWidth`, die App-Shell clippt `overflow-x`).
 */
// #1984: Diese Specs prüfen das Expertenverhalten (Prozent-/Gewichtsregler sichtbar) — die
// Präferenz kommt per localStorage-Seed vor dem Seitenaufbau (Muster ai-disable.spec.ts).
// Eigene Session: ohne sie sieht die Spec die Säulen aller Nutzer der Shard-DB (Muster #2074/#2078).
test.beforeEach(async ({ page }) => {
	await registerOwnSession(page, 'pillar-descriptions-1849');
	await page.addInitScript(() => {
		localStorage.setItem('pp-expert-mode', 'true');
	});
});

test.describe('#1849 Säulenbeschreibungen mit Wochen-Soll (375 px)', () => {
	test('AK4: fünf Beschreibungen nennen „pro Woche“ und laufen nicht aus dem Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Balamentum');

		const descriptions = page.locator('.settings-pillars .pillar-list-description');
		await expect(descriptions).toHaveCount(5);
		for (let i = 0; i < 5; i += 1) {
			const description = descriptions.nth(i);
			await expect(description).toBeVisible();
			await expect(description).toContainText(/pro Woche/);
			await expect
				.poll(async () => {
					const box = await description.boundingBox();
					return box ? box.x + box.width : Infinity;
				})
				.toBeLessThanOrEqual(375);
		}
	});
});
