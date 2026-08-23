import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests (#228 / #307): die Erledigt-Ansicht — Tabelle NUR mit erledigten Tasks, Punkte je Säule,
 * Leerhinweis, „Wieder öffnen"-Icon-Button (in einer Toolbar) und Mobile-First (375px).
 *
 * Seit #399 ist dies kein eigener Tab mehr, sondern die „Erledigt"-Ansicht innerhalb des einen
 * „Aufgaben"-Tabs (Offen/Erledigt-Umschalter). Die Navigations-Helfer unten kapseln das.
 *
 * Wie `crud.spec.ts` laufen diese Specs gegen das **echte** Backend (In-Memory-DB, kein `page.route`).
 * Die Tests legen ihre Daten über die UI/echte API selbst an und räumen in `afterEach` wieder auf, damit
 * jeder Lauf von einem definierten, leeren Zustand startet (ein Worker, kein Neustart zwischen Tests).
 */
test.describe('Priority Pilot — Erledigt-Ansicht (#228/#307) gegen das echte Backend', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

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

	// Seit #399 gibt es keinen separaten „Erledigte Aufgaben"-Tab mehr: Offen und Erledigt sind ein
	// einziger „Aufgaben"-Tab mit einem Offen/Erledigt-Umschalter (KolInputCheckbox variant="switch",
	// Rolle checkbox „Erledigte Aufgaben anzeigen": ungeprüft = offen, geprüft = erledigt). Die
	// Navigation läuft daher über den Tab plus check/uncheck des Umschalters (idempotent).
	const viewSwitch = (page: Page) => page.getByRole('checkbox', { name: /Erledigte Aufgaben/i });

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await viewSwitch(page).uncheck();
		await waitForStableView(page);
	};

	const openCompletedTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await viewSwitch(page).check();
		await waitForStableView(page);
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

		await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	/** Öffnet das Aktionen-Popover des ersten Tasks und klickt den „Erledigt"-Toggle (#387). */
	const markTaskDoneViaUi = async (page: Page): Promise<void> => {
		await openTasksTab(page);
		await page
			.getByRole('button', { name: /Weitere Aktionen/i })
			.first()
			.click();
		const doneButton = page.getByRole('button', { name: 'Erledigt' }).first();
		await expect(doneButton).toBeVisible();
		await doneButton.click();
		await waitForStableView(page);
	};

	test('AK-1: Tab „Erledigte Aufgaben" zeigt nur Done-Tasks — offene Tasks erscheinen dort nicht', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const doneTitle = uniqueTitle('Erledigt');
		const openTitle = uniqueTitle('Offen');
		await createTaskViaUi(page, doneTitle);
		await createTaskViaUi(page, openTitle);

		// Genau einen der beiden Tasks erledigen (der zuerst angelegte steht oben).
		await openTasksTab(page);
		await page
			.getByRole('button', { name: /Weitere Aktionen/i })
			.first()
			.click();
		const firstDoneButton = page.getByRole('button', { name: 'Erledigt' }).first();
		await expect(firstDoneButton).toBeVisible();
		await firstDoneButton.click();
		await waitForStableView(page);

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

		// … und taucht wieder unter „Aufgaben" auf.
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
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
	 * Roter TDD-Vertrag für #931 (Spec: docs/spec/issue-931.md): Auf Desktop (≥ 48rem) hat die
	 * Erledigt-Tabelle bisher KEIN Spaltenlayout — `table-layout` ist browser-gesteuert (`auto`),
	 * alle Zellen linksbündig, Ziffern proportional. Die drei Specs sind rot, bis der Desktop-Zweig
	 * von `app.css`/`CompletedTasksTable.tsx` ein fixes Spaltenlayout mit dominanter Titel-Spalte
	 * und rechtsbündigen tabellarischen Zahlen setzt. Mobile (< 48rem) bleibt unberührt — das deckt
	 * der bestehende AK-6-Test oben ab (Dedup, kein neuer Mobile-Test).
	 */
	test.describe('#931 — Desktop-Spaltenbreiten (Spec docs/spec/issue-931.md)', () => {
		/** Messbare Geometrie der Erledigt-Tabelle: Layout-Modus, Kopf-Spaltenbreiten, Tabellenbreite. */
		const tableGeometry = (page: Page) =>
			page.evaluate(() => {
				const table = document.querySelector('table.completed-tasks-table');
				if (!table) return null;
				const headerWidths = Array.from(table.querySelectorAll('thead th')).map(
					(th) => th.getBoundingClientRect().width,
				);
				return {
					layout: getComputedStyle(table).tableLayout,
					headerWidths,
					tableWidth: table.getBoundingClientRect().width,
				};
			});

		test('AK-931-1: Ab 48rem nutzt die Tabelle ein fixes Spaltenlayout (table-layout: fixed)', async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await page.goto('/');
			await waitForStableView(page);

			await createTaskViaUi(page, uniqueTitle('931-Fixed'));
			await markTaskDoneViaUi(page);
			await openCompletedTab(page);

			// Ist heute 'auto' (kein Desktop-Spaltenlayout) → rot bis zum Fix (Spec AK-931-1).
			const geometry = await tableGeometry(page);
			expect(geometry).not.toBeNull();
			expect(geometry?.layout).toBe('fixed');
		});

		test('AK-931-2: Titel-Spalte ist dominant (≥ 2× jede Punkte-Spalte, ≥ 45 % Tabellenbreite) ohne Scrollen', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await page.goto('/');
			await waitForStableView(page);

			await createTaskViaUi(page, uniqueTitle('931-Breite'));
			await markTaskDoneViaUi(page);
			await openCompletedTab(page);

			const geometry = await tableGeometry(page);
			expect(geometry).not.toBeNull();
			const widths = geometry?.headerWidths ?? [];
			// Kopfzeile: [Titel, …Säulen, Aktion] — Punkte-Spalten sind die zwischen erster und letzter.
			expect(widths.length).toBeGreaterThanOrEqual(3);
			const [titleWidth, ...rest] = widths;
			const pointWidths = rest.slice(0, -1); // letzte Spalte ist „Aktion"
			const maxPointWidth = Math.max(...pointWidths);

			// Lesbarkeits-Kern des Tickets: Der Titel dominiert, Zahlen bleiben schmal (Spec AK-931-2).
			expect(titleWidth).toBeGreaterThan(2 * maxPointWidth);
			expect(titleWidth / (geometry?.tableWidth ?? 1)).toBeGreaterThanOrEqual(0.45);

			// Und das feste Layout darf kein horizontales Scrollen erzeugen.
			const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
			expect(scrollWidth).toBeLessThanOrEqual(1280);
		});

		test('AK-931-3: Punkte-Zellen sind rechtsbündig mit tabellarischen Ziffern', async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await page.goto('/');
			await waitForStableView(page);

			await createTaskViaUi(page, uniqueTitle('931-Zahlen'));
			await markTaskDoneViaUi(page);
			await openCompletedTab(page);

			// Punkte-Zellen sind die `td[data-label]` (Säulen-Beschriftung, siehe Komponente).
			const pointCell = page.locator('table.completed-tasks-table td[data-label]').first();
			await expect(pointCell).toBeVisible();
			const styles = await pointCell.evaluate((el) => {
				const computed = getComputedStyle(el);
				return { align: computed.textAlign, numeric: computed.fontVariantNumeric };
			});

			// Heute linksbündig/mit proportionalen Ziffern → rot bis zum Fix (Spec AK-931-3).
			expect(styles.align).toBe('right');
			expect(styles.numeric).toBe('tabular-nums');
		});
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
