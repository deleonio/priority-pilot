import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { taskTitleText, waitForStableView } from './helpers';

/**
 * #1584 — Rückfrage beim Schließen des Aufgabenformulars ohne Speichern (Spec:
 * `docs/spec/issue-1584.md`). Deckt AK1–AK6 ab (AK7 in `frontend/src/lib/task.test.ts`, AK8 —
 * unverändertes Verhalten von `QuickCaptureModal`/`ConfirmDeleteDialog` — durch die bestehenden
 * Suiten `quick-capture.spec.ts` und `delete-dialog-focus.spec.ts` gedeckt, hier nicht dupliziert).
 * AK1–AK6 laufen über den Anlege-Flow (`QuickCaptureModal`, POST); der zusätzliche PATCH-Pfad-Test
 * (Fixup PR #1600, Finding #3) deckt denselben AK4-Vertrag für `TaskFormModal` beim Bearbeiten ab.
 */
test.describe('Aufgabenformular — Rückfrage beim Verlassen ohne Speichern', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E-Discard-${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
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

	/** Öffnet den Anlege-Dialog bis zum eigentlichen Formular (Modus-Auswahl überspringen). */
	const openNewTaskForm = async (page: Page): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
	};

	test('AK1: unverändert schließen (Escape) — Modal verschwindet sofort, keine Rückfrage', async ({ page }) => {
		await openNewTaskForm(page);

		await page.keyboard.press('Escape');

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await expect(page.getByRole('heading', { name: /Verwerfen|weiter bearbeiten/i })).toHaveCount(0);
	});

	test('AK2/AK3: geändert schließen (Escape) zeigt Rückfrage — „Weiter bearbeiten" hält den Titel und lässt das Formular offen', async ({
		page,
	}) => {
		await openNewTaskForm(page);

		const title = uniqueTitle('Weiterbearbeiten');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		await page.keyboard.press('Escape');

		const confirmDialog = page.locator('kol-dialog').filter({ hasText: /Verwerfen/i });
		// Test-Pflege (Fixup PR #1600, Finding #1): der `<kol-dialog>`-Host hat wegen Shadow-DOM-`<slot>`
		// + Top-Layer-Rendering immer `{width:0,height:0}` und gilt Playwright daher unabhängig vom
		// tatsächlichen Öffnungszustand als „hidden" (Präzedenz `billing.spec.ts`/`lektorat-diff-modal.spec.ts`).
		// `toHaveCount(1)` prüft die Existenz, der rollenscoped Button-Locator die tatsächliche Sichtbarkeit.
		await expect(confirmDialog).toHaveCount(1);
		await expect(confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' })).toBeVisible();
		// Das Aufgabenformular ist zu diesem Zeitpunkt noch nicht geschlossen (AK2). Test-Pflege
		// (Fixup PR #1600, Test-Pflege-Hinweis „Defekt 2" der PR-Beschreibung): nach „Überspringen"
		// lautet die Dialog-Überschrift „Aufgabe anlegen" (QuickCaptureModal-Default `formMode: 'task'`
		// → `taskFormModalTitle(null, null, 'task')`), NICHT „Neuen Task anlegen" — das gilt nur für den
		// Capture-Schritt selbst (Zeile 36 oben). Unverändertes Verhalten gegenüber main, kein Defekt von #1584.
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();

		await confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' }).click();

		await expect(confirmDialog).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
	});

	test('AK4: „Verwerfen" schließt Formular und Rückfrage — kein POST, Titel taucht nicht in der Liste auf', async ({
		page,
	}) => {
		await openNewTaskForm(page);

		const title = uniqueTitle('Verwerfen');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		let postSent = false;
		await page.route('**/api/v1/tasks', (route: Route) => {
			if (route.request().method() === 'POST') {
				postSent = true;
			}
			return route.continue();
		});

		await page.keyboard.press('Escape');
		const confirmDialog = page.locator('kol-dialog').filter({ hasText: /Verwerfen/i });
		// Test-Pflege (Fixup PR #1600, Finding #1): der `<kol-dialog>`-Host hat wegen Shadow-DOM-`<slot>`
		// + Top-Layer-Rendering immer `{width:0,height:0}` und gilt Playwright daher unabhängig vom
		// tatsächlichen Öffnungszustand als „hidden" (Präzedenz `billing.spec.ts`/`lektorat-diff-modal.spec.ts`).
		// `toHaveCount(1)` prüft die Existenz, der rollenscoped Button-Locator die tatsächliche Sichtbarkeit.
		await expect(confirmDialog).toHaveCount(1);
		await expect(confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' })).toBeVisible();
		await confirmDialog.getByRole('button', { name: 'Verwerfen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await expect(confirmDialog).toBeHidden();

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(taskTitleText(page, title)).toHaveCount(0);
		expect(postSent).toBe(false);
	});

	test('AK4 (PATCH-Pfad, TaskFormModal): „Verwerfen" beim Bearbeiten schließt ohne PATCH, ursprünglicher Titel bleibt erhalten', async ({
		page,
	}) => {
		// Finding #3 (Fixup PR #1600): AK1-AK6 liefen bisher ausschließlich über den Anlege-Flow
		// (QuickCaptureModal → POST). `TaskFormModal` mit `task != null` (Bearbeiten, PATCH) war
		// ungetestet — hier explizit der direkt verdrahtete Bearbeiten-Dialog (`App.tsx`, `dialog.kind === 'edit'`).
		await openNewTaskForm(page);
		const originalTitle = uniqueTitle('PatchOriginal');
		await page.getByRole('textbox', { name: 'Titel' }).fill(originalTitle);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(taskTitleText(page, originalTitle)).toBeVisible();

		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		let patchSent = false;
		await page.route('**/api/v1/tasks/*', (route: Route) => {
			if (route.request().method() === 'PATCH') {
				patchSent = true;
			}
			return route.continue();
		});

		await page.getByRole('textbox', { name: 'Titel' }).fill(uniqueTitle('PatchGeaendert'));
		await page.keyboard.press('Escape');

		const confirmDialog = page.locator('kol-dialog').filter({ hasText: /Verwerfen/i });
		await expect(confirmDialog).toHaveCount(1);
		await expect(confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' })).toBeVisible();
		await confirmDialog.getByRole('button', { name: 'Verwerfen', exact: true }).click();

		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
		await expect(confirmDialog).toBeHidden();

		await expect(taskTitleText(page, originalTitle)).toBeVisible();
		expect(patchSent).toBe(false);
	});

	test('AK5: erfolgreiches Speichern schließt ohne Rückfrage, obwohl Werte geändert wurden', async ({ page }) => {
		await openNewTaskForm(page);

		const title = uniqueTitle('Speichern');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await expect(page.locator('kol-dialog').filter({ hasText: /Verwerfen/i })).toHaveCount(0);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(taskTitleText(page, title)).toBeVisible();
	});

	test('AK6: Rückfrage ist bei 375px vollständig sichtbar und bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openNewTaskForm(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(uniqueTitle('Mobile'));
		await page.keyboard.press('Escape');

		const confirmDialog = page.locator('kol-dialog').filter({ hasText: /Verwerfen/i });
		// Test-Pflege (Fixup PR #1600, Finding #1): der `<kol-dialog>`-Host hat wegen Shadow-DOM-`<slot>`
		// + Top-Layer-Rendering immer `{width:0,height:0}` und gilt Playwright daher unabhängig vom
		// tatsächlichen Öffnungszustand als „hidden" (Präzedenz `billing.spec.ts`/`lektorat-diff-modal.spec.ts`).
		// `toHaveCount(1)` prüft die Existenz, der rollenscoped Button-Locator die tatsächliche Sichtbarkeit.
		await expect(confirmDialog).toHaveCount(1);
		await expect(confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' })).toBeVisible();

		const continueButton = confirmDialog.getByRole('button', { name: 'Weiter bearbeiten' });
		const discardButton = confirmDialog.getByRole('button', { name: 'Verwerfen', exact: true });

		for (const button of [continueButton, discardButton]) {
			const box = await button.boundingBox();
			expect(box).toBeTruthy();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
		await expect(continueButton).toBeEnabled();
		await expect(discardButton).toBeEnabled();
	});
});
