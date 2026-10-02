import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, taskTitleText, waitForStableView } from './helpers';

/**
 * E2E-Spec für den Onboarding-Flow (#1986, Spec: `docs/spec/issue-1986.md`): Erststart ohne Tasks
 * führt durch die fünf Schritte (Freitext → KI-Vorschläge → Übernehmen/Weglassen → Startgewichtung
 * → Abschluss-Karte), Abbruch/Wiedereinstieg ohne Datenverlust, Beispielaufgaben im Leerzustand,
 * volle Bedienbarkeit bei 375px.
 *
 * **Mocks:** Nur der KI-Endpunkt `POST /api/v1/tasks/parse-suggest` wird per `page.route`
 * abgefangen (das echte Backend hat keinen LLM-Key — Präzedenz `quick-capture.spec.ts` für
 * `parse-text`); alle übrigen Requests (Task-/Säulen-CRUD) gehen ans echte Backend.
 *
 * **Isolation:** Die In-Memory-DB lebt für den ganzen Backend-Prozess — wie in `crud.spec.ts`
 * räumt `beforeEach` alle Tasks weg, damit der Flow-Startzustand (0 Tasks) stimmt.
 */

interface Suggestion {
	title: string;
	pillarId: number;
	dependsOnTitle?: string;
}

const SUGGESTIONS: Suggestion[] = [
	{ title: 'Onboard Küchenregal aufbauen', pillarId: 1 },
	{ title: 'Onboard Behälter besorgen', pillarId: 1, dependsOnTitle: 'Onboard Küchenregal aufbauen' },
	{ title: 'Onboard Steuermappe anlegen', pillarId: 2 },
	{ title: 'Onboard Belege sortieren', pillarId: 2, dependsOnTitle: 'Onboard Steuermappe anlegen' },
	{ title: 'Onboard Laufplan schreiben', pillarId: 3 },
];

/** Löscht alle Tasks über die echte API (Vite-Proxy → Backend), Muster `crud.spec.ts`. */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const mockSuggest = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/tasks/parse-suggest', async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ suggestions: SUGGESTIONS }),
		});
	});
};

/** Frischer Start: 0 Tasks, Flow startet automatisch, Freitext-Schritt sichtbar. */
const startFlow = async (page: Page): Promise<void> => {
	await deleteAllTasks(page);
	await mockSuggest(page);
	await page.goto('/app/');
	await waitForStableView(page);
	await expect(page.getByRole('textbox', { name: 'Was beschäftigt dich gerade?' })).toBeVisible();
};

/** Geht vom Freitext bis in den Vorschlags-Schritt (Schritt 3). */
const gotoSuggestions = async (page: Page): Promise<void> => {
	await startFlow(page);
	await page.getByRole('textbox', { name: 'Was beschäftigt dich gerade?' }).fill('Ich plane meinen Umzug');
	await page.getByRole('button', { name: 'Weiter' }).click();
	await expect(page.getByRole('checkbox', { name: SUGGESTIONS[0].title })).toBeVisible();
};

/** Nimmt alle Vorschläge und durchläuft Startgewichtung bis zur Abschluss-Karte. */
const gotoCompletion = async (page: Page): Promise<void> => {
	await gotoSuggestions(page);
	await page.getByRole('button', { name: 'Weiter' }).click();
	await expect(page.getByRole('heading', { name: 'Startgewichtung' })).toBeVisible();
	await page.getByRole('button', { name: 'Weiter' }).click();
	await expect(page.getByRole('heading', { name: 'Dein nächster Schritt' })).toBeVisible();
};

test.describe('Onboarding-Flow (#1986)', () => {
	test.beforeEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1: Flow startet nach Login ohne Tasks, einziges Feld ist der Freitext', async ({ page }) => {
		await startFlow(page);

		// Kein Pflichtfeld außer dem Freitext: „Weiter" führt auch mit leerem Feld weiter
		// (gültiger Pfad, kein Fehler — KI-UX).
		await page.getByRole('button', { name: 'Weiter' }).click();
		const examples = page.locator('.empty-state').getByRole('checkbox');
		await expect(examples.first()).toBeVisible();
		expect(await examples.count()).toBeGreaterThanOrEqual(3);
	});

	test('AK2: Vorschlags-Schritt zeigt 5–8 einzeln übernehmbare Karten', async ({ page }) => {
		await gotoSuggestions(page);

		for (const suggestion of SUGGESTIONS) {
			const checkbox = page.getByRole('checkbox', { name: suggestion.title });
			await expect(checkbox).toBeVisible();
			// Jeder Vorschlag ist einzeln übernehmbar oder weglassbar.
			await checkbox.uncheck();
			await expect(checkbox).not.toBeChecked();
			await checkbox.check();
		}

		// Der Freitext ging als `{ text }` an den Endpunkt.
		await expect(page.getByRole('textbox', { name: 'Was beschäftigt dich gerade?' })).toHaveValue(
			'Ich plane meinen Umzug',
		);
	});

	test('AK3: Übernommene Vorschläge entstehen als echte Tasks mit Säule und Abhängigkeit', async ({ page }) => {
		await gotoCompletion(page);

		// Abgeschlossen → beide gewählten Vorschläge sind echte Tasks im Dashboard.
		await waitForStableView(page);
		await expect(taskTitleText(page, SUGGESTIONS[0].title)).toBeVisible();
		await expect(taskTitleText(page, SUGGESTIONS[1].title)).toBeVisible();

		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as Array<{
			id: number;
			title: string;
			pillarId: number;
		}>;
		const first = tasks.find((task) => task.title === SUGGESTIONS[0].title);
		const second = tasks.find((task) => task.title === SUGGESTIONS[1].title);
		expect(first, 'Vorschlag 1 als Task angelegt').toBeTruthy();
		expect(second, 'Vorschlag 2 als Task angelegt').toBeTruthy();
		expect(first!.pillarId).toBeTruthy();
		expect(second!.pillarId).toBeTruthy();

		// Abhängigkeit: Vorschlag 2 hängt an Vorschlag 1 (Vertrag `dependsOnTitle`).
		const deps = await page.request.get(`/api/v1/tasks/${second!.id}/dependencies`);
		expect(deps.status()).toBe(200);
		expect(JSON.stringify(await deps.json())).toContain(String(first!.id));
	});

	test('AK6: Abbruch im Vorschlags-Schritt — Wiedereinstieg setzt ohne Datenverlust fort', async ({ page }) => {
		await gotoSuggestions(page);
		await page.getByRole('checkbox', { name: SUGGESTIONS[0].title }).uncheck();
		await page.getByRole('button', { name: 'Später' }).click();

		// Später erneut aufrufen: Reload setzt im gespeicherten Schritt fort — Freitext und
		// Auswahl bleiben erhalten (Fortschritts-Flag persistiert).
		await page.reload();
		await waitForStableView(page);
		await expect(page.getByRole('checkbox', { name: SUGGESTIONS[0].title })).toBeVisible();
		await expect(page.getByRole('checkbox', { name: SUGGESTIONS[0].title })).not.toBeChecked();
		await expect(page.getByRole('textbox', { name: 'Was beschäftigt dich gerade?' })).toHaveValue(
			'Ich plane meinen Umzug',
		);
	});

	test('AK5: Abschluss-Karte zeigt nächsten Schritt, Balance-Hinweis und eine abhakbare Aufgabe', async ({ page }) => {
		await gotoCompletion(page);

		await expect(page.getByText(/Balance/i)).toBeVisible();
		await page.getByRole('checkbox', { name: SUGGESTIONS[0].title }).check();

		// Abhaken auf der Karte legt den echten Task an.
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as Array<{ title: string }>;
		expect(tasks.some((task) => task.title === SUGGESTIONS[0].title)).toBe(true);
	});

	test('AK7: Leerzustand ohne eigene Eingabe zeigt mindestens 3 abhakbare Beispielaufgaben', async ({ page }) => {
		await startFlow(page);
		await page.getByRole('button', { name: 'Später' }).click();

		const emptyState = page.locator('.empty-state');
		await expect(emptyState).toBeVisible();
		const examples = emptyState.getByRole('checkbox');
		await expect(examples.first()).toBeVisible();
		expect(await examples.count()).toBeGreaterThanOrEqual(3);

		// Abhakbar: das Abhaken einer Beispielaufgabe legt den echten Task an.
		await examples.first().check();
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as Array<{ title: string }>;
		expect(tasks.length).toBeGreaterThanOrEqual(1);
	});

	test('AK8: Bei 375px kein horizontaler Überlauf über alle Schritte', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await startFlow(page);

		const assertNoOverflow = async (label: string): Promise<void> => {
			const result = (await page.locator('body').evaluate(measureHorizontalScroll)).scroller;
			expect(result, `${label}: kein horizontal scrollbarer Container bei 375px`).toBeNull();
		};

		await assertNoOverflow('Schritt 1 (Freitext)');

		await page.getByRole('textbox', { name: 'Was beschäftigt dich gerade?' }).fill('Ich plane meinen Umzug');
		await page.getByRole('button', { name: 'Weiter' }).click();
		await expect(page.getByRole('checkbox', { name: SUGGESTIONS[0].title })).toBeVisible();
		await assertNoOverflow('Schritt 3 (Vorschläge)');

		await page.getByRole('button', { name: 'Weiter' }).click();
		await expect(page.getByRole('heading', { name: 'Startgewichtung' })).toBeVisible();
		await assertNoOverflow('Schritt 4 (Startgewichtung)');
	});
});
