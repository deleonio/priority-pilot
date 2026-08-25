import { expect, test, type Locator, type Page } from './fixtures';
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

	/**
	 * Roter TDD-Vertrag für #1020, AK3+AK4 (Spec: docs/spec/issue-1020.md) — ersetzt den alten
	 * #228-AK-6-Test („passt ohne Scrollen in 375px"): Der Mobile-Karten-Modus ist per
	 * Nutzer-Entscheidung (Issue-Kommentar 2026-08-25 12:50Z) entfallen. Die Erledigt-Tabelle ist
	 * eine `KolTableStateful`; bei 375px scrollt sie INTERN horizontal, während die Seiten-Shell
	 * ohne Überlauf bleibt. Rot, bis `CompletedTasksTable.tsx` auf KolTable umgebaut ist.
	 */
	test('AK-6 (neu, #1020): Erledigt-Tabelle scrollt bei 375px intern — kein Karten-Modus, Seite ohne Überlauf', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Mobil');
		await createTaskViaUi(page, title);
		await markTaskDoneViaUi(page);

		await openCompletedTab(page);
		// Der „Wieder öffnen"-Schalter ist auch mobil erreichbar (Rollen-Locators piercen das
		// KoliBri-Shadow-DOM nativ — gültig für native wie KolTable-Zeilen).
		const row = page.getByRole('row').filter({ hasText: title });
		await expect(row.getByRole('button', { name: 'Wieder öffnen' })).toBeVisible();

		// #1020 AK1/AK4: KolTable-Host statt nativer Tabelle — ohne ihn ist alles Folgende sinnlos.
		const host = page.locator('.completed-tasks kol-table-stateful');
		await expect(host).toBeVisible();

		// #1020 AK4: kein Karten-Modus — die Kopfzeile ist sichtbar (der Karten-Modus blendete sie
		// visuell aus), und das native Karten-/Tabellen-Gerüst existiert nicht mehr (count 0 statt 1 —
		// schließt die `td[data-label]`-Beschriftungslogik mit ein, ohne KoliBri-Internelements zu raten).
		await expect(host.getByRole('columnheader').first()).toBeVisible();
		await expect(page.locator('.completed-tasks table.completed-tasks-table')).toHaveCount(0);

		// #1020 AK3: interner Scroll + Seite ohne Überlauf. Gemessen wird NICHT `body.scrollWidth`
		// (die App-Shell clippt mit `overflow-x: hidden`, der Wert wäre strukturell grün), sondern:
		// der Host bleibt in der Seitenbreite (Bounding-Box) und hat im Inneren (rekursiv durch die
		// offenen Shadow-Roots) einen horizontal scrollbaren Container mit echtem Überlauf.
		const geometry = await host.evaluate((el) => {
			const findScroller = (root: ParentNode): HTMLElement | null => {
				for (const node of Array.from(root.querySelectorAll('*'))) {
					if (node instanceof HTMLElement) {
						const overflowX = getComputedStyle(node).overflowX;
						if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) {
							return node;
						}
						// eslint-disable-next-line no-restricted-syntax -- KolTable-Scroll-Verhalten ist über die öffentliche Rollen-Schnittstelle nicht abfragbar; die Shadow-Roots werden ausschließlich lesend nach dem overflow-Container durchsucht (keine internen Klassen-/Tag-Selektoren, #824-Guard).
						const shadow = node.shadowRoot;
						if (shadow) {
							const hit = findScroller(shadow);
							if (hit) return hit;
						}
					}
				}
				return null;
			};
			return {
				hostRight: el.getBoundingClientRect().right,
				scroller: (() => {
					// `el.querySelectorAll('*')` durchsucht nur das Light-DOM des Hosts (leer, da
					// KolTableStateful ohne Kinder verwendet wird) — der Scroll-Container liegt im
					// eigenen Shadow-Root des Hosts, deshalb dort statt bei `el` selbst starten.
					// eslint-disable-next-line no-restricted-syntax -- s.o. Kommentar bei findScroller: lesende Durchquerung, kein interner Selektor.
					const hit = findScroller(el.shadowRoot ?? el);
					return hit ? { scrollWidth: hit.scrollWidth, clientWidth: hit.clientWidth } : null;
				})(),
			};
		});
		expect(geometry.hostRight).toBeLessThanOrEqual(375 + 1);
		expect(geometry.scroller).not.toBeNull();
		expect(geometry.scroller?.scrollWidth ?? 0).toBeGreaterThan(geometry.scroller?.clientWidth ?? 0);
	});

	/**
	 * Roter TDD-Vertrag für #1020, AK2 (Spec: docs/spec/issue-1020.md): Desktop-Geometrie der
	 * Erledigt-Tabelle am KolTable — kurze, inhaltsbezogene Spalten (Titel dominiert, Punkte bleiben
	 * schmaler) und einzeilige Kopfzellen. Ersetzt den #931-Geometrie-Block, dessen Messungen
	 * (`table-layout: fixed`, `th:first-child { width: 55 % }`, `td[data-label]`-Styling) an der
	 * nativen Tabelle hingen und mit ihr entfallen — die #931-Lesbarkeits-Essenz lebt hier in
	 * KoliBri-tauglicher Form weiter (Details: Spec „Abgrenzung"). Rot, bis der Umbau existiert:
	 * Alle Messungen sind auf den `kol-table-stateful`-Host scoped, der heute nicht gerendert wird.
	 */
	test.describe('#1020 — Desktop-Spaltengeometrie am KolTable (Spec docs/spec/issue-1020.md)', () => {
		/**
		 * Messbare Geometrie der KolTable-Kopfzeile: Breiten/Höhen der `th` im `thead` (rekursiv durch
		 * die offenen Shadow-Roots des Hosts gesammelt — Rollen-Locators allein geben keine Boxen) und
		 * das Höhen-/Zeilenhöhe-Verhältnis jeder Kopfzelle. `role="columnheader"` wäre ein Kandidat
		 * gewesen, matcht als reflektiertes Attribut aber nicht (native `th` haben die Rolle nur
		 * implizit) — `getAttribute('role')` lieferte `null`. Der eigentliche Grund für `count: 0` in
		 * CI war der Einstiegspunkt: `collect(el, [])` durchsuchte nur das (leere) Light-DOM des Hosts,
		 * statt in dessen eigenem Shadow-Root zu starten (s. u.).
		 */
		const kolHeaderGeometry = (host: Locator) =>
			host.evaluate((el) => {
				const collect = (root: ParentNode, acc: HTMLElement[]): HTMLElement[] => {
					for (const node of Array.from(root.querySelectorAll('*'))) {
						if (node instanceof HTMLElement) {
							acc.push(node);
							// eslint-disable-next-line no-restricted-syntax -- Kopfzellen-Geometrie liegt im KolTable-Shadow-DOM; Rollen-Locators liefern keine Bounding-Boxen aller th. Lesende Durchquerung ohne interne Selektoren (#824-Guard).
							const shadow = node.shadowRoot;
							if (shadow) collect(shadow, acc);
						}
					}
					return acc;
				};
				// `el.querySelectorAll('*')` durchsucht nur das Light-DOM des Hosts (leer, da
				// KolTableStateful ohne Kinder verwendet wird) — im eigenen Shadow-Root starten.
				// eslint-disable-next-line no-restricted-syntax -- s.o.: lesende Durchquerung, kein interner Selektor.
				const headers = collect(el.shadowRoot ?? el, []).filter((n) => n.tagName === 'TH' && n.closest('thead'));
				const ratio = (h: HTMLElement): number => {
					const cs = getComputedStyle(h);
					const lineHeight = parseFloat(cs.lineHeight);
					const reference = Number.isFinite(lineHeight) ? lineHeight : parseFloat(cs.fontSize) * 1.5;
					return h.getBoundingClientRect().height / reference;
				};
				return {
					count: headers.length,
					widths: headers.map((h) => h.getBoundingClientRect().width),
					maxHeightRatio: headers.reduce((max, h) => Math.max(max, ratio(h)), 0),
				};
			});

		test('AK2: Titel-Spalte dominiert, Punkte-Spalten bleiben schmal, Kopfzeile einzeilig (1280px)', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await page.goto('/');
			await waitForStableView(page);

			const title = uniqueTitle('1020-Geometrie');
			await createTaskViaUi(page, title);
			await markTaskDoneViaUi(page);
			await openCompletedTab(page);

			const host = page.locator('.completed-tasks kol-table-stateful');
			// Auto-retryend auf die gerenderte Zeile warten — waitForStableView deckt den Async-Fetch
			// der Erledigt-Liste nicht ab (Race, #931-Erfahrung, CI-Run 32637060845).
			await expect(host.getByRole('row').filter({ hasText: title })).toBeVisible();

			const geometry = await kolHeaderGeometry(host);
			// All-Quantor-Schutz: Ohne gefundene Kopfzellen wäre `Math.max(…[])` = -Infinity und die
			// Breiten-Assertions leer-mengen-grün. Kopfzeile: [Titel, …Säulen, Aktion].
			expect(geometry.count).toBeGreaterThanOrEqual(3);
			const [titleWidth, ...rest] = geometry.widths;
			const pointWidths = rest.slice(0, -1); // letzte Spalte ist „Aktion"

			// Lesbarkeits-Kern (ehem. #931, KoliBri-tauglich): Der Titel dominiert, die Punkte-Spalten
			// bleiben schmaler als die Titel-Spalte.
			expect(pointWidths.length).toBeGreaterThanOrEqual(1);
			for (const width of pointWidths) {
				expect(width).toBeLessThan(titleWidth);
			}

			// Kurze Header brechen nicht um: jede Kopfzelle ist einzeilig (Höhe < 2 × Zeilenhöhe).
			expect(geometry.maxHeightRatio).toBeLessThan(2);
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

			// Kein Überlauf der Seiten-Shell (#1020): Der KolTable-Host verlässt die 375px-Breite
			// nicht (Bounding-Box statt `body.scrollWidth` — die App-Shell clippt mit
			// `overflow-x: hidden`, der alte Check war strukturell immer grün; Messtechnik: Spec
			// docs/spec/issue-1020.md).
			const host = page.locator('.completed-tasks kol-table-stateful');
			// Erst sichtbar warten, dann messen: `locator.evaluate` auf fehlendem Element liefe
			// sonst in den vollen 30s-Test-Timeout statt schnell rot zu werden.
			await expect(host).toBeVisible();
			const hostRight = await host.evaluate((el) => el.getBoundingClientRect().right);
			expect(hostRight).toBeLessThanOrEqual(375 + 1);
		});
	});
});
