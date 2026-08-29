import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1121 „Geo-Badge hinter dem Task-Titel" (Spec docs/spec/issue-1121.md).
 *
 * Vertrag: Im TaskTree (`LeafItem`) wandert das Globus-Badge aus der Badge-Gruppe
 * (`task-tree-badges`, vor dem „…"-Menüschalter) direkt hinter den Titeltext — durch genau ein
 * geschütztes Leerzeichen (U+00A0) getrennt, als gemeinsame Umbrucheinheit mit dem Titel. Zeilen
 * ohne Ortsbezug zeigen weder Icon noch Leerzeichen. `GeoBadge.tsx` bleibt unangetastet
 * (aria-label-Vertrag #1063,Regression in `issue-1063-geo-badge.spec.ts`).
 *
 * Wie `issue-1063-geo-badge.spec.ts` läuft diese Spec gegen das echte Backend (In-Memory-DB,
 * Vite-Proxy); Daten werden über die API angelegt, `afterEach` räumt auf. Rot, bis der
 * GeoBadge-Aufruf aus `task-tree-badges` in den Header hinter den Titel umzieht
 * (TaskTree.tsx:87-110).
 */
test.describe('Priority Pilot — #1121: Geo-Badge hinter dem Task-Titel', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #1121 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt einen Task mit optionaler Adresse über die echte API an; gibt die `id` zurück. */
	const createTaskViaApi = async (page: Page, title: string, address?: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, ...(address === undefined ? {} : { address }) },
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	/** Räumt erst alle Tasks, dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		for (const series of (await (await page.request.get('/api/v1/series')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/series/${series.id}`);
		}
	};

	const openTasksView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).uncheck();
		await waitForStableView(page);
	};

	interface RowGeometry {
		badgeInHeader: boolean;
		badgeAfterTitle: boolean;
		badgeBeforeControls: boolean;
		badgeInBadgesGroup: boolean;
		nbspBetweenTitleAndBadge: number;
	}

	/**
	 * Vermisst die Light-DOM-Anordnung einer Task-Zeile: Liegt das `geo-badge` im Header hinter
	 * dem Titel und vor den Controls, und wie viele U+00A0-Textknoten liegen dazwischen?
	 */
	const measureRow = async (rowLocator: ReturnType<Page['getByTestId']>): Promise<RowGeometry> =>
		rowLocator.evaluate((row) => {
			const header = row.querySelector<HTMLElement>('.task-tree-row-header');
			const title = row.querySelector<HTMLElement>('.task-tree-title');
			const controls = row.querySelector<HTMLElement>('.task-tree-row-controls');
			const badges = row.querySelector<HTMLElement>('.task-tree-badges');
			const badge = row.querySelector<HTMLElement>('[data-testid="geo-badge"]');
			if (!header || !title || !badge) {
				return {
					badgeInHeader: false,
					badgeAfterTitle: false,
					badgeBeforeControls: false,
					badgeInBadgesGroup: badge !== null && badges !== null && badges.contains(badge),
					nbspBetweenTitleAndBadge: 0,
				};
			}
			const following = (node: Node, other: Node): boolean =>
				(node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			// U+00A0-Textknoten zählen, die im Header zwischen Titel-Ende und Badge-Anfang liegen.
			let nbsp = 0;
			const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode;
				if (!node.textContent || !node.textContent.includes('\u00a0')) continue;
				if (following(title, node) && following(node, badge)) nbsp += 1;
			}
			return {
				badgeInHeader: header.contains(badge),
				badgeAfterTitle: following(title, badge),
				badgeBeforeControls: controls === null || following(badge, controls),
				badgeInBadgesGroup: badges !== null && badges.contains(badge),
				nbspBetweenTitleAndBadge: nbsp,
			};
		});

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	// AK1 — Icon liegt im Header hinter dem Titel und vor den Controls (nicht in der Badge-Gruppe).
	test('AK1 — Geo-Badge liegt im Header unmittelbar hinter dem Titel, vor den Controls', async ({ page }) => {
		const title = uniqueTitle('MitOrt');
		const id = await createTaskViaApi(page, title, 'Musterstraße 1, 12345 Musterstadt');

		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row).toBeVisible();
		await expect(row.getByTestId('geo-badge')).toBeVisible();

		const geometry = await measureRow(row);
		expect(geometry.badgeInHeader, 'Geo-Badge gehört in den Zeilen-Header (task-tree-row-header)').toBe(true);
		expect(geometry.badgeAfterTitle, 'Geo-Badge folgt dem Titel (task-tree-title)').toBe(true);
		expect(geometry.badgeBeforeControls, 'Geo-Badge liegt vor task-tree-row-controls').toBe(true);
	});

	// AK3 — Die Badge-Gruppe enthält kein Geo-Badge mehr.
	test('AK3 — Badge-Gruppe (task-tree-badges) enthält kein geo-badge', async ({ page }) => {
		const title = uniqueTitle('Gruppe');
		const id = await createTaskViaApi(page, title, 'Weg 4, 10115 Berlin');

		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row.getByTestId('geo-badge')).toBeVisible();
		const geometry = await measureRow(row);
		expect(geometry.badgeInBadgesGroup, 'Geo-Badge ist aus task-tree-badges entfernt').toBe(false);
	});

	// AK2 — Genau ein U+00A0 zwischen Titel und Icon; Icon bricht nicht isoliert um.
	test('AK2 — Genau ein geschütztes Leerzeichen zwischen Titel und Icon, gemeinsame Umbrucheinheit', async ({
		page,
	}) => {
		const title = uniqueTitle('Umbruch').padEnd(30, 'x'); // Domänen-Maximum (server/src/models/task.ts:93)
		const id = await createTaskViaApi(page, title, 'Lange Musterstraße 123, 12345 Musterstadt');

		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row.getByTestId('geo-badge')).toBeVisible();

		const geometry = await measureRow(row);
		expect(geometry.nbspBetweenTitleAndBadge, 'genau ein U+00A0-Textknoten zwischen Titel und Geo-Badge').toBe(1);

		// Umbrucheinheit: Das Icon bleibt auf der Höhe des Titeltexts — ein isoliert in eine
		// neue Zeile umgebrochenes Icon läge unterhalb der Titel-Box.
		const headingBox = await row.locator('.task-tree-title').boundingBox();
		const badgeBox = await row.getByTestId('geo-badge').boundingBox();
		expect(headingBox).not.toBeNull();
		expect(badgeBox).not.toBeNull();
		expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(headingBox!.y + headingBox!.height + 1);
	});

	// AK5 — Zeile ohne Ortsbezug: kein Icon, kein U+00A0 hinter dem Titel.
	test('AK5 — Task ohne Ortsbezug zeigt weder geo-badge noch geschütztes Leerzeichen', async ({ page }) => {
		const title = uniqueTitle('OhneOrt');
		const id = await createTaskViaApi(page, title);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${id}`);
		await expect(row).toBeVisible();
		await expect(row.getByTestId('geo-badge')).toHaveCount(0);

		const nbspNodes = await row.locator('.task-tree-row-header').evaluate((header) => {
			let count = 0;
			const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				if (walker.currentNode.textContent?.includes('\u00a0')) count += 1;
			}
			return count;
		});
		expect(nbspNodes, 'kein U+00A0 hinter dem Titel ohne Ortsbezug').toBe(0);
	});

	// AK4 — Regression: Die Status-Badges bleiben in der Badge-Gruppe vor dem Menüschalter.
	test('AK4 — Serie- und Prioritäts-Badge bleiben in der Badge-Gruppe, in dieser Reihenfolge', async ({ page }) => {
		const seriesTitle = uniqueTitle('Serie');
		const seriesResponse = await page.request.post('/api/v1/series', {
			data: {
				title: seriesTitle,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
				address: 'Musterweg 7, 20095 Hamburg',
			},
		});
		expect(seriesResponse.ok()).toBeTruthy();
		const seriesId = ((await seriesResponse.json()) as { id: number }).id;
		const generate = await page.request.post(`/api/v1/series/${seriesId}/generate`, {
			data: { until: '2026-09-30T23:59:59.000Z' },
		});
		expect(generate.ok()).toBeTruthy();
		const instance = (
			(await (await page.request.get('/api/v1/tasks')).json()) as {
				id: number;
				title: string;
				seriesId: number | null;
			}[]
		).find((task) => task.seriesId === seriesId);
		expect(instance, 'Serie generiert mindestens eine sichtbare Instanz').toBeTruthy();

		await page.goto('/');
		await waitForStableView(page);
		await openTasksView(page);

		const row = page.getByTestId(`task-list-item-${instance!.id}`);
		await expect(row).toBeVisible();
		// Reihenfolge im Light DOM: die Serie-Instanz trägt genau die zwei Status-Badges
		// (Serie, Priorität; TaskTree.tsx:92-107) — das Prioritäts-Badge (`task-tree-badge--priority`)
		// ist das letzte von ihnen, beide innerhalb der Badge-Gruppe vor dem „…"-Menüschalter.
		const badges = row.locator('.task-tree-badges .task-tree-badge');
		await expect(badges).toHaveCount(2);
		const lastIsPriority = await row
			.locator('.task-tree-badges .task-tree-badge')
			.last()
			.evaluate((item) => item.classList.contains('task-tree-badge--priority'));
		expect(lastIsPriority, 'Prioritäts-Badge bleibt letztes Badge in der Gruppe (nach Serie)').toBe(true);
		await expect(row.locator('.task-tree-actions')).toBeVisible();
	});
});
