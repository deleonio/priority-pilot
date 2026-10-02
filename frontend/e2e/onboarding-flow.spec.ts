import type { Route } from '@playwright/test';
import { expect, test, type Locator, type Page } from './fixtures';
import { registerOwnSession, taskTitleText, waitForStableBox, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2069 — Erststart-Flow Schritte 1–3 (Freitext, Vorschläge, Übernehmen).
 *
 * Vertrag (docs/spec/issue-2069.md): Nach Login ohne eigene Tasks startet statt des EmptyState
 * der 3-Schritt-Flow (`OnboardingFlow`, Root `.onboarding-flow`, kein Dialog): 1 Freitext →
 * 2 Vorschlags-Karten → 3 Übernehmen. Der Teil-1-Endpunkt `POST /tasks/suggest-initial` (#2068)
 * wird je Test per `page.route` gemockt (Antwort `{ suggestions: [{ title, pillarId, dependsOn? }] }`),
 * alles andere läuft gegen das echte Backend. Nutzer-Isolation über `registerOwnSession`
 * (echte Session, fünf Standard-Säulen, 0 Tasks).
 */

const FLOW = '.onboarding-flow';

const flow = (page: Page): Locator => page.locator(FLOW);

/**
 * Mockt den Suggester-Endpunkt mit fünf Vorschlägen; Karte 2 (`Erststart B`) verweist per
 * `dependsOn: 0` auf Karte 1. `delayMs` hält die Antwort bewusst kurz zurück, damit der
 * Ladezustand (AK2) beobachtbar wird.
 */
const mockSuggestions = async (page: Page, pillarId: number, delayMs = 0): Promise<void> => {
	await page.route('**/tasks/suggest-initial*', async (route: Route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				suggestions: [
					{ title: 'Erststart A', pillarId },
					{ title: 'Erststart B', pillarId, dependsOn: 0 },
					{ title: 'Erststart C', pillarId },
					{ title: 'Erststart D', pillarId },
					{ title: 'Erststart E', pillarId },
				],
			}),
		});
	});
};

/**
 * Legt einen frischen Nutzer mit echter Session an (fünf Standard-Säulen, 0 Tasks), lädt die App
 * und liefert die ID der ersten Säule für den Suggester-Mock.
 */
const startFreshUser = async (page: Page): Promise<number> => {
	await registerOwnSession(page, 'onboarding-2069');
	await page.unroute('**/auth/me');
	await page.goto('/app/');
	await waitForStableView(page);
	const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
	return pillars[0].id;
};

const fillFreitext = async (page: Page): Promise<void> => {
	await flow(page)
		.locator('kol-textarea')
		.getByRole('textbox')
		.fill('Ich möchte wieder mehr Sport machen und geordneter leben');
};

/** Element liegt vollständig im 375px-Viewport (Muster balance-priority.spec.ts AK5). */
const expectInViewport = async (locator: Locator): Promise<void> => {
	const box = await locator.boundingBox();
	expect(box, 'Bounding-Box muss nach dem Hydrieren vorliegen').not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
};

test.describe('#2069 Erststart-Flow', () => {
	test('AK1: Flow startet automatisch als Fläche (kein Dialog), Schritt 1 nur Freitext, leeres Feld endet ohne Endpunkt-Aufruf', async ({
		page,
	}) => {
		await startFreshUser(page);

		// Der Flow ersetzt den EmptyState — als Vollbild-Fläche, nicht als Dialog.
		await expect(flow(page)).toBeVisible();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(flow(page).locator('kol-textarea')).toBeVisible();
		await expect(flow(page).locator('kol-input-checkbox')).toHaveCount(0);

		// Leeres Feld + „Weiter“: kein Endpunkt-Aufruf, Flow endet ohne Fehler und ohne Aufgaben.
		let suggestionCalls = 0;
		await page.route('**/tasks/suggest-initial*', (route: Route) => {
			suggestionCalls += 1;
			return route.continue();
		});
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		await expect(flow(page)).toHaveCount(0);
		await expect(page.locator('.empty-state')).toBeVisible();
		expect(suggestionCalls, 'leeres Feld darf den Suggester nicht aufrufen').toBe(0);
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as unknown[];
		expect(tasks).toHaveLength(0);
	});

	test('AK2: Ladezustand mit aria-live, danach 5 einzeln umschaltbare Karten mit Säulen-Badge und „nach: …“', async ({
		page,
	}) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId, 400);
		await fillFreitext(page);

		await flow(page).getByRole('button', { name: 'Weiter' }).click();

		// Sprechender Ladezustand, solange der gemockte Endpunkt antwortet.
		await expect(flow(page).locator('[aria-live]')).toBeVisible();

		const cards = flow(page).locator('kol-input-checkbox');
		await expect(cards).toHaveCount(5);

		// Säulen-Badge (Name der echten Säule) und „nach: …“ beim abhängigen Vorschlag.
		const pillarName = (
			(await (await page.request.get('/api/v1/pillars')).json()) as { id: number; name: string }[]
		).find((pillar) => pillar.id === pillarId)!.name;
		await expect(cards.nth(0)).toContainText('Erststart A');
		await expect(cards.nth(0)).toContainText(pillarName);
		await expect(flow(page).getByText(/nach:/)).toHaveCount(1);

		// Jede Karte einzeln an- und abwählbar.
		const first = cards.nth(0);
		await first.click();
		await expect(first.getByRole('checkbox')).toBeChecked();
		await first.click();
		await expect(first.getByRole('checkbox')).not.toBeChecked();
	});

	test('AK3: „Übernehmen“ legt genau die ausgewählten Vorschläge mit Säule und Abhängigkeit an', async ({ page }) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId);
		await fillFreitext(page);

		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		const cards = flow(page).locator('kol-input-checkbox');
		await expect(cards).toHaveCount(5);

		// Genau zwei Karten ausgewählt: A (Vorgänger) und B (hängt an A) — C bis E bleiben abgewählt.
		await cards.nth(0).click();
		await cards.nth(1).click();

		const firstCreate = page.waitForRequest(
			(request) => request.method() === 'POST' && request.url().endsWith('/api/v1/tasks'),
		);
		const dependencyCall = page.waitForRequest(
			(request) => request.method() === 'POST' && /\/api\/v1\/tasks\/\d+\/dependencies$/.test(request.url()),
		);
		await flow(page).getByRole('button', { name: 'Übernehmen' }).click();

		// Der Vorgänger entsteht zuerst und mit der Säule aus dem Vorschlag.
		const created = JSON.parse((await firstCreate).postData()!) as { title: string; pillarIds: number[] };
		expect(created.title).toBe('Erststart A');
		expect(created.pillarIds).toContain(pillarId);

		// Genau zwei echte Tasks; die Abhängigkeits-Kante hängt B den Vorgänger A an.
		await waitForStableView(page);
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number; title: string }[];
		expect(tasks.map((task) => task.title).sort()).toEqual(['Erststart A', 'Erststart B']);
		const idOf = (title: string): number => tasks.find((task) => task.title === title)!.id;
		const dependency = await dependencyCall;
		expect(dependency.url()).toContain(`/api/v1/tasks/${idOf('Erststart B')}/dependencies`);
		expect(JSON.parse(dependency.postData()!)).toEqual({ dependingTaskId: idOf('Erststart A') });

		// Die neuen Aufgaben erscheinen im Dashboard; die abgewählten nicht.
		await expect(taskTitleText(page, 'Erststart A')).toBeVisible();
		await expect(taskTitleText(page, 'Erststart B')).toBeVisible();
		await expect(taskTitleText(page, 'Erststart C')).toHaveCount(0);
	});

	test.describe('375px (AK4)', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test('AK4: alle drei Schritte voll bedienbar, keine horizontale Verschiebung', async ({ page }) => {
			const pillarId = await startFreshUser(page);
			await mockSuggestions(page, pillarId);

			// Schritt 1: Fläche, Eingabe und „Weiter“ bleiben im Viewport.
			await expectInViewport(flow(page));
			await fillFreitext(page);
			const weiter = flow(page).getByRole('button', { name: 'Weiter' });
			await waitForStableBox(page, weiter);
			await expectInViewport(weiter);
			await weiter.click();

			// Schritt 2: Karten und „Weiter“ bleiben im Viewport.
			const cards = flow(page).locator('kol-input-checkbox');
			await expect(cards).toHaveCount(5);
			await waitForStableBox(page, cards.nth(0));
			await expectInViewport(cards.nth(0));
			await cards.nth(0).click();
			await waitForStableBox(page, weiter);
			await expectInViewport(weiter);
			await weiter.click();

			// Schritt 3: „Übernehmen“ bleibt im Viewport.
			const uebernehmen = flow(page).getByRole('button', { name: 'Übernehmen' });
			await expect(uebernehmen).toBeVisible();
			await waitForStableBox(page, uebernehmen);
			await expectInViewport(uebernehmen);
		});
	});
});
