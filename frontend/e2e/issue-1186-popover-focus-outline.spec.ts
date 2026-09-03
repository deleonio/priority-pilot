import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für die sichtbare Fokus-Outline im „…"-Menü der Aufgabenliste (#1186).
 *
 * Das Aktions-Popover jeder Aufgabe (`KolPopoverButton _label="Weitere Aktionen"` +
 * `KolToolbar`, TaskTree.tsx) liegt im offenen Shadow-DOM von `kol-popover-button`;
 * das Panel `.kol-popover-button__popover` clippt die Fokus-Outline der
 * Toolbar-Buttons, weil es vom UA-/KoliBri-Style `overflow: auto` erhält.
 *
 * Vertrag (docs/spec/issue-1186.md):
 * - AK1: Das Panel hat nach dem Öffnen computed `overflow: visible`, gesetzt über den
 *   bestehenden Helper `setupPopoverAlignment` (frontend/src/lib/popoverAlign.ts) —
 *   ohne Änderung an den @public-ui-Paketen (Pins bleiben 4.3.0).
 * - AK2: Der per Tastatur fokussierte Toolbar-Button trägt eine sichtbare Outline
 *   (outline-style != none, outline-width > 0) und kein Vorfahr im Popover-Shadow-DOM
 *   clippt sie — damit ist die Outline an allen vier Kanten vollständig sichtbar.
 * - AK3: AK1+AK2 gelten unverändert bei 375px-Viewport (Mobile-first); der Fokus
 *   wird dort per echter Tab-Navigation erreicht (nicht nur programmatisch), um ein
 *   Fokus-Gefängnis im engen Popover-Layout auszuschließen (Vorbild issue-930, AK1).
 *
 * Stil-Assertions per getComputedStyle auf dem per Locator erreichten Element
 * (Playwright pierct offene Shadow Roots, Vorbild issue-930-transparent-backgrounds);
 * Fokus in AK1/AK2 per locator.focus() + toBeFocused (Vorbild issue-761, AK6). Kein Unit-Test:
 * migration-check.test.ts verbietet shadowRoot-Zugriffe in frontend/src-Tests —
 * die Prüfung liegt bewusst auf E2E-Ebene.
 */
test.describe('Priority Pilot — Fokus-Outline im „…"-Menü der Aufgabenliste (#1186)', () => {
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

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

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	/** Das Panel im offenen Shadow-DOM von `kol-popover-button` (Locators piercen Shadow Roots). */
	const popoverPanel = (page: Page, id: number) =>
		item(page, id).locator('kol-popover-button.task-tree-more').locator('.kol-popover-button__popover');

	/** Öffnet das „Weitere Aktionen"-Popover einer Aufgabe (#361-Muster, done-toggle.spec.ts). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
		await expect(popoverPanel(page, id)).toBeVisible();
	};

	/** Erster Toolbar-Button im geöffneten Popover (binärer Erledigt-Toggle, #387). */
	const firstToolbarButton = (page: Page, id: number) =>
		item(page, id).locator('[role="toolbar"]').getByRole('button').first();

	/**
	 * AK2-Kern: Kein Anzeige-Vorfahr des Buttons im Popover clippt die Outline —
	 * jeder DOM-Vorfahr bis zum `kol-popover-button`-Host sowie das Panel (der
	 * slottete Toolbar-Inhalt ist kein DOM-Nachfahre des Panels, wird aber in seiner
	 * Box angezeigt und von ihm geclippt) muss clippendes `overflow`
	 * (`auto`/`hidden`/`scroll`/`clip`) vermeiden. Die Wanderung endet am
	 * `kol-popover-button`-Host — darüber hinaus clippt ggf. die App-Shell
	 * (`overflow-x: hidden`), was außerhalb dieses Vertrags liegt.
	 */
	const clippingAncestorInPopover = (button: ReturnType<Page['locator']>, panel: ReturnType<Page['locator']>) =>
		Promise.all([
			button.evaluate((el: HTMLElement): string | null => {
				const CLIPPING = ['auto', 'hidden', 'scroll', 'clip'];
				const describe = (n: Element) =>
					`${n.tagName.toLowerCase()}${n.className ? `.${String(n.className).split(' ')[0]}` : ''}`;
				let node: Element | null = el;
				while (node) {
					if (CLIPPING.includes(window.getComputedStyle(node).overflow)) {
						return describe(node);
					}
					if (node.tagName.toLowerCase() === 'kol-popover-button') {
						return null; // Host erreicht — Ende des relevanten Scopes
					}
					let next: Element | null = node.parentElement;
					if (!next) {
						const root = node.getRootNode();
						if (root instanceof ShadowRoot && root.host) {
							next = root.host; // verschachteltes Shadow-DOM durchqueren
						} else {
							return null;
						}
					}
					node = next;
				}
				return null;
			}),
			// Das Panel selbst ist der visuelle Clipper des slotteten Inhalts (#1186).
			panel.evaluate((el: HTMLElement): string | null => {
				const CLIPPING = ['auto', 'hidden', 'scroll', 'clip'];
				return CLIPPING.includes(window.getComputedStyle(el).overflow) ? 'kol-popover-button__popover' : null;
			}),
		]).then(([ancestor, panelClipper]: (string | null)[]) => ancestor ?? panelClipper);

	test('AK1: Panel `.kol-popover-button__popover` hat nach dem Öffnen computed overflow: visible', async ({ page }) => {
		const id = await createTask(page, 'Popover Overflow #1186');

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();

		await openActionsPopover(page, id);

		// Kern des Fixes (#1186): das Panel selbst darf die Toolbar-Inhalte nicht mehr
		// clippen — der Helper setzt das Inline-Style (wie width/left) am Panel.
		const overflow = await popoverPanel(page, id).evaluate((el) => window.getComputedStyle(el).overflow);
		expect(overflow, 'Panel-overflow muss visible sein (statt UA-auto), sonst clippt das Panel die Fokus-Outline').toBe(
			'visible',
		);
	});

	test('AK2: Fokussierter Toolbar-Button hat sichtbare Outline, die von keinem Popover-Vorfahren geclippt wird', async ({
		page,
	}) => {
		const id = await createTask(page, 'Popover Focus #1186');

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();

		await openActionsPopover(page, id);

		const button = firstToolbarButton(page, id);
		await expect(button).toBeVisible();
		await button.focus();
		await expect(button).toBeFocused();

		// Outline vorhanden (outline-style != none, outline-width > 0).
		const hasOutline = await button.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return styles.outlineStyle !== 'none' && parseFloat(styles.outlineWidth) > 0;
		});
		expect(hasOutline, 'fokussierter Toolbar-Button muss eine Outline tragen').toBe(true);

		// Outline ungeclippt: kein Vorfahr bis zum Panel clippendes overflow.
		// Heute clippt das Panel selbst (overflow: auto) → rot; mit AK1-Fix grün.
		const clipper = await clippingAncestorInPopover(button, popoverPanel(page, id));
		expect(clipper, `Outline wird von ${clipper} geclippt — muss visible/nicht-clippend sein`).toBeNull();
	});

	test.describe('Mobile-first 375px (#1186 AK3)', () => {
		test.use({ viewport: { width: 375, height: 667 } });

		test('AK3: AK1 + AK2 gelten unverändert bei 375px-Viewport', async ({ page }) => {
			const id = await createTask(page, 'Popover Mobile #1186');

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);
			await expect(item(page, id)).toBeVisible();

			await openActionsPopover(page, id);

			// AK1 bei 375px.
			const overflow = await popoverPanel(page, id).evaluate((el) => window.getComputedStyle(el).overflow);
			expect(overflow, 'Panel-overflow muss auch auf schmalem Viewport visible sein').toBe('visible');

			// AK2 bei 375px — per echter Tab-Navigation (nicht nur programmatisch),
			// da ein Fokus-Gefängnis im engen Popover-Layout die Tab-Reihenfolge
			// unterbrechen könnte, ohne dass ein programmatischer .focus() das zeigt.
			const button = firstToolbarButton(page, id);
			await expect(button).toBeVisible();
			let focusedViaKeyboard = false;
			for (let i = 0; i < 15 && !focusedViaKeyboard; i++) {
				await page.keyboard.press('Tab');
				try {
					await expect(button).toBeFocused({ timeout: 150 });
					focusedViaKeyboard = true;
				} catch {
					// noch nicht beim Button — weiter tabben
				}
			}
			expect(focusedViaKeyboard, 'Toolbar-Button muss auf 375px per Tab-Taste erreichbar sein (max. 15 Tabs)').toBe(
				true,
			);
			await expect(button).toBeFocused();

			const hasOutline = await button.evaluate((el) => {
				const styles = window.getComputedStyle(el);
				return styles.outlineStyle !== 'none' && parseFloat(styles.outlineWidth) > 0;
			});
			expect(hasOutline, 'fokussierter Toolbar-Button muss eine Outline tragen').toBe(true);

			const clipper = await clippingAncestorInPopover(button, popoverPanel(page, id));
			expect(clipper, `Outline wird auf 375px von ${clipper} geclippt`).toBeNull();
		});
	});
});
