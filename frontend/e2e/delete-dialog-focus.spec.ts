import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Fokus-Vertrag der Lösch-Bestätigungsdialoge — eine Datei für das gesamte Verhalten.
 *
 * Ersetzt drei über die Zeit gewachsene Specs, die dasselbe Verhalten in drei Formulierungen
 * beschrieben (#182 `focus-after-delete`, #472 `cancel-initial-focus`, #479
 * `delete-dialog-no-focus-jump`): 13 Tests, davon fünf wortgleiche Kopien. Die Anforderung hat
 * sich zweimal verschärft — erst „Fokus zurückgeben", dann „Initialfokus auf Abbrechen", dann
 * „Abbrechen ohne sichtbaren Zwischen-Fokus auf dem destruktiven Button". Jede Verschärfung
 * subsumiert die vorige, deshalb steht hier nur noch die jeweils stärkste Aussage.
 *
 * Der Vertrag in Worten:
 *  1. Beim Öffnen liegt der Fokus auf „Abbrechen" — die irreversible Aktion ist nicht per Enter
 *     auslösbar (#472).
 *  2. „Endgültig löschen" ist dabei zu KEINEM Zeitpunkt fokussiert, auch nicht kurz (#479).
 *  3. Der Fokus bleibt danach frei beweglich — Tab funktioniert sofort (AK4, neu).
 *  4. Beim Abbrechen kehrt der Fokus zum auslösenden Element zurück (#182).
 *  5. Nach erfolgreichem Löschen — der Auslöser ist dann aus dem DOM — übernimmt das
 *     Fallback-Element, nicht `document.body` (#182).
 */
declare global {
	interface Window {
		/** Setzt der `focusin`-Beobachter auf `true`, sobald „Endgültig löschen" auch nur einmal
		 * fokussiert war (sichtbarer Fokus-Sprung). */
		__deleteButtonEverFocused?: boolean;
	}
}

test.describe('Lösch-Dialoge — Fokus-Vertrag', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E-DelFocus-${label}-#${(runId += 1)}-${Date.now()}`;

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	const deleteAllSeries = async (page: Page): Promise<void> => {
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	// Säulen werden BEWUSST nicht aufgeräumt: die geseedeten Säulen-Stammdaten (DB_SEED=false hält
	// sie) brauchen nachfolgende Specs. AK2 legt seine eigene Säule an und löscht sie im Test selbst.
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllSeries(page);
	});

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	/** Legt einen Task an und öffnet dessen Lösch-Dialog. Gibt den auslösenden Button zurück. */
	const openTaskDeleteDialog = async (page: Page, title: string) => {
		await createTaskViaUi(page, title);
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		const moreButton = page.getByRole('button', { name: 'Weitere Aktionen' }).first();
		await moreButton.click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		return moreButton;
	};

	/**
	 * Beobachter, der jeden Fokuswechsel mitliest und festhält, ob „Endgültig löschen" jemals den
	 * Fokus hatte. Muss VOR dem Öffnen des Dialogs laufen, sonst entgeht ihm der initiale Fokus.
	 * `composedPath()` löst die Shadow-DOM-Grenze der KoliBri-Buttons auf.
	 */
	const installDeleteFocusWatcher = async (page: Page): Promise<void> => {
		await page.addInitScript(() => {
			window.__deleteButtonEverFocused = false;
			window.addEventListener(
				'focusin',
				(event) => {
					for (const node of event.composedPath()) {
						if (!(node instanceof Element)) {
							continue;
						}
						if ((node.textContent ?? '').trim().replace(/\s+/g, ' ') === 'Endgültig löschen') {
							window.__deleteButtonEverFocused = true;
							break;
						}
					}
				},
				true,
			);
		});
	};

	/** Endzustand + Weg dorthin: „Abbrechen" fokussiert, „Endgültig löschen" nie fokussiert. */
	const assertCancelFocusedWithoutJump = async (page: Page, readyText = 'Dashboard'): Promise<void> => {
		await waitForStableView(page, readyText);

		await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).not.toBeFocused();

		const everFocused = await page.evaluate(() => window.__deleteButtonEverFocused);
		expect(everFocused, 'destruktiver Button war zwischenzeitlich fokussiert (sichtbarer Sprung)').toBe(false);
	};

	test('AK1 — Task-Löschdialog: Initialfokus auf „Abbrechen", kein Sprung auf „Endgültig löschen"', async ({
		page,
	}) => {
		await installDeleteFocusWatcher(page);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskDeleteDialog(page, uniqueTitle('Task'));
		await assertCancelFocusedWithoutJump(page);
	});

	test('AK2 — Säulen-Löschdialog: Initialfokus auf „Abbrechen", kein Sprung', async ({ page }) => {
		await installDeleteFocusWatcher(page);
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const name = uniqueTitle('Säule');
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
		await page.locator('kol-dialog').getByRole('textbox', { name: 'Name' }).fill(name);
		await page.locator('kol-dialog').getByRole('button', { name: 'Anlegen' }).click();
		await expect(page.getByText(name, { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Säule löschen' })).toBeVisible();

		await assertCancelFocusedWithoutJump(page, 'Priority Pilot');
	});

	// #553: Der Serien-Löschdialog hat eine eigene Struktur (Ja/Nein/Abbrechen, kein
	// „Endgültig löschen") und damit einen bewusst ANDEREN Fokus-Vertrag als Task/Säule. Die shared
	// Helpers (`installDeleteFocusWatcher`, `assertCancelFocusedWithoutJump`) schützen den Vertrag
	// der unveränderten Task/Säule-Dialoge und werden hier bewusst NICHT verwendet — stattdessen
	// INLINE-Assertions, die der neuen Serien-Struktur folgen (Initialfokus auf „Nein", nicht „Abbrechen").
	test('AK3 — Serien-Löschen: Bestätigungsdialog statt Sofort-Löschung, Initialfokus auf „Nein"', async ({ page }) => {
		const title = uniqueTitle('Serie');
		const created = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(created.ok()).toBeTruthy();

		// #553: Kein `installDeleteFocusWatcher` — der Serien-Dialog hat keinen „Endgültig löschen"-
		// Button mehr, der Watcher (der genau auf diesen Text horcht) wäre hier bedeutungslos.
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		// #553: Der Dialog besitzt jetzt drei Buttons — „Ja (Serie + alle Aufgaben)" statt „Endgültig
		// löschen". Der Bestätigungsdialog erscheint (keine Sofort-Löschung mehr).
		await expect(page.getByRole('button', { name: /^Ja \(Serie \+ alle Aufgaben\)/ })).toBeVisible();

		// Der bloße Klick darf noch NICHT gelöscht haben — Bestätigungsdialog statt Sofort-Löschung.
		const afterClick = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(afterClick.some((entry) => entry.title === title)).toBeTruthy();

		// #553: Initialfokus liegt auf „Nein (nur Serie, …)" (sicherer Default — die kaskadierende
		// Löschung „Ja" ist nicht per Enter auslösbar). Der destruktive „Ja"-Button ist nicht fokussiert.
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: /^Nein/i })).toBeFocused();
		await expect(page.getByRole('button', { name: /^Ja \(Serie \+ alle Aufgaben\)/ })).not.toBeFocused();
	});

	/**
	 * AK4 — Der Initialfokus darf den Nutzer nicht festhalten.
	 *
	 * Diese Lücke blieb offen, obwohl drei Specs den Dialog-Fokus abdeckten: keine drückte Tab. Ein
	 * Mechanismus, der den Fokus auf „Abbrechen" *zurückzwingt* statt ihn einmalig zu setzen,
	 * erfüllt AK1–AK3 und sperrt Tastaturnutzer trotzdem aus. Genau das war der Zustand vor dieser
	 * Konsolidierung: ein `focusin`-Redirect in Modal.tsx hielt den Fokus 500 ms lang fest.
	 *
	 * SETTLE_MS = 150 ist bewusst gewählt und keine Beruhigungs-Wartezeit:
	 *  - KoliBris `setFocus()` (utils/element-focus.js) wiederholt den Fokus über bis zu 10 Frames
	 *    (~<100 ms gemessen). Innerhalb dieses Fensters zieht die Library einen Tab zurück — das ist
	 *    Library-Verhalten, das wir nicht ohne eigenen Watchdog aushebeln (und der wäre schlimmer).
	 *  - 150 ms liegt darüber, aber deutlich unter den 500 ms des früheren Redirects. Der Test wäre
	 *    mit dem alten Modal.tsx also weiterhin ROT und bleibt damit ein echter Regressionsschutz.
	 * Wird die Schwelle je erhöht werden müssen, ist das ein Signal, dass jemand wieder einen
	 * Fokus-Watchdog eingebaut hat — dann gehört die Ursache behoben, nicht die Zahl.
	 */
	test('AK4 — Tab bewegt den Fokus weiter (kein Fokus-Gefängnis)', async ({ page }) => {
		const SETTLE_MS = 150;

		await page.goto('/');
		await waitForStableView(page);

		await openTaskDeleteDialog(page, uniqueTitle('Tab'));
		await waitForStableView(page);

		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeFocused();

		await page.waitForTimeout(SETTLE_MS);

		// Zeitlich gestaffeltes Tab (alle ~100 ms, maximal ~1 s), bis der Lösch-Button den Fokus hält.
		// Grund: KoliBris anfänglicher setFocus-Loop (s. Kommentar oben, ~10 Frames) hält den Fokus
		// auf „Abbrechen" und zieht ein in dieses Fenster fallendes Tab EINMALIG zurück. Lokal ist
		// das Fenster mit ~<100 ms vorbei, auf langsamen CI-Runnern fällt es länger aus — ein
		// einzelnes Tab bei SETTLE_MS=150 fällt dann noch in den Loop und wird zurückgezogen
		// (beobachtet: PR #524, e2e Shard 1, „inactive" über 5 s). Das gestaffelte Tab sorgt dafür,
		// dass ein Anschlag NACH Loop-Ende trifft und stehen bleibt. Der Fokus-Check geht Shadow-
		// DOM-tief (KoliBri legt den echten <button> ins Shadow des <kol-button> — der bloße
		// Vergleich mit document.activeElement reicht nicht, das ist der Host).
		//
		// Schutz bleibt im Wesentlichen erhalten: Ein PERSISTENTER Fokus-Watchdog (focusin-Redirect,
		// der den Fokus dauerhaft festhält — der Zustand, den dieser Test bewacht) zieht JEDES Tab
		// zurück, die Ruhe tritt nie ein, die schließende Assertion rotet weiterhin. In Kauf
		// genommen wird nur ein KURZER (< 1 s), einmaliger Redirect (gerade das Library-Verhalten).
		// SETTLE_MS wird bewusst NICHT erhöht — ein zu knapper Wert bleibt das Watchdog-Signal.
		const tabDeadline = Date.now() + 1000;
		for (;;) {
			await page.keyboard.press('Tab');
			const onDelete = await deleteButton.evaluate((el) => {
				let node = document.activeElement as Element | null;
				while (node !== null) {
					if (node === el) {
						return true;
					}
					node = node.shadowRoot ? (node.shadowRoot.activeElement as Element | null) : null;
				}
				return false;
			});
			if (onDelete || Date.now() >= tabDeadline) {
				break;
			}
			await page.waitForTimeout(100);
		}

		await expect(deleteButton, 'Tab muss den Fokus weiterbewegen dürfen').toBeFocused();
		await expect(cancelButton).not.toBeFocused();
	});

	test('AK5 — Abbrechen gibt den Fokus an das auslösende Element zurück', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const moreButton = await openTaskDeleteDialog(page, uniqueTitle('Abbrechen'));
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// „Löschen" liegt im Popover; dessen hidePopover() gibt den Fokus synchron an den Invoker
		// „Weitere Aktionen" zurück — Modal.tsx merkt sich diesen als Auslöser.
		await expect(moreButton).toBeFocused();
	});

	test('AK6 — Nach erfolgreichem Löschen übernimmt das Fallback-Element (nicht document.body)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Zwei Tasks: nach dem Löschen bleibt die Liste bestehen — der Auslöser ist trotzdem weg,
		// weil seine Zeile neu gerendert wird. Deckt den einfacheren Ein-Task-Fall mit ab.
		await createTaskViaUi(page, uniqueTitle('Bleibt'));
		await openTaskDeleteDialog(page, uniqueTitle('Geloescht'));
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		await expect(page.locator('[data-focus-fallback]')).toBeFocused();
	});

	test('AK7 — Mobile-First 375px: Lösch-Dialog ohne horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await openTaskDeleteDialog(page, uniqueTitle('Mobile'));
		await waitForStableView(page);

		await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeVisible();

		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);
	});

	/**
	 * AK8 / AK9 — #522 (Test-Optimierung-Report — Behavior-Coverage-Lücke): Tab-Freiheit für die
	 * übrigen Löschdialoge.
	 *
	 * AK4 sichert den Tab-Freiheits-Vertrag für den Task-Löschdialog. Der Report flaggt dieselbe
	 * Lücke für die Säulen- (AK2) und Serien-Löschdialoge (AK3): beide hatten Initialfokus-Tests,
	 * aber keinen, der Tab drückt. Ein eigener Fokus-Watchdog in einem dieser beiden Dialoge (z. B.
	 * ein focusin-Redirect wie früher in Modal.tsx) würde nur hier auffallen — deshalb eigener Test
	 * je Dialog statt Vertrauen auf das geteilte <Modal>. SETTLE_MS wie in AK4 bewusst gewählt.
	 */
	const assertTabFreedomInOpenDeleteDialog = async (page: Page): Promise<void> => {
		const SETTLE_MS = 150;
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeFocused();
		await page.waitForTimeout(SETTLE_MS);
		await page.keyboard.press('Tab');
		await expect(deleteButton, 'Tab muss den Fokus weiterbewegen dürfen').toBeFocused();
		await expect(cancelButton).not.toBeFocused();
	};

	test('AK8 — Säulen-Löschdialog: Tab bewegt den Fokus weiter (kein Fokus-Gefängnis)', async ({ page }) => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const name = uniqueTitle('TabSäule');
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
		await page.locator('kol-dialog').getByRole('textbox', { name: 'Name' }).fill(name);
		await page.locator('kol-dialog').getByRole('button', { name: 'Anlegen' }).click();
		await expect(page.getByText(name, { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Säule löschen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		await assertTabFreedomInOpenDeleteDialog(page);
	});

	test('AK9 — Serien-Löschdialog: Tab bewegt den Fokus weiter (kein Fokus-Gefängnis)', async ({ page }) => {
		const title = uniqueTitle('TabSerie');
		const created = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(created.ok()).toBeTruthy();

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		// #553: Der Serien-Löschdialog hat keinen „Endgültig löschen"-Button mehr (siehe AK3) und
		// damit einen anderen Fokus-Vertrag — die shared Helper sind auf Task/Säule (Initialfokus
		// „Abbrechen" + Tab nach „Endgültig löschen") zugeschnitten und greifen hier nicht. Statt-
		// dessen INLINE-Assertions analog zu AK4: Initialfokus liegt auf „Nein", Tab muss den Fokus
		// weiterbewegen (kein Fokus-Gefängnis). SETTLE_MS wie in AK4 bewusst auf 150 gewählt.
		await expect(page.getByRole('button', { name: /^Ja \(Serie \+ alle Aufgaben\)/ })).toBeVisible();
		await waitForStableView(page);

		const SETTLE_MS = 150;
		const noButton = page.getByRole('button', { name: /^Nein/i });
		await expect(noButton).toBeFocused();

		await page.waitForTimeout(SETTLE_MS);
		await page.keyboard.press('Tab');

		// Tab muss den Fokus weiterbewegt haben — „Nein" ist nicht mehr fokussiert, stattdessen
		// liegt der Fokus auf einem anderen Dialog-Button (z. B. „Abbrechen" oder „Ja").
		await expect(noButton, 'Tab muss den Fokus weiterbewegen dürfen').not.toBeFocused();
	});
});
