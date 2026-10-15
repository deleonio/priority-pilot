import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1360 „Streak-Anzeige auf dem Dashboard" (Spec docs/spec/issue-1360.md).
 *
 * AK5/AK6: Das Dashboard zeigt eine Streak-Card (`data-testid="streak-card"`) mit dem aktuellen
 * Streak und der Bestmarke. Bei 375px Viewportbreite bleibt die Card vollständig innerhalb der
 * Viewportbreite (Bounding-Box, kein horizontales Scrollen — Muster `ai-disable.spec.ts` AK6).
 *
 * Läuft wie `issue-1066-nearby-card.spec.ts` gegen das echte Backend (In-Memory-DB, Vite-Proxy);
 * ein erledigter Task heute liefert eine deterministische Streak von 1 Tag.
 */

const completeTaskToday = async (page: import('@playwright/test').Page, title: string): Promise<void> => {
	const createRes = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(createRes.ok()).toBeTruthy();
	const task = (await createRes.json()) as { id: number };
	const doneRes = await page.request.patch(`/api/v1/tasks/${task.id}`, { data: { status: 'Done' } });
	expect(doneRes.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: import('@playwright/test').Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Balamentum — #1360: Streak-Anzeige', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK5 — Dashboard zeigt die Streak-Card mit aktuellem Wert und Bestmarke', async ({ page }) => {
		await completeTaskToday(page, 'E2E 1360 heute erledigt');
		await page.goto('/app/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await expect(streakCard).toBeVisible();
		await expect(streakCard.getByTestId('streak-best')).toBeVisible();
	});

	test('AK6 — bei 375px bleibt die Streak-Card innerhalb der Viewportbreite (kein horizontales Scrollen)', async ({
		page,
	}) => {
		await completeTaskToday(page, 'E2E 1360 mobile');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await expect(streakCard).toBeVisible();
		const box = await streakCard.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375 + 1);
	});

	test('#1819 AK1/AK4 — bei 375px ist der Hilfetext per Tippen erreichbar und bleibt innerhalb der Card', async ({
		page,
	}) => {
		await completeTaskToday(page, 'E2E 1819 Hilfetext');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await streakCard.getByText('So zählt der Streak').click();
		const help = streakCard.getByTestId('streak-help');
		await expect(help).toBeVisible();
		await expect(help).toContainText('Fälligkeitstag');

		const cardBox = await streakCard.boundingBox();
		const helpBox = await help.boundingBox();
		expect(cardBox).not.toBeNull();
		expect(helpBox).not.toBeNull();
		expect(helpBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
		expect(helpBox!.x + helpBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
	});

	test('#1971 AK7/AK8 — ausgewogene Woche: „x Wochen ausgewogen" bleibt bei 375px in der Card', async ({ page }) => {
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		const share = 100 / pillars.length;
		// Drei Aufgaben heute decken alle Säulen ab ⇒ die laufende Woche ist ausgewogen.
		for (const title of ['E2E 1971 a', 'E2E 1971 b', 'E2E 1971 c']) {
			const createRes = await page.request.post('/api/v1/tasks', {
				data: {
					title,
					priority: 3,
					estimatedEffort: 1,
					pillars: pillars.map(({ id }) => ({ pillarId: id, share, confidence: 100 })),
				},
			});
			expect(createRes.ok()).toBeTruthy();
			const task = (await createRes.json()) as { id: number };
			expect((await page.request.patch(`/api/v1/tasks/${task.id}`, { data: { status: 'Done' } })).ok()).toBeTruthy();
		}
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		const weeks = streakCard.getByTestId('streak-weeks-balanced');
		await expect(weeks).toBeVisible();
		await expect(weeks).toContainText('Woche ausgewogen');
		const cardBox = await streakCard.boundingBox();
		const weeksBox = await weeks.boundingBox();
		expect(cardBox).not.toBeNull();
		expect(weeksBox).not.toBeNull();
		expect(weeksBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
		expect(weeksBox!.x + weeksBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
	});
});

/**
 * Rote Spec-e2e #2632 (docs/spec/issue-2632.md): Erledigen im Signal-Panel — die Streak-Card
 * laedt ohne Reload nach (TASKS_CHANGED_EVENT, #2522) und Inline-Erfolg + Karte bilden Streak 1
 * in der Einzahl bzw. Streak 2 in der Mehrzahl; bei 375x812 ohne horizontales Verschieben.
 */
test.describe('#2632: Streak-Refresh nach dem Erledigen', () => {
	test('AK1-AK4 — erstes Erledigen: Karte "1 Tag" ohne Reload, Inline-Erfolg Einzahl; zweites: Mehrzahl', async ({
		page,
	}) => {
		// Test-Pflege (#2632): der Streak zählt Kalendertage — `berechneStreak` dedupliziert pro Tag
		// (streak.ts:100), zwei Erledigungen am selben Tag bleiben "1 Tag". Die zweite Aufgabe bekommt
		// deshalb nach der ersten Erledigung den Fälligkeitstag gestern: ihre verspätete Erledigung
		// zählt zusätzlich für gestern (`streakZeitpunkte`, streak.ts:86) — so wird die Mehrzahl
		// "Streak 2 Tage" erreicht, ohne die Panel-Reihenfolge (Überfällige zuerst) zu verdrehen.
		const erstellt: number[] = [];
		for (const [title, priority] of [
			['E2E 2632 eins', 5],
			['E2E 2632 zwei', 4],
		] as const) {
			const res = await page.request.post('/api/v1/tasks', { data: { title, priority, estimatedEffort: 1 } });
			expect(res.ok()).toBeTruthy();
			erstellt.push(((await res.json()) as { id: number }).id);
		}
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await expect(streakCard).toBeVisible();
		// Ausgangszustand: Tag noch streak-frei (Streak-gerissen-Zustand)
		await expect(streakCard.getByTestId('streak-zero')).toBeVisible();

		// Marker beweist nach dem Erledigen, dass die Seite nicht neu geladen hat (AK1).
		await page.evaluate(() => {
			(window as unknown as { pp2632NoReload?: boolean }).pp2632NoReload = true;
		});
		await page.locator('.dashboard-next-task').getByRole('button', { name: 'Erledigen' }).click();
		await expect(page.locator('.dashboard-next-task').getByText(/Streak 1 Tag\b/)).toBeVisible();
		await expect(streakCard).toContainText(/\b1 Tag\b/);
		await expect(streakCard.getByTestId('streak-zero')).toBeHidden();
		expect(await page.evaluate(() => (window as unknown as { pp2632NoReload?: boolean }).pp2632NoReload)).toBe(true);
		const box = await streakCard.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		// Test-Pflege (#2632): Fälligkeitstag gestern für die bereits erledigte erste Aufgabe —
		// ihre Erledigung zählt damit für gestern (`streakZeitpunkte`, streak.ts:86), die zweite
		// Erledigung heute erreicht die Mehrzahl "Streak 2 Tage" über den Direkt-Weg (das Panel
		// zeigt nur beim Direkt-Erledigen eine Rückmeldung; überfällige Aufgaben öffnen die
		// Pünktlich-Nachfrage #1964 ohne Panel-Rückmeldung).
		const gestern = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		const patch = await page.request.patch(`/api/v1/tasks/${erstellt[0]}`, { data: { deadline: gestern } });
		expect(patch.ok()).toBeTruthy();

		// Zweite Erledigung (frischer Seitenkontext): Inline-Erfolg Mehrzahl, Karte "2 Tage" (AK2).
		await page.reload();
		await waitForStableView(page);
		await page.locator('.dashboard-next-task').getByRole('button', { name: 'Erledigen' }).click();
		await expect(page.locator('.dashboard-next-task').getByText(/Streak 2 Tage\b/)).toBeVisible();
		await expect(streakCard).toContainText(/\b2 Tage\b/);
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375 + 1);
	});
});
