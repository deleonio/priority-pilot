import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2082 „Füllstand-Verlauf der letzten 28 Tage" (docs/spec/issue-2082.md).
 *
 * AK3: Die angezeigten Start-/Endwerte stimmen mit `GET /scores/balance/history` derselben Session überein.
 * AK5: Bei 375 px liegt die Card innerhalb der Viewportbreite (Bounding-Box — die App-Shell clippt
 * overflow-x, scrollWidth taugt nicht).
 */

type Eintrag = { tag: string; fuellstandProzent: number };

const iso = (d: Date): string =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const erledigeAufgabe = async (page: Page, title: string): Promise<void> => {
	const created = await page.request.post('/api/v1/tasks', { data: { title, priority: 3, estimatedEffort: 1 } });
	expect(created.ok()).toBeTruthy();
	const task = (await created.json()) as { id: number };
	expect((await page.request.patch(`/api/v1/tasks/${task.id}`, { data: { status: 'Done' } })).ok()).toBeTruthy();
};

test.describe('Balamentum — #2082: Füllstand-Verlauf', () => {
	test('AK3 — Start- und Endwert der Card stimmen mit dem Verlauf-Endpunkt überein', async ({ page }) => {
		await registerOwnSession(page, 'balance-history-2082');
		await erledigeAufgabe(page, 'E2E 2082 erledigt');

		const heute = new Date();
		const von = new Date(heute);
		von.setDate(von.getDate() - 27);
		const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
		const res = await page.request.get('/api/v1/scores/balance/history', {
			params: { von: iso(von), bis: iso(heute), tz },
		});
		expect(res.ok()).toBeTruthy();
		const verlauf = (await res.json()) as Eintrag[];
		expect(verlauf).toHaveLength(28);

		await page.goto('/app/');
		await waitForStableView(page);
		const card = page.getByTestId('balance-history-card');
		await expect(card).toBeVisible();
		await expect(card.getByTestId('balance-history-start')).toContainText(
			String(Math.round(verlauf[0].fuellstandProzent)),
		);
		await expect(card.getByTestId('balance-history-end')).toContainText(
			String(Math.round(verlauf[27].fuellstandProzent)),
		);
		await expect(card.getByTestId('balance-history-trend')).toContainText(/Aufwärts|Abwärts|Stabil/);
	});

	test('AK5 — bei 375px bleibt die Card innerhalb der Viewportbreite', async ({ page }) => {
		await registerOwnSession(page, 'balance-history-2082m');
		await erledigeAufgabe(page, 'E2E 2082 mobil');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const card = page.getByTestId('balance-history-card');
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});
});
