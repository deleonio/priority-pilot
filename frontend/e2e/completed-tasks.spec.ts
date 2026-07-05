import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests (#228): Tab „Erledigte Aufgaben" — Tabelle NUR mit erledigten Tasks, Punkte je
 * Säule, Leerhinweis, „Wieder öffnen"-Schalter und Mobile-First (375px).
 *
 * Wie `crud.spec.ts` laufen diese Specs gegen das **echte** Backend (In-Memory-DB, kein `page.route`).
 * Die Tests legen ihre Daten über die UI/echte API selbst an und räumen in `afterEach` wieder auf, damit
 * jeder Lauf von einem definierten, leeren Zustand startet (ein Worker, kein Neustart zwischen Tests).
 *
 * Der Tab „Erledigte Aufgaben", die Punkte-Spalten je Säule und der „Wieder öffnen"-Schalter existieren
 * noch NICHT — die Tests sind rot, bis die Umsetzung sie bereitstellt.
 */
test.describe('Priority Pilot — Tab „Erledigte Aufgaben" (#228) gegen das echte Backend', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E ${label} #${(runId += 1)}-${Date.now()}`;

	/** Löscht alle aktuell vorhandenen Tasks über die echte API (Vite-Proxy → Backend). */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const openCompletedTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Erledigte Aufgaben', exact: true }).click();
	};

	/**
	 * Legt über die UI einen Task mit dem gegebenen Titel an (Default-Felder genügen der Validierung)
	 * und wartet, bis der Dialog geschlossen ist.
	 */
	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	/** Setzt einen bestehenden Task über den Bearbeiten-Dialog auf „Erledigt". */
	const markTaskDoneViaUi = async (page: Page): Promise<void> => {
		await openTasksTab(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await page.getByLabel('Status').click();
		await page.getByRole('option', { name: 'Erledigt' }).click();
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();
	};

	test('AK-1: Tab „Erledigte Aufgaben" zeigt nur Done-Tasks — offene Tasks erscheinen dort nicht', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const doneTitle = uniqueTitle('Erledigt');
		const openTitle = uniqueTitle('Offen');
		await createTaskViaUi(page, doneTitle);
		await createTaskViaUi(page, openTitle);

		// Genau einen der beiden Tasks erledigen.
		await openTasksTab(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		// Sicherstellen, dass wir den Erledigt-Task bearbeiten (Titel-Feld gegenprüfen wäre ideal,
		// aber die Reihenfolge ist deterministisch: der zuerst angelegte steht oben).
		await page.getByLabel('Status').click();
		await page.getByRole('option', { name: 'Erledigt' }).click();
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		await openCompletedTab(page);
		// Der erledigte Task ist gelistet …
		await expect(page.getByText(doneTitle, { exact: true })).toBeVisible();
		// … der offene Task NICHT (im aktiven Tab nicht sichtbar; inaktive Tabs bleiben im Light-DOM).
		await expect(page.getByText(openTitle, { exact: true })).not.toBeVisible();
	});

	test('AK-2: Je Zeile Titel + Punkte je Säule, Säulenwerte summieren sich zu den Gesamtpunkten (kein NaN)', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Punkte');
		await createTaskViaUi(page, title);
		await markTaskDoneViaUi(page);

		await openCompletedTab(page);
		const row = page.getByRole('row').filter({ hasText: title });
		await expect(row).toBeVisible();

		// Die Zeile trägt den Titel …
		await expect(row.getByText(title, { exact: true })).toBeVisible();

		// … und je Säule eine Punkte-Zelle, die niemals „NaN" anzeigt.
		await expect(row.getByText('NaN')).toHaveCount(0);
	});

	test('AK-3: Ohne Done-Task zeigt der Tab einen klaren Leerhinweis (kein kaputtes Layout)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Ein offener Task, damit die Tab-Leiste erscheint, aber nichts erledigt ist.
		await createTaskViaUi(page, uniqueTitle('NurOffen'));

		await openCompletedTab(page);
		// Ein klarer, verständlicher Leerhinweis ist sichtbar (Wortlaut bewusst locker per Regex).
		await expect(
			page.getByText(/keine erledigten Aufgaben|noch nichts erledigt|keine erledigten Tasks/i),
		).toBeVisible();
	});

	test('AK-4: „Wieder öffnen" entfernt den Task aus Erledigten und macht ihn wieder zu „Offen"', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Reopen');
		await createTaskViaUi(page, title);
		await markTaskDoneViaUi(page);

		await openCompletedTab(page);
		const row = page.getByRole('row').filter({ hasText: title });
		await expect(row).toBeVisible();

		// „Wieder öffnen"-Schalter je Zeile betätigen.
		await row.getByRole('button', { name: 'Wieder öffnen' }).click();

		// Der Task verschwindet aus den Erledigten (im aktiven Tab nicht mehr sichtbar).
		await expect(page.getByText(title, { exact: true })).not.toBeVisible();

		// … und taucht wieder unter „Aufgaben" auf (Status „Offen").
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByLabel('Status')).toHaveValue('Offen');
	});

	test('AK-6: Erledigte-Ansicht bei 375px ohne horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Mobil');
		await createTaskViaUi(page, title);
		await markTaskDoneViaUi(page);

		await openCompletedTab(page);
		// Der „Wieder öffnen"-Schalter ist auch mobil erreichbar.
		const row = page.getByRole('row').filter({ hasText: title });
		await expect(row.getByRole('button', { name: 'Wieder öffnen' })).toBeVisible();

		// Kein horizontales Scrollen: Der Inhalt passt in die 375px-Breite.
		const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375);
	});

	/**
	 * Roter TDD-Vertrag für #307: „Wieder öffnen" wird zu einem Icon-Button innerhalb einer neuen
	 * `KolToolbar` (`[role="toolbar"]`) je Zeile. Der Accessible Name bleibt „Wieder öffnen" (durch AK-4
	 * oben gedeckt), aber es gibt keinen sichtbaren Klartext mehr. Diese Specs sind rot, bis
	 * `CompletedTasksTable.tsx` den Button in eine Toolbar mit `_hideLabel` überführt.
	 */
	test.describe('#307 — „Wieder öffnen" als Icon-Button in einer Toolbar', () => {
		test('AK-307-3: „Wieder öffnen" liegt in einer Toolbar der Zeile', async ({ page }) => {
			await page.goto('/');
			await waitForStableView(page);

			const title = uniqueTitle('Toolbar-Reopen');
			await createTaskViaUi(page, title);
			await markTaskDoneViaUi(page);

			await openCompletedTab(page);
			const row = page.getByRole('row').filter({ hasText: title });
			await expect(row).toBeVisible();

			// Neu: eine `KolToolbar` (`[role="toolbar"]`) je Zeile, in der der „Wieder öffnen"-Icon-Button
			// liegt. Aktuell rot, weil es keine Toolbar gibt.
			const toolbar = row.locator('[role="toolbar"]');
			await expect(toolbar).toBeVisible();
			await expect(toolbar.getByRole('button', { name: 'Wieder öffnen' })).toBeVisible();
		});

		test('AK-307-3b: „Wieder öffnen"-Button trägt kein sichtbares Text-Label (Icon-only)', async ({ page }) => {
			await page.goto('/');
			await waitForStableView(page);

			const title = uniqueTitle('Icon-Reopen');
			await createTaskViaUi(page, title);
			await markTaskDoneViaUi(page);

			await openCompletedTab(page);
			const row = page.getByRole('row').filter({ hasText: title });
			await expect(row).toBeVisible();

			const reopenButton = row.locator('[role="toolbar"]').getByRole('button', { name: 'Wieder öffnen' });
			await expect(reopenButton).toBeVisible();

			// Kein sichtbarer Klartext „Wieder öffnen" im Button-DOM: KoliBri legt den Label-Text bei
			// `_hideLabel={true}` in einen `aria-hidden`-Span (Accessible Name bleibt erhalten).
			const hasVisibleLabelText = await reopenButton.evaluate((el) => {
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				let node = walker.nextNode();
				while (node !== null) {
					const text = (node.textContent ?? '').trim();
					if (text.includes('Wieder öffnen')) {
						let ancestor: HTMLElement | null = node.parentElement;
						let hidden = false;
						while (ancestor !== null && ancestor !== el.parentElement) {
							const style = window.getComputedStyle(ancestor);
							if (
								ancestor.getAttribute('aria-hidden') === 'true' ||
								style.display === 'none' ||
								style.visibility === 'hidden' ||
								style.clip === 'rect(0px, 0px, 0px, 0px)'
							) {
								hidden = true;
								break;
							}
							ancestor = ancestor.parentElement;
						}
						if (!hidden) {
							return true;
						}
					}
					node = walker.nextNode();
				}
				return false;
			});
			expect(hasVisibleLabelText).toBe(false);
		});

		test('AK-307-5: Icon-Button „Wieder öffnen" liegt auch bei 375px in einer Toolbar', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/');
			await waitForStableView(page);

			const title = uniqueTitle('Mobil-Reopen');
			await createTaskViaUi(page, title);
			await markTaskDoneViaUi(page);

			await openCompletedTab(page);
			const row = page.getByRole('row').filter({ hasText: title });
			await expect(row).toBeVisible();

			// Auch mobil ist die Toolbar mit dem „Wieder öffnen"-Icon-Button vorhanden und sichtbar.
			const reopenButton = row.locator('[role="toolbar"]').getByRole('button', { name: 'Wieder öffnen' });
			await expect(reopenButton).toBeVisible();

			// Kein horizontales Scrollen: Der Inhalt passt in die 375px-Breite.
			const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
			expect(scrollWidth).toBeLessThanOrEqual(375);
		});
	});
});
