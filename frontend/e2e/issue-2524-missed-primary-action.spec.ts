import { expect, test, type Locator, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #2524 „Verpasst-Block mit einer Primäraktion je Aufgabe"
 * (Spec docs/spec/issue-2524.md).
 *
 * AK1: je `missed-item` genau ein sichtbarer Button („Erledigt"); Neu planen/Archivieren/
 *      Löschen nur im geöffneten „…"-Popover („Weitere Aktionen").
 * AK2: die drei Popover-Aktionen wirken wie vorher (Archivieren entfernt das Item,
 *      Neu planen öffnet die Task-Bearbeitung).
 * AK3: „Löschen" öffnet die sequenzielle Bestätigung (ConfirmDeleteDialog) unverändert.
 * AK4: Primärbutton, „…"-Auslöser und Popover-Einträge ≥ 44 px, ≥ 8 px Abstand.
 * AK5: 375×812, zwei verpasste Aufgaben — die Liste unterhalb des Verpasst-Blocks beginnt
 *      oberhalb des Falzes (Bounding-Box statt scrollWidth — App-Shell clippt `overflow-x: hidden`).
 * AK6: nach einer Popover-Aktion ist das Popover geschlossen (Muster TaskTree, Ref).
 *
 * Wie issue-1964-missed-area.spec.ts gegen das echte Backend; überfällige Tasks werden direkt
 * über die API angelegt (Deadline in der Vergangenheit ist API-valide). Rot, bis der
 * „…"-Auslöser („Weitere Aktionen") und das Popover in `MissedTasksSection` existieren.
 * KEIN Produktivcode.
 */

const DAY = 24 * 60 * 60 * 1000;

const createTaskViaApi = async (page: Page, data: Record<string, unknown>): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data });
	expect(response.ok()).toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const missedItem = (page: Page, title: string): Locator => page.getByTestId('missed-item').filter({ hasText: title });

/** Der „…"-Auslöser — Icon-only, zugänglicher Name „Weitere Aktionen" (Muster TaskTree #361). */
const moreButton = (item: Locator): Locator => item.getByRole('button', { name: /weitere aktionen/i });

/** Das Panel im offenen Shadow-DOM von `kol-popover-button` (Locators piercen Shadow Roots, Muster issue-1186). */
const popoverPanel = (item: Locator): Locator =>
	item.locator('kol-popover-button').locator('.kol-popover-button__popover');

const openActionsPopover = async (item: Locator): Promise<void> => {
	await moreButton(item).click();
	await expect(popoverPanel(item)).toBeVisible();
};

/** Öffnet /app/aufgaben auf dem Aufgaben-Tab bei 375×812 und wartet auf die stabile Ansicht. */
const openAufgabenTab = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/app/aufgaben');
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await waitForStableView(page);
};

/** boundingBox() misst einmalig und wartet nicht nach (Memory 2026-09-14): kurze Schleife. */
const measure = async (locator: Locator) => {
	await expect(locator).toBeVisible();
	let box = await locator.boundingBox();
	for (let i = 0; i < 30 && !box; i += 1) {
		await locator.page().waitForTimeout(100);
		box = await locator.boundingBox();
	}
	expect(box, 'Touch-Ziel muss messbar sein').not.toBeNull();
	return box!;
};

test.describe('Balamentum — #2524: Verpasst-Block mit einer Primäraktion', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1+AK5 — 375×812: je Item nur „Erledigt" sichtbar; Liste beginnt oberhalb des Falzes', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Verpasst eins', deadline: past });
		await createTaskViaApi(page, { title: 'Verpasst zwei', deadline: past });

		await openAufgabenTab(page);
		await expect(page.getByTestId('missed-section')).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId('missed-item')).toHaveCount(2);

		for (const title of ['Verpasst eins', 'Verpasst zwei']) {
			const item = missedItem(page, title);
			// AK1: „Erledigt“ ist der Primärbutton — Test-Pflege #2524: der Icon-only-„…“-Auslöser
			// („Weitere Aktionen“, gefordert ab AK2) ist der zweite sichtbare Button (Muster #2361).
			await expect(item.locator('button:visible')).toHaveCount(2);
			await expect(item.getByRole('button', { name: /^erledigt$/i })).toBeVisible();
			// die drei Sekundäraktionen sind zugeklappt nicht erreichbar (Popover zu)
			await expect(item.getByRole('button', { name: /neu planen/i })).not.toBeVisible();
			await expect(item.getByRole('button', { name: /archivieren/i })).not.toBeVisible();
			await expect(item.getByRole('button', { name: /löschen/i })).not.toBeVisible();
		}

		// AK5: die reguläre Liste unterhalb des Verpasst-Blocks beginnt oberhalb des Falzes (812),
		// ohne horizontalen Scroll (Bounding-Box statt scrollWidth — App-Shell clippt).
		const listBox = await measure(page.locator('.task-section'));
		expect(listBox.y).toBeLessThanOrEqual(812);
		expect(listBox.x).toBeGreaterThanOrEqual(0);
		expect(listBox.x + listBox.width).toBeLessThanOrEqual(375);
	});

	test('AK2+AK6 — Popover-Aktionen wirken wie vorher; Popover schließt nach der Aktion', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Popover-Archiv', deadline: past });
		await createTaskViaApi(page, { title: 'Popover-Plan', deadline: past });

		await openAufgabenTab(page);
		await expect(page.getByTestId('missed-section')).toBeVisible({ timeout: 5000 });

		// AK2 (Archivieren, einstufig wie in #1964): Item verlässt den Verpasst-Bereich
		const archivItem = missedItem(page, 'Popover-Archiv');
		await openActionsPopover(archivItem);
		await archivItem.getByRole('button', { name: /archivieren/i }).click();
		await expect(archivItem).toHaveCount(0);

		// AK2 (Neu planen) + AK6: Bearbeitung öffnet, das Popover ist dahinter geschlossen
		const planItem = missedItem(page, 'Popover-Plan');
		await openActionsPopover(planItem);
		await planItem.getByRole('button', { name: /neu planen/i }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await expect(popoverPanel(planItem)).not.toBeVisible();
	});

	test('AK3 — „Löschen" im Popover öffnet die sequenzielle Bestätigung', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Popover-Löscher', deadline: past });

		await openAufgabenTab(page);
		const item = missedItem(page, 'Popover-Löscher');
		await expect(item).toBeVisible({ timeout: 5000 });

		await openActionsPopover(item);
		await item.getByRole('button', { name: /löschen/i }).click();
		// sequenzielle Bestätigung (ConfirmDeleteDialog), unverändert in Inhalt und Ablauf
		await expect(page.getByText(/wirklich gelöscht werden/i)).toBeVisible();
		await page.getByRole('button', { name: /endgültig löschen/i }).click();

		await expect(item).toHaveCount(0);
		const rest = (await (await page.request.get('/api/v1/tasks')).json()) as { title: string }[];
		expect(rest.find((task) => task.title === 'Popover-Löscher')).toBeUndefined();
	});

	test('AK4 — Touch-Ziele ≥ 44 px, ≥ 8 px Abstand (375 px)', async ({ page }) => {
		const past = new Date(Date.now() - DAY).toISOString();
		await createTaskViaApi(page, { title: 'Touch-Ziele', deadline: past });

		await openAufgabenTab(page);
		const item = missedItem(page, 'Touch-Ziele');
		await expect(item).toBeVisible({ timeout: 5000 });

		const doneBox = await measure(item.getByRole('button', { name: /^erledigt$/i }));
		const moreBox = await measure(moreButton(item));
		expect(doneBox.height).toBeGreaterThanOrEqual(44);
		expect(moreBox.height).toBeGreaterThanOrEqual(44);
		// Mobile-UI-Regel 2: mindestens 8 px Abstand zwischen den Touch-Zielen einer Zeile
		expect(moreBox.x - (doneBox.x + doneBox.width)).toBeGreaterThanOrEqual(8);

		await openActionsPopover(item);
		for (const name of [/neu planen/i, /archivieren/i, /löschen/i]) {
			// Test-Pflege #2524: die KolToolbar-Buttons liegen NICHT im `.kol-popover-button__popover`-
			// Subtree (Light-DOM-Slot) — über das Item selbst finden (Muster issue-2361, templateAction).
			const entryBox = await measure(item.getByRole('button', { name }));
			expect(entryBox.height).toBeGreaterThanOrEqual(44);
		}
	});
});
