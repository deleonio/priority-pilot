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
 *     auslösbar (#472). Seit der #1106-Konsolidierung auf `ConfirmDeleteDialog` gilt das für alle
 *     vier Lösch-Dialoge einschließlich des Serien-Dialogs (#553).
 *  2. „Endgültig löschen" ist dabei zu KEINEM Zeitpunkt fokussiert, auch nicht kurz (#479).
 *  3. Der Fokus bleibt danach frei beweglich — Tab funktioniert sofort (AK4, neu).
 *  4. Beim Abbrechen kehrt der Fokus zum auslösenden Element zurück (#182).
 *  5. Nach erfolgreichem Löschen — der Auslöser ist dann aus dem DOM — übernimmt das
 *     Fallback-Element, nicht `document.body` (#182).
 */
declare global {
	interface Window {
		/** Setzt der `focusin`-Beobachter auf `true`, sobald „Endgültig löschen" auch nur einmal
			fokussiert war (sichtbarer Fokus-Sprung). */
		__deleteButtonEverFocused?: boolean;
	}
}

test.describe('Lösch-Dialoge — Fokus-Vertrag', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E-DelFocus-${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

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

		// Issue 653: Tab-Freiheit — Fokus muss sich bewegen lassen (Mechanik s. Helper-Kommentar).
		await assertTabFreedomInOpenDeleteDialog(page);
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

		// Issue 653: Tab-Freiheit — Fokus muss sich bewegen lassen (Mechanik s. Helper-Kommentar).
		await assertTabFreedomInOpenDeleteDialog(page);
	});

	// #553/#1106: Der Serien-Löschdialog hat drei Buttons (Abbrechen → Nein → Ja) und keinen
	// „Endgültig löschen"-Button — seit der #1106-Konsolidierung auf `ConfirmDeleteDialog` gilt
	// derselbe Fokus-Vertrag wie für Task/Säule (Initialfokus „Abbrechen", Danger zuletzt). Die
	// shared Helpers (`installDeleteFocusWatcher`, `assertCancelFocusedWithoutJump`) horchen auf
	// genau den Text „Endgültig löschen" und sind deshalb hier bedeutungslos — stattdessen
	// INLINE-Assertions, die auf die Serien-Button-Texte zielen.
	test('AK3 — Serien-Löschen: Bestätigungsdialog statt Sofort-Löschung, Initialfokus auf „Abbrechen"', async ({
		page,
	}) => {
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

		// #472/#1106: Initialfokus liegt auf „Abbrechen" — weder die kaskadierende Löschung „Ja" noch
		// der sichere Default „Nein" ist per Enter auslösbar, bevor der Fokus bewusst verlagert wird.
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
		await expect(page.getByRole('button', { name: /^Ja \(Serie \+ alle Aufgaben\)/ })).not.toBeFocused();

		// Issue 653: Tab-Freiheit — Fokus muss sich bewegen lassen. Tab von „Abbrechen" landet in der
		// DOM-Reihenfolge (Abbrechen → Nein → Ja) auf dem sicheren Default „Nein". SETTLE_MS wie AK4:
		// KoliBris setFocus-Loop zieht ein Tab im ersten ~100-ms-Fenster zurück.
		const SETTLE_MS = 150;
		await page.waitForTimeout(SETTLE_MS);
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: /^Nein/i })).toBeFocused();
		await expect(page.getByRole('button', { name: 'Abbrechen' })).not.toBeFocused();
	});

	/**
	 * AK4 — Der Initialfokus darf den Nutzer nicht festhalten.
	 *
	 * Diese Lücke blieb offen, obwohl drei Specs den Dialog-Fokus abdeckten: keine drückte Tab. Ein
	 * Mechanismus, der den Fokus auf „Abbrechen" *zurückzwingt* statt ihn einmalig zu setzen,
	 * erfüllt AK1–AK3 und sperrt Tastaturnutzer trotzdem aus. Genau das war der Zustand vor dieser
	 * Konsolidierung: ein `focusin`-Redirect in Modal.tsx hielt den Fokus 500 ms lang fest.
	 *
	 * Mechanik (SETTLE_MS, gestaffeltes Tab, shadow-bewusste Lande-Erkennung) teilt sich dieser
	 * Test mit AK1/AK2/AK8 über assertTabFreedomInOpenDeleteDialog — Begründung im Helper-Kommentar.
	 */
	test('AK4 — Tab bewegt den Fokus weiter (kein Fokus-Gefängnis)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskDeleteDialog(page, uniqueTitle('Tab'));
		await waitForStableView(page);

		await assertTabFreedomInOpenDeleteDialog(page);
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

		// #629: Tab-Freiheit nach Fokus-Rückgabe — der Fokus darf nicht im Auslöser gefangen
		// bleiben. Nach Dialog-Schließen läuft kein KoliBri-setFocus-Loop mehr, ein Tab bewegt
		// den Fokus direkt weiter (Shadow-DOM-tief über Playwrights toBeFocused geprüft).
		await page.keyboard.press('Tab');
		await expect(moreButton).not.toBeFocused();
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

		// #629: Tab-Freiheit nach Löschen — das Fallback-Element ist <main tabIndex=-1> und damit
		// kein Tab-Stop: ein Tab bewegt den Fokus garantiert weiter (kein Fokus-Gefängnis).
		const fallback = page.locator('[data-focus-fallback]');
		await expect(fallback).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(fallback).not.toBeFocused();
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
	 * Tab-Freiheit im offenen Task-/Säulen-Löschdialog — geteilter Vertrags-Check (AK1, AK2, AK4,
	 * AK8; #522 hatte die Lücke ursprünglich für die Säulen-/Serien-Dialoge geflaggt, AK4 deckt den
	 * Task-Dialog ab). AK9 (Serien) prüft inline — der Serien-Dialog hat seit #1106 zwar denselben
	 * Vertrag (Initialfokus „Abbrechen", Danger zuletzt), aber andere Button-Texte („Nein"/
	 * „Ja (Serie + alle Aufgaben)" statt „Endgültig löschen"), auf die dieser Helper zielt.
	 *
	 * Mechanik — SETTLE_MS = 150 plus gestaffelte Tab-Anschläge (~100 ms Abstand, max. ~3 s):
	 * KoliBris `setFocus()` (utils/element-focus.js) wiederholt den Fokus über bis zu 10 Frames
	 * (~<100 ms gemessen) und zieht ein in dieses Fenster fallendes Tab EINMALIG zurück —
	 * Library-Verhalten, das wir nicht ohne eigenen Watchdog aushebeln (und der wäre schlimmer).
	 * Auf langsamen CI-Runnern fällt das Fenster länger aus (beobachtet: PR #524, e2e Shard 1).
	 * 150 ms liegt darüber, aber deutlich unter den 500 ms des früheren focusin-Redirects in
	 * Modal.tsx — der Test bliebe mit dem alten Modal.tsx weiterhin ROT. Muss die Schwelle je
	 * erhöht werden, ist das ein Signal, dass jemand wieder einen Fokus-Watchdog eingebaut hat.
	 *
	 * Lande-Erkennung über die öffentliche Fokus-Assertion (toBeFocused ist shadow-durchdringend):
	 * Ein früherer manueller Vergleich `document.activeElement === el` war bei KoliBri nie erfüllbar
	 * — activeElement ist das HOST-Element (<kol-button>), der Locator resolved auf den inneren
	 * Shadow-DOM-Button. Der Loop lief deshalb stets in die Deadline, und die grüne
	 * Schluss-Assertion hing davon ab, wo der letzte Tab zufällig landete (Flake-Muster „inactive",
	 * u. a. main 18.08. und PR #859). toPass wiederholt Tab-Anschlag + Kurz-Assertion, bis der
	 * Fokus nach dem Pull-back-Fenster tatsächlich auf dem Lösch-Button steht — ganz ohne
	 * Shadow-DOM-Zugriff (ESLint-Black-Box-Regel, #824).
	 */
	const assertTabFreedomInOpenDeleteDialog = async (page: Page): Promise<void> => {
		const SETTLE_MS = 150;
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeFocused();
		await page.waitForTimeout(SETTLE_MS);

		await expect(async () => {
			await page.keyboard.press('Tab');
			// Pull-back-Fenster des KoliBri-setFocus-Loops abwarten, DANN prüfen: ein nur transient
			// gelandeter Fokus wird zurückgezogen und zählt nicht als angekommen.
			await page.waitForTimeout(250);
			await expect(deleteButton).toBeFocused({ timeout: 250 });
		}).toPass({ timeout: 4000 });

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
		// #553/#1106: Der Serien-Löschdialog hat keinen „Endgültig löschen"-Button (siehe AK3) — die
		// shared Helper horchen auf genau diesen Text und greifen hier nicht. Statt dessen INLINE-
		// Assertions analog zu AK4: Initialfokus liegt auf „Abbrechen", Tab muss den Fokus weiter-
		// bewegen (kein Fokus-Gefängnis). SETTLE_MS wie in AK4 bewusst auf 150 gewählt.
		await expect(page.getByRole('button', { name: /^Ja \(Serie \+ alle Aufgaben\)/ })).toBeVisible();
		await waitForStableView(page);

		const SETTLE_MS = 150;
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		await expect(cancelButton).toBeFocused();

		await page.waitForTimeout(SETTLE_MS);
		await page.keyboard.press('Tab');

		// Tab muss den Fokus weiterbewegt haben — „Abbrechen" ist nicht mehr fokussiert, sondern der
		// nächste Dialog-Button in der DOM-Reihenfolge (Abbrechen → Nein → Ja): „Nein".
		const noButton = page.getByRole('button', { name: /^Nein/i });
		await expect(noButton, 'Tab muss den Fokus weiterbewegen dürfen').toBeFocused();
		await expect(cancelButton).not.toBeFocused();
	});
});
