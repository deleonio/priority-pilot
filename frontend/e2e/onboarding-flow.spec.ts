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
	// Ein frisch registriertes Konto hat das Free-Paket: ohne `ai_assist` zeigt der Flow nur den Import.
	// Die echte Antwort bleibt Basis, nur die KI-Berechtigung wird freigeschaltet (Freitext-Pfad).
	await page.route('**/auth/me', async (route: Route) => {
		const response = await route.fetch();
		const user = (await response.json()) as { entitlements?: Record<string, unknown> };
		await route.fulfill({
			response,
			json: { ...user, entitlements: { ...user.entitlements, ai_assist: { allowed: true, requiredPlan: 'pro' } } },
		});
	});
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

// Diese Spec testet den Willkommens-Dialog selbst — das Schließen per Fixture bleibt aus.
test.use({ dismissOnboarding: false });

test.describe('#2069 Erststart-Flow', () => {
	test('AK1: Flow startet automatisch im Willkommens-Dialog, Schritt 1 nur Freitext, leeres Feld endet ohne Endpunkt-Aufruf', async ({
		page,
	}) => {
		await startFreshUser(page);

		// Der Flow ersetzt den EmptyState und läuft in einem Dialog.
		await expect(flow(page)).toBeVisible();
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await expect(flow(page).locator('kol-textarea')).toBeVisible();
		await expect(flow(page).locator('kol-input-checkbox')).toHaveCount(0);

		// Leeres Feld + „Weiter“: kein Endpunkt-Aufruf, Flow endet ohne Fehler und ohne Aufgaben.
		let suggestionCalls = 0;
		await page.route('**/tasks/suggest-initial*', (route: Route) => {
			suggestionCalls += 1;
			return route.continue();
		});
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		// #2070 Test-Pflege: Der Flow bleibt im geschlossenen Dialog gemountet (Wiedereinstieg, AK4).
		await expect(flow(page)).toBeHidden();
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
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		await flow(page).getByRole('button', { name: 'Übernehmen' }).click();
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await flow(page).getByRole('button', { name: 'Weiter' }).click();

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

		// #2070: Die Abschluss-Karte hält den Flow offen — erst „Fertig“ navigiert zum Aufgaben-Tab.
		await flow(page).getByRole('button', { name: 'Fertig' }).click();

		// Die neuen Aufgaben erscheinen im Dashboard; die abgewählten nicht. Erststart B trägt eine
		// Abhängigkeit auf A und ist damit Unteraufgabe — die flache Liste zeigt sie nicht (Vertrag
		// Graph: Unteraufgaben nur dort, Muster task-graph.spec.ts); die API-Prüfung oben belegt sie.
		await expect(taskTitleText(page, 'Erststart A')).toBeVisible();
		await expect(taskTitleText(page, 'Erststart B')).toHaveCount(0);
		await expect(taskTitleText(page, 'Erststart C')).toHaveCount(0);
	});

	test.describe('375px (AK4)', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test('AK4: alle drei Schritte voll bedienbar, keine horizontale Verschiebung', async ({ page }) => {
			const pillarId = await startFreshUser(page);
			await mockSuggestions(page, pillarId);

			// Schritt 1: Fläche, Eingabe und „Weiter“ bleiben im Viewport.
			await expect(flow(page)).toBeVisible();
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

test.describe('#2070 Abschluss: Startgewichtung, Abschluss-Karte, Beispielaufgaben, Wiedereinstieg', () => {
	test('AK1: nach den Vorschlägen folgt direkt „Übernehmen“ — keine Startgewichtung', async ({ page }) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId);
		await fillFreitext(page);
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		const cards = flow(page).locator('kol-input-checkbox');
		await expect(cards).toHaveCount(5);
		await cards.nth(0).click();
		await flow(page).getByRole('button', { name: 'Weiter' }).click();

		await expect(flow(page).getByRole('button', { name: 'Speichern' })).toHaveCount(0);
		await expect(flow(page).getByRole('button', { name: 'Übernehmen' })).toBeVisible();
	});

	test('AK2: Abschluss-Karte — nächste Aufgabe abhakbar (echter Task), Balance-Hinweis, „Fertig“', async ({ page }) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId);
		await fillFreitext(page);
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		const cards = flow(page).locator('kol-input-checkbox');
		await expect(cards).toHaveCount(5);
		await cards.nth(0).click();
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		await flow(page).getByRole('button', { name: 'Übernehmen' }).click();
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await flow(page).getByRole('button', { name: 'Weiter' }).click();

		// Die Karte bleibt offen (kein sofortiger Tab-Wechsel), die Aufgabe ist direkt abhakbar.
		await expect(flow(page).getByRole('button', { name: 'Fertig' })).toBeVisible();
		const next = flow(page).locator('kol-input-checkbox', { hasText: 'Erststart A' });
		await expect(next).toBeVisible();
		const doneCall = page.waitForRequest(
			(request) => request.method() === 'PATCH' && /\/api\/v1\/tasks\/\d+$/.test(request.url()),
		);
		await next.getByRole('checkbox').click();
		// #2070 Test-Pflege: Der Client ergänzt `deadline: null` — der Status ist die Aussage.
		expect(JSON.parse((await doneCall).postData()!)).toMatchObject({ status: 'Done' });
		await expect(next.getByRole('checkbox')).toBeChecked();
		await expect(flow(page).getByText(/stärkste Säule/)).toBeVisible();

		// „Fertig“ beendet den Flow. Die abgehakte Aufgabe ist serverseitig erledigt — sie steht
		// damit nicht in der Offen-Liste (Test-Pflege: Erledigt-Prüfung über die API).
		await flow(page).getByRole('button', { name: 'Fertig' }).click();
		await waitForStableView(page);
		const doneTasks = (await (await page.request.get('/api/v1/tasks?view=done')).json()) as {
			title: string;
			status: string;
		}[];
		expect(doneTasks.map((task) => task.title)).toContain('Erststart A');
		expect(doneTasks.every((task) => task.status === 'Done')).toBe(true);
	});

	test('AK3: Abbruch ohne Eingabe — drei lokale Beispielaufgaben, keine Server-Tasks', async ({ page }) => {
		await startFreshUser(page);
		let taskWrites = 0;
		await page.route('**/api/v1/tasks**', (route: Route) => {
			if (route.request().method() !== 'GET') taskWrites += 1;
			return route.continue();
		});
		await flow(page).getByRole('button', { name: 'Später' }).click();

		const empty = page.locator('.empty-state');
		await expect(empty).toBeVisible();
		const examples = empty.locator('kol-input-checkbox');
		await expect(examples).toHaveCount(3);
		await examples.nth(0).click();
		await expect(examples.nth(0).getByRole('checkbox')).toBeChecked();
		expect(taskWrites, 'Beispielaufgaben bleiben lokal (PO-Entscheid #1986)').toBe(0);
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as unknown[];
		expect(tasks).toHaveLength(0);
	});

	test('AK4: Abbruch in Schritt 2, Wiedereinstieg über die Leerzustand-Karte — Fortschritt erhalten', async ({
		page,
	}) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId);
		await fillFreitext(page);
		await flow(page).getByRole('button', { name: 'Weiter' }).click();
		const cards = flow(page).locator('kol-input-checkbox');
		await expect(cards).toHaveCount(5);
		await cards.nth(0).click();
		await flow(page).getByRole('button', { name: 'Später' }).click();
		await expect(page.locator('.empty-state')).toBeVisible();

		await page.getByRole('button', { name: 'Flow fortsetzen' }).click();
		// Der Flow resümiert im Schritt des Abbruchs (2) — die Auswahl steht wieder, kein Datenverlust.
		await expect(flow(page)).toBeVisible();
		await expect(cards.nth(0).getByRole('checkbox')).toBeChecked();
	});

	// Spec issue-2110, AK3: Fokus-Wiedereinstieg — der verdeckt gemountete Flow feuert seinen
	// Fokus-Effekt beim Fortsetzen nicht; die Schritt-Überschrift muss den Fokus tragen.
	test('AK3: Wiedereinstieg fokussiert die Schritt-Überschrift, Freitext bleibt erhalten (issue-2110)', async ({
		page,
	}) => {
		const pillarId = await startFreshUser(page);
		await mockSuggestions(page, pillarId);
		await fillFreitext(page);
		await flow(page).getByRole('button', { name: 'Später' }).click();
		await expect(page.locator('.empty-state')).toBeVisible();

		await page.getByRole('button', { name: 'Flow fortsetzen' }).click();
		await expect(page.locator('h2.onboarding-heading')).toBeFocused();
		await expect(flow(page).locator('kol-textarea').getByRole('textbox')).toHaveValue(
			'Ich möchte wieder mehr Sport machen und geordneter leben',
		);
	});

	// #2222 AK1/AK3: „Später“ überlebt einen Reload (Spec docs/spec/issue-2222.md).
	test('AK1+AK3 (#2222): nach „Später“ und Reload bleibt der Dialog zu, „Flow fortsetzen“ startet Schritt 1', async ({
		page,
	}) => {
		await startFreshUser(page);
		await flow(page).getByRole('button', { name: 'Später' }).click();
		await expect(page.locator('.empty-state')).toBeVisible();

		await page.reload();
		await waitForStableView(page);
		await expect(page.locator('.empty-state')).toBeVisible();
		await expect(flow(page)).toBeHidden();

		await page.getByRole('button', { name: 'Flow fortsetzen' }).click();
		await expect(flow(page)).toBeVisible();
		await expect(flow(page).locator('kol-textarea').getByRole('textbox')).toBeVisible();
	});

	test.describe('375px (AK5)', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test('AK5: Abschluss-Karte und Beispielaufgaben bedienbar, nichts horizontal abgeschnitten', async ({ page }) => {
			const pillarId = await startFreshUser(page);
			await mockSuggestions(page, pillarId);

			// Beispielaufgaben: Abbruch ohne Eingabe zeigt sie im leeren Dashboard.
			await flow(page).getByRole('button', { name: 'Später' }).click();
			const examples = page.locator('.empty-state kol-input-checkbox');
			await expect(examples).toHaveCount(3);
			await waitForStableBox(page, examples.nth(0));
			await expectInViewport(examples.nth(0));

			// Abschluss-Karte: Wiedereinstieg und Durchlauf bis „Fertig“, alles im Viewport.
			await page.getByRole('button', { name: 'Flow fortsetzen' }).click();
			await fillFreitext(page);
			await flow(page).getByRole('button', { name: 'Weiter' }).click();
			const cards = flow(page).locator('kol-input-checkbox');
			await expect(cards).toHaveCount(5);
			await cards.nth(0).click();
			await flow(page).getByRole('button', { name: 'Weiter' }).click();
			await flow(page).getByRole('button', { name: 'Übernehmen' }).click();
			// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
			await flow(page).getByRole('button', { name: 'Weiter' }).click();
			await expect(flow(page).getByRole('button', { name: 'Fertig' })).toBeVisible();
			const finishTask = flow(page).locator('kol-input-checkbox').first();
			await waitForStableBox(page, finishTask);
			await expectInViewport(finishTask);
			await expectInViewport(flow(page).getByRole('button', { name: 'Fertig' }));
		});
	});
});
