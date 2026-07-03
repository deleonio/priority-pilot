import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #243 — „CTA Buttons sollen immer mit Strg+Enter abgesendet werden".
 *
 * Vertrag: In jedem Dialog/Formular mit einem primären CTA (KolButton `_variant="primary"`) löst
 * `Strg+Enter` (bzw. auf macOS `⌘+Enter`) die primäre Aktion aus — ohne dass der CTA-Button
 * fokussiert sein muss und aus jedem Fokus innerhalb des Dialogs heraus. Ist der CTA deaktiviert
 * (z. B. weil ein Pflichtfeld leer ist), passiert nichts. In mehrzeiligen Textfeldern darf der
 * Shortcut die Aktion auslösen, ohne einen Zeilenumbruch einzufügen.
 *
 * Die Umsetzung erfolgt über einen noch fehlenden Hook `useCtrlEnter`
 * (`frontend/src/lib/useCtrlEnter.ts`), der in die betroffenen Formulare/Dialoge eingebunden wird
 * (TaskForm, QuickCaptureModal, DeleteTaskDialog, DependencyModal, PillarWeightsModal,
 * SeriesFormModal). Bis dahin ist diese Spec rot: die Tests prüfen ausschließlich das
 * beobachtbare Soll-Verhalten (Aktion ausgelöst / nicht ausgelöst), nicht den Hook selbst.
 *
 * **Isolation:** Tests, die einen Task anlegen, räumen über `afterEach` alle Tasks via echter API
 * wieder ab (analog `crud.spec.ts`), damit jeder Test von einem leeren Zustand startet.
 */
test.describe('CTA-Buttons per Strg+Enter absenden (#243)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `KB ${label} #${(runId += 1)}-${Date.now()}`;

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

	/** Wechselt auf den „Aufgaben"-Tab (die Task-Tabelle liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Öffnet den „Neuen Task anlegen"-Dialog und überbrückt den Schnellerfassungs-Schritt (#236) via
	 * „Überspringen", sodass das reguläre Formular mit dem Titel-Feld sichtbar ist.
	 */
	const openTaskForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await expect(page.getByLabel('Titel')).toBeVisible();
	};

	test('AK1: Strg+Enter im offenen Dialog löst die primäre Aktion aus (Task wird gespeichert)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Strg+Enter');
		await page.getByLabel('Titel').fill(title);

		// Kein Klick auf „Speichern": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Der Dialog schließt sich (Aktion ausgeführt) und der Task erscheint in der Liste.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AK2: ⌘+Enter (macOS) löst dieselbe primäre Aktion aus wie Strg+Enter', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Meta+Enter');
		await page.getByLabel('Titel').fill(title);

		// macOS-Simulation: auf Linux gedrückt, muss der Hook `metaKey` gleichwertig behandeln.
		await page.keyboard.press('Meta+Enter');

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AK3: bei deaktiviertem CTA (Pflichtfeld leer) passiert bei Strg+Enter nichts', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Titel bleibt bewusst leer → der Speichern-Button ist deaktiviert (Pflichtfeld-Validierung).
		await expect(page.getByLabel('Titel')).toHaveValue('');

		// Fokus in das leere Titel-Feld setzen und den Shortcut auslösen.
		await page.getByLabel('Titel').click();
		await page.keyboard.press('Control+Enter');

		// Kurz warten, damit ein (fälschlich) ausgelöstes Schließen Zeit hätte, sichtbar zu werden.
		await page.waitForTimeout(500);

		// Nichts ist passiert: der Dialog ist weiterhin offen (Heading bleibt sichtbar).
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(page.getByLabel('Titel')).toBeVisible();

		// Gegenprobe: es wurde kein Task angelegt.
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		expect(tasks).toHaveLength(0);
	});

	test('AK4: Strg+Enter aus einem Textfeld heraus löst die Aktion aus, ohne Zeilenumbruch einzufügen', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Textfeld');
		await page.getByLabel('Titel').fill(title);

		// Fokus in das mehrzeilige Beschreibungs-Textfeld setzen — hier wäre ein Zeilenumbruch möglich.
		const description = page.getByLabel('Beschreibung (optional)');
		const descriptionText = 'Erste Zeile Beschreibung';
		await description.fill(descriptionText);
		await description.click();

		await page.keyboard.press('Control+Enter');

		// Aktion ausgelöst: der Dialog ist geschlossen …
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		// … und der Task wurde angelegt.
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Kein Zeilenumbruch: der gespeicherte Beschreibungstext enthält kein „\n".
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { title: string; description: string | null }[];
		const created = tasks.find((task) => task.title === title);
		expect(created).toBeDefined();
		expect(created?.description ?? '').toBe(descriptionText);
		expect(created?.description ?? '').not.toContain('\n');
	});

	test('AK5: auf 375-px-Viewport löst der Shortcut aus, ohne horizontales Scrollen / Layout-Bruch', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Kein horizontaler Overflow, während der Dialog offen ist.
		const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflowBefore, 'Kein horizontales Scrollen bei geöffnetem Dialog').toBe(true);

		const title = uniqueTitle('Mobile');
		await page.getByLabel('Titel').fill(title);

		await page.keyboard.press('Control+Enter');

		// Der Shortcut löst auch auf schmalem Viewport die primäre Aktion aus.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Layout unverändert: weiterhin kein horizontaler Overflow nach dem Absenden.
		const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflowAfter, 'Kein horizontales Scrollen nach dem Absenden').toBe(true);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});
});
