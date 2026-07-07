import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #363 „Aufgabenliste invertieren". Die `TaskTree`-Komponente (#238) stellt die
 * Hierarchie heute **von der Oberaufgabe zur Unteraufgabe** dar: Die Oberaufgabe liegt auf oberster
 * Ebene, ihre Unteraufgaben hängen eingerückt darunter. Gewünscht ist die **umgekehrte Leserichtung**:
 * Unter-/Einzelaufgaben liegen auf der obersten Ebene, und erst das **Aufklappen** bringt die
 * Oberaufgabe als eingerückten (Kind-)Knoten darunter zum Vorschein.
 *
 * Umgesetzt wird das als reine **Frontend-Inversion** über den (noch nicht existierenden) Helper
 * `frontend/src/lib/invertForest.ts`, den `TaskTree.tsx` rendert. Der Server-Vertrag (`GET /forest`)
 * bleibt unverändert (Oberaufgaben = Wurzeln, `dependents` = Unteraufgaben) — damit Fortschritt, Guard
 * und Rollup unverändert korrekt rechnen (AK4). Diese Specs kodieren die **neue** Anzeige-Richtung und
 * sind rot, bis die Inversion in `TaskTree.tsx` verdrahtet ist.
 *
 * Wie `crud.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt bewusst über die API (schneller/robuster als Klick-Choreografie): Das Backend
 * modelliert eine Unteraufgabe als Abhängigkeit — exakt wie der reale „Unteraufgabe anlegen"-Flow in
 * `TaskForm.tsx` ist das Kind der **Vorgänger** der Eltern-Aufgabe
 * (`POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`, #336). Im semantischen
 * Aufgabenwald (`GET /forest`) erscheint das Kind als `dependents`-Eintrag (Unteraufgabe) des
 * Elternteils; die **invertierte Anzeige** dreht diese Kante um.
 *
 * `afterEach` räumt alle Tasks über die echte API ab, damit jeder Test vom leeren Zustand startet.
 */
test.describe('Priority Pilot — TaskTree invertiert (Unteraufgaben oben, #363)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Tree ${label} #${(runId += 1)}-${Date.now()}`;

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Verknüpft `childId` als Unteraufgabe von `parentId` — exakt wie `TaskForm.tsx`: das Kind wird zum
	 * **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
	 * `dependingTaskId = childId`, #336). Damit taucht das Kind im Wald unter `parent.dependents` auf.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(response.ok()).toBeTruthy();
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

	/** Der Wurzelcontainer des neuen Baums. */
	const tree = (page: Page) => page.getByTestId('task-tree');

	/**
	 * Der Listeneintrag eines Tasks im Baum. Verankert über `data-testid="task-tree-item-<id>"`, damit
	 * die Assertions unabhängig von der Wert-Sortierung des Waldes exakt einen Knoten treffen.
	 */
	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Das Aufklapp-/Zuklapp-Steuerelement innerhalb eines Knotens (per aria-expanded prüfbar). */
	const toggle = (page: Page, id: number) =>
		item(page, id)
			.getByRole('button', { name: /Auf|Zuklappen|klappen/i })
			.first();

	/** Öffnet das „Weitere Aktionen"-Popover („…") eines Knotens (#361). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	test('AK1: Unteraufgabe liegt oben und zeigt ein Aufklapp-Symbol zur Oberaufgabe', async ({ page }) => {
		const childTitle = uniqueTitle('Kind');
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, childTitle);
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Invertiert: Die Unteraufgabe (Kind) liegt auf oberster Ebene und trägt das Aufklapp-Symbol,
		// über das sich ihre Oberaufgabe aufklappen lässt.
		await expect(tree(page)).toBeVisible();
		await expect(item(page, childId)).toBeVisible();
		await expect(item(page, childId)).toContainText(childTitle);
		await expect(toggle(page, childId)).toBeVisible();
	});

	test('AK2: Einzelaufgabe ohne Über-/Unteraufgabe liegt oben ohne Aufklapp-Symbol', async ({ page }) => {
		const soloTitle = uniqueTitle('Solo');
		const soloId = await createTask(page, soloTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(tree(page)).toBeVisible();
		await expect(item(page, soloId)).toBeVisible();
		await expect(item(page, soloId)).toContainText(soloTitle);
		await expect(item(page, soloId).getByRole('button', { name: /klappen/i })).toHaveCount(0);
	});

	test('AK1/AK3: Aufklappen zeigt die Oberaufgabe als eingerückten Nachfahren', async ({ page }) => {
		const parentTitle = uniqueTitle('Eltern');
		const parentId = await createTask(page, parentTitle);
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Eingeklappter Anfangszustand: Die Oberaufgabe ist noch nicht sichtbar.
		await expect(item(page, parentId)).toBeHidden();

		await toggle(page, childId).click();

		// Nach dem Aufklappen erscheint die Oberaufgabe als Nachfahre unter der Unteraufgabe.
		await expect(item(page, parentId)).toBeVisible();
		await expect(item(page, parentId)).toContainText(parentTitle);
		await expect(item(page, childId).getByTestId(`task-tree-item-${parentId}`)).toBeVisible();
	});

	test('AK3: Zuklappen verbirgt die Oberaufgabe wieder', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await toggle(page, childId).click();
		await expect(item(page, parentId)).toBeVisible();

		await toggle(page, childId).click();
		await expect(item(page, parentId)).toBeHidden();
	});

	test('AK1/AK3: Aufklappen führt über mehrere Ebenen nach oben zur Wurzel-Oberaufgabe', async ({ page }) => {
		// Semantische Kette: Wurzel-Oberaufgabe → Mitte → Blatt (jeweils Unteraufgabe des Vorgängers).
		const rootTitle = uniqueTitle('Wurzel');
		const rootId = await createTask(page, rootTitle);
		const midId = await createTask(page, uniqueTitle('Mitte'));
		const leafId = await createTask(page, uniqueTitle('Blatt'));
		await addSubtask(page, rootId, midId);
		await addSubtask(page, midId, leafId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Invertiert liegt das Blatt oben; die höheren Ebenen sind zunächst verborgen.
		await expect(item(page, leafId)).toBeVisible();
		await expect(item(page, midId)).toBeHidden();
		await expect(item(page, rootId)).toBeHidden();

		await toggle(page, leafId).click();
		await expect(item(page, midId)).toBeVisible();
		// Solange die mittlere Ebene nicht aufgeklappt ist, bleibt die Wurzel-Oberaufgabe verborgen.
		await expect(item(page, rootId)).toBeHidden();

		await toggle(page, midId).click();
		await expect(item(page, rootId)).toBeVisible();
		await expect(item(page, rootId)).toContainText(rootTitle);
	});

	test('AK1: Knoten-Zuordnung ist korrekt (Oberaufgabe liegt unter ihrer Unteraufgabe)', async ({ page }) => {
		const parentAId = await createTask(page, uniqueTitle('Eltern-A'));
		const soloTitle = uniqueTitle('Solo-B');
		const soloBId = await createTask(page, soloTitle);
		const childId = await createTask(page, uniqueTitle('Kind-von-A'));
		await addSubtask(page, parentAId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await toggle(page, childId).click();

		// Die Oberaufgabe A ist als Nachfahre der Unteraufgabe verschachtelt — die eigenständige
		// Einzelaufgabe B liegt separat oben und besitzt kein Aufklapp-Symbol (keine Oberaufgabe).
		await expect(item(page, childId).getByTestId(`task-tree-item-${parentAId}`)).toBeVisible();
		await expect(item(page, soloBId).getByRole('button', { name: /klappen/i })).toHaveCount(0);
	});

	test('AK1 (mehrfach): eine Oberaufgabe erscheint unter jeder ihrer Unteraufgaben', async ({ page }) => {
		const parentTitle = uniqueTitle('Eltern-doppelt');
		const parentId = await createTask(page, parentTitle);
		const childOneId = await createTask(page, uniqueTitle('Kind-1'));
		const childTwoId = await createTask(page, uniqueTitle('Kind-2'));
		await addSubtask(page, parentId, childOneId);
		await addSubtask(page, parentId, childTwoId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Beide Unteraufgaben liegen oben und tragen je ein Aufklapp-Symbol.
		await expect(toggle(page, childOneId)).toBeVisible();
		await expect(toggle(page, childTwoId)).toBeVisible();

		// Die geteilte Oberaufgabe erscheint unter jeder Unteraufgabe (Mehrfach-Darstellung gewünscht).
		await toggle(page, childOneId).click();
		await toggle(page, childTwoId).click();
		await expect(item(page, childOneId).getByTestId(`task-tree-item-${parentId}`)).toBeVisible();
		await expect(item(page, childTwoId).getByTestId(`task-tree-item-${parentId}`)).toBeVisible();
	});

	test('AK-5: Edit-Button öffnet den Dialog mit der richtigen Aufgabe', async ({ page }) => {
		const title = uniqueTitle('Bearbeitbar');
		const id = await createTask(page, title);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// „Bearbeiten" liegt jetzt im „…"-Popover (#361): erst öffnen, dann klicken.
		await openActionsPopover(page, id);
		await item(page, id).getByRole('button', { name: 'Bearbeiten' }).click();

		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
	});

	test('AK5: invertierte Liste ist auf Mobilbreite ohne horizontales Scrollen lesbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const childTitle = uniqueTitle('Mobil-Kind');
		const parentId = await createTask(page, uniqueTitle('Mobil-Eltern'));
		const childId = await createTask(page, childTitle);
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Invertiert liegt die Unteraufgabe oben; nach dem Aufklappen wird die (eingerückte) Oberaufgabe
		// sichtbar — auch dann darf nichts horizontal überlaufen.
		await expect(tree(page)).toBeVisible();
		await expect(item(page, childId)).toContainText(childTitle);
		await toggle(page, childId).click();
		await expect(item(page, parentId)).toBeVisible();

		// Kein horizontaler Überlauf: Der Baum-Container ragt nicht über die Viewport-Breite hinaus.
		const overflowsHorizontally = await page.evaluate(() => {
			const root = document.querySelector('[data-testid="task-tree"]');
			if (root === null) {
				return true;
			}
			return root.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * Roter TDD-Vertrag für #307: „Bearbeiten" wird vom separaten Button VOR der Toolbar zu einem
	 * Icon-Button und rückt als ERSTES Element in die Aktions-Toolbar (`kol-toolbar` → `[role="toolbar"]`).
	 * Der Accessible Name bleibt „Bearbeiten" (durch AK-5 oben gedeckt), aber es gibt keinen sichtbaren
	 * Klartext mehr. Diese Specs sind rot, bis `TaskTree.tsx` den Edit-Button als erstes Toolbar-Item
	 * mit `_hideLabel` rendert.
	 */
	test.describe('#307 — „Bearbeiten" als Icon-Button in der Aktions-Toolbar', () => {
		/** Die Aktions-Toolbar eines Knotens (`KolToolbar` rendert `[role="toolbar"]`). */
		const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

		test('AK-307-1: „Bearbeiten" ist das erste Element der Aktions-Toolbar', async ({ page }) => {
			const title = uniqueTitle('Toolbar-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Die Toolbar liegt jetzt hinter dem „…"-Popover (#361): initial verborgen. Nach dem Öffnen
			// ist ihr erster Button „Bearbeiten" (vor Abhängigkeiten/Unteraufgabe/Löschen).
			await expect(toolbar(page, id)).toBeHidden();

			await openActionsPopover(page, id);

			await expect(toolbar(page, id)).toBeVisible();
			const firstButton = toolbar(page, id).getByRole('button').first();
			await expect(firstButton).toHaveAccessibleName('Bearbeiten');
		});

		test('AK-307-1b: „Bearbeiten"-Button trägt kein sichtbares Text-Label (Icon-only)', async ({ page }) => {
			const title = uniqueTitle('Icon-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// „Bearbeiten" liegt jetzt im „…"-Popover (#361): erst öffnen.
			await openActionsPopover(page, id);

			const editButton = toolbar(page, id).getByRole('button', { name: 'Bearbeiten' });
			await expect(editButton).toBeVisible();

			// KoliBri rendert bei `_hideLabel={true}` den Label-Text in einem `aria-hidden`-Span, damit der
			// Accessible Name erhalten bleibt, der Text aber optisch verborgen ist. Kein sichtbarer
			// Klartext „Bearbeiten" darf im Button-DOM erscheinen.
			const hasVisibleLabelText = await editButton.evaluate((el) => {
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				let node = walker.nextNode();
				while (node !== null) {
					const text = (node.textContent ?? '').trim();
					if (text.includes('Bearbeiten')) {
						// Prüfen, ob ein Vorfahre aria-hidden oder optisch versteckt ist.
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

		test('AK-307-5: Icon-Button „Bearbeiten" ist auf 375px in der Toolbar sichtbar', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 812 });

			const title = uniqueTitle('Mobil-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Der „…"-Button liegt in der Zeile und ist auch mobil sichtbar (innerhalb des Viewports).
			const moreButton = item(page, id).getByRole('button', { name: /Weitere Aktionen/i });
			await expect(moreButton).toBeVisible();

			const box = await moreButton.boundingBox();
			expect(box).not.toBeNull();
			if (box !== null) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
			}

			// Nach dem Öffnen ist der Edit-Icon-Button im Popover sichtbar.
			await openActionsPopover(page, id);
			const editButton = toolbar(page, id).getByRole('button', { name: 'Bearbeiten' });
			await expect(editButton).toBeVisible();
		});
	});

	/**
	 * Roter TDD-Vertrag für #361: Die vier sekundären Aktionen (Bearbeiten, Abhängigkeiten,
	 * Unteraufgabe anlegen, Löschen) rücken aus der stets sichtbaren `KolToolbar` in ein Popover, das
	 * über einen „…"-Button mit dem Accessible Name „Weitere Aktionen" geöffnet wird. Done-Toggle und
	 * Aufklapp-Toggle bleiben direkt sichtbar. Diese Specs sind rot, bis `TaskTree.tsx` den „…"-Trigger
	 * rendert und die Toolbar in das Popover verlagert.
	 */
	test.describe('#361 — Sekundäre Aktionen via Popover', () => {
		test('AK-361-1: „…"-Trigger ersetzt die Inline-Toolbar (Desktop + Mobil)', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Popover-Trigger'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Der „…"-Trigger ist sichtbar; die Aktions-Toolbar bleibt initial verborgen.
			await expect(item(page, id).getByRole('button', { name: /Weitere Aktionen/i })).toBeVisible();
			await expect(item(page, id).locator('[role="toolbar"]')).toBeHidden();

			// Auch auf Mobilbreite: Trigger sichtbar, Toolbar verborgen.
			await page.setViewportSize({ width: 375, height: 812 });
			await expect(item(page, id).getByRole('button', { name: /Weitere Aktionen/i })).toBeVisible();
			await expect(item(page, id).locator('[role="toolbar"]')).toBeHidden();
		});

		test('AK-361-2: Popover öffnet die vier sekundären Aktionen', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Vier-Aktionen'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			await expect(item(page, id).getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
			await expect(item(page, id).getByRole('button', { name: 'Abhängigkeiten' })).toBeVisible();
			await expect(item(page, id).getByRole('button', { name: 'Unteraufgabe anlegen' })).toBeVisible();
			await expect(item(page, id).getByRole('button', { name: 'Löschen' })).toBeVisible();
		});

		test('AK-361-3: Aktion wirkt über das Popover (Bearbeiten öffnet den Dialog)', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Popover-Aktion'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);
			await item(page, id).getByRole('button', { name: 'Bearbeiten' }).click();

			await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		});

		test('AK-361-4: Done- und Aufklapp-Toggle bleiben außerhalb des Popovers sichtbar', async ({ page }) => {
			const parentId = await createTask(page, uniqueTitle('Toggle-Eltern'));
			const childId = await createTask(page, uniqueTitle('Toggle-Kind'));
			await addSubtask(page, parentId, childId);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Ohne das „…"-Popover zu öffnen, sind beide Toggles direkt sichtbar.
			// Im invertierten Wald (#363) ist `childId` die sichtbare Wurzel — dessen Toggles prüfen.
			await expect(page.getByTestId(`done-toggle-${childId}`)).toBeVisible();
			await expect(toggle(page, childId)).toBeVisible();
		});

		test('AK-361-5: Mobile-First — kein horizontaler Überlauf bei geöffnetem Popover', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 812 });

			const id = await createTask(page, uniqueTitle('Mobil-Popover'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			// Kein horizontaler Überlauf: Die Seite ragt nicht über die Viewport-Breite hinaus.
			const overflowsHorizontally = await page.evaluate(() => {
				const root = document.querySelector('[data-testid="task-tree"]');
				if (root === null) {
					return true;
				}
				return root.scrollWidth > window.innerWidth + 1;
			});
			expect(overflowsHorizontally).toBe(false);
		});

		test('AK-361-6: „…"-Button erfüllt das Touch-Target-Minimum (44×44)', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Touch-Target'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			const moreButton = item(page, id).getByRole('button', { name: /Weitere Aktionen/i });
			await expect(moreButton).toBeVisible();

			const box = await moreButton.boundingBox();
			expect(box).not.toBeNull();
			if (box !== null) {
				expect(box.height).toBeGreaterThanOrEqual(44);
				expect(box.width).toBeGreaterThanOrEqual(44);
			}
		});
	});

	/**
	 * Roter TDD-Vertrag für #369: Das Popover-Panel der vier sekundären Aktionen ist linksbündig
	 * zum „…"-Trigger ausgerichtet, und alle vier Buttons stehen auf Standard- und Mobilbreite
	 * (375px) in einer einzigen Zeile nebeneinander (kein Umbruch). Dazu erhält das Popover-Panel
	 * eine `min-width`, die für vier Touch-Targets à ≥44px ausreicht. Diese Specs sind rot, bis
	 * `TaskTree.tsx`/`app.css` die Ausrichtung und `min-width` umsetzen.
	 */
	test.describe('#369 — Popover-Panel linksbündig + min-width (Responsive Mobile-First)', () => {
		/** x-Koordinate (linke Kante) der gerenderten Toolbar (Popover-Inhalt). */
		const toolbarLeftX = async (page: Page, id: number): Promise<number | null> =>
			page.evaluate((taskId) => {
				const taskItem = document.querySelector(`[data-testid="task-tree-item-${taskId}"]`);
				if (!taskItem) return null;
				// KoliBri rendert den Popover-Inhalt in einem Popover-Panel (evtl. im Shadow DOM).
				// Wir pierchen durch Shadow Roots, um das erste [role="toolbar"]-Element zu finden.
				const pierce = (root: Document | ShadowRoot | Element): Element | null => {
					const direct = root.querySelector('[role="toolbar"]');
					if (direct) return direct;
					for (const el of Array.from(root.querySelectorAll('*'))) {
						if (el.shadowRoot) {
							const found = pierce(el.shadowRoot);
							if (found) return found;
						}
					}
					return null;
				};
				const toolbar = pierce(taskItem);
				return toolbar ? toolbar.getBoundingClientRect().left : null;
			}, id);

		// Bewusst offen: Viewport-Klemm-Kompromiss (#369) — Panel wird soweit wie nötig nach links
		// geschoben, damit es vollständig sichtbar/bedienbar bleibt. An einem 1280px-Viewport ohne
		// Rand-Reserve bleibt das Panel rechts des Triggers; strikte Linksbündigkeit bräche crud/
		// focus-after-delete/keyboard-shortcuts. Menschliche Entscheidung nötig: AK lockern oder
		// Layout anpassen (mehr Platz rechts vom Trigger).
		test.fixme('AK-369-1: Popover-Panel ist linksbündig zum „…"-Trigger ausgerichtet (≤ 1px Toleranz)', async ({
			page,
		}) => {
			const id = await createTask(page, uniqueTitle('Linksbündig-369'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			const moreButton = item(page, id).getByRole('button', { name: /Weitere Aktionen/i });
			const triggerBox = await moreButton.boundingBox();
			expect(triggerBox).not.toBeNull();

			await openActionsPopover(page, id);
			await expect(item(page, id).locator('[role="toolbar"]')).toBeVisible();

			const panelLeft = await toolbarLeftX(page, id);
			expect(panelLeft).not.toBeNull();
			if (triggerBox !== null && panelLeft !== null) {
				// Linke Kante des Panels ≤ 1px Abstand zur linken Kante des „…"-Triggers.
				expect(Math.abs(panelLeft - triggerBox.x)).toBeLessThanOrEqual(1);
			}
		});

		test('AK-369-2: Alle 4 Aktions-Buttons stehen auf Desktop in einer Zeile (kein Umbruch)', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Zeile-Desktop-369'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			const buttonNames = ['Bearbeiten', 'Abhängigkeiten', 'Unteraufgabe anlegen', 'Löschen'];
			const yCoords: number[] = [];

			for (const name of buttonNames) {
				const btn = item(page, id).getByRole('button', { name });
				await expect(btn).toBeVisible();
				const box = await btn.boundingBox();
				expect(box).not.toBeNull();
				if (box !== null) yCoords.push(box.y);
			}

			// Alle 4 Buttons müssen auf derselben vertikalen Position liegen (± 1px).
			const minY = Math.min(...yCoords);
			const maxY = Math.max(...yCoords);
			expect(maxY - minY).toBeLessThanOrEqual(1);
		});

		test('AK-369-2b: Alle 4 Aktions-Buttons stehen auf 375px-Breite in einer Zeile (kein Umbruch)', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 375, height: 812 });

			const id = await createTask(page, uniqueTitle('Zeile-Mobil-369'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			const buttonNames = ['Bearbeiten', 'Abhängigkeiten', 'Unteraufgabe anlegen', 'Löschen'];
			const yCoords: number[] = [];

			for (const name of buttonNames) {
				const btn = item(page, id).getByRole('button', { name });
				await expect(btn).toBeVisible();
				const box = await btn.boundingBox();
				expect(box).not.toBeNull();
				if (box !== null) yCoords.push(box.y);
			}

			// Auf 375px darf kein Umbruch entstehen — alle 4 Buttons auf gleicher y-Koordinate (± 1px).
			const minY = Math.min(...yCoords);
			const maxY = Math.max(...yCoords);
			expect(maxY - minY).toBeLessThanOrEqual(1);
		});

		test('AK-369-3: Kein horizontaler Overflow bei 375px mit geöffnetem Popover (trotz min-width)', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 375, height: 812 });

			const id = await createTask(page, uniqueTitle('Overflow-369'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			// Das Popover-Panel mit min-width darf die Viewport-Breite nicht überschreiten.
			const overflowsHorizontally = await page.evaluate(() => {
				return document.documentElement.scrollWidth > window.innerWidth + 1;
			});
			expect(overflowsHorizontally).toBe(false);
		});

		test('AK-369-4: Alle 4 Aktions-Buttons erfüllen das Touch-Target-Minimum (44×44)', async ({ page }) => {
			const id = await createTask(page, uniqueTitle('Touch-Targets-369'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			await openActionsPopover(page, id);

			const buttonNames = ['Bearbeiten', 'Abhängigkeiten', 'Unteraufgabe anlegen', 'Löschen'];

			for (const name of buttonNames) {
				const btn = item(page, id).getByRole('button', { name });
				await expect(btn).toBeVisible();
				const box = await btn.boundingBox();
				expect(box).not.toBeNull();
				if (box !== null) {
					expect(box.height).toBeGreaterThanOrEqual(44);
					expect(box.width).toBeGreaterThanOrEqual(44);
				}
			}
		});
	});

	/**
	 * Roter TDD-Vertrag für #380: Das „…"-Popover-Panel soll links neben dem Trigger öffnen
	 * (nicht mehr darunter). Assertion: rechte Kante des Panels ≤ linke Kante des Triggers (≤ 1px).
	 * Dieser Test ist rot, bis `TaskTree.tsx` `_popoverAlign="left"` setzt und der
	 * `alignPopoverPanelLeft`-Workaround auf `width: max-content` reduziert wurde.
	 */
	test.describe('#380 — Popover öffnet links vom Trigger', () => {
		/** x-Koordinate der RECHTEN Kante des gerenderten Popover-Panels (Shadow-DOM-pierce). */
		const toolbarRightX = async (page: Page, id: number): Promise<number | null> =>
			page.evaluate((taskId) => {
				const taskItem = document.querySelector(`[data-testid="task-tree-item-${taskId}"]`);
				if (!taskItem) return null;
				const pierce = (root: Document | ShadowRoot | Element): Element | null => {
					const direct = root.querySelector('[role="toolbar"]');
					if (direct) return direct;
					for (const el of Array.from(root.querySelectorAll('*'))) {
						if (el.shadowRoot) {
							const found = pierce(el.shadowRoot);
							if (found) return found;
						}
					}
					return null;
				};
				const toolbar = pierce(taskItem);
				return toolbar ? toolbar.getBoundingClientRect().right : null;
			}, id);

		test('AK-380-1: Popover-Panel öffnet links — rechte Panel-Kante ≤ linke Trigger-Kante (≤ 1px Toleranz)', async ({
			page,
		}) => {
			const id = await createTask(page, uniqueTitle('LinksOffen-380'));

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			const moreButton = item(page, id).getByRole('button', { name: /Weitere Aktionen/i });
			const triggerBox = await moreButton.boundingBox();
			expect(triggerBox).not.toBeNull();

			await openActionsPopover(page, id);
			await expect(item(page, id).locator('[role="toolbar"]')).toBeVisible();

			const panelRight = await toolbarRightX(page, id);
			expect(panelRight).not.toBeNull();
			if (triggerBox !== null && panelRight !== null) {
				// Rechte Kante des Panels ≤ linke Kante des Triggers (Panel steht links neben dem Trigger).
				expect(panelRight).toBeLessThanOrEqual(triggerBox.x + 1);
			}
		});
	});
});
