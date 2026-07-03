import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #236 — „Frontend: Schnellerfassungs-UI für Tasks (Textarea + LLM-Vorausfüllung)".
 *
 * Vertrag: Beim Klick auf „Neuen Task anlegen" erscheint zuerst ein Schnellerfassungs-Schritt (Modal
 * mit einer Textarea „Beschreibe deinen Task"). Von dort führen zwei Wege zum regulären TaskFormModal:
 *  - „Verarbeiten und weiter" ruft `POST /api/v1/tasks/parse-text` auf und füllt das Formular vor,
 *  - „Überspringen" öffnet direkt das leere Formular (ohne LLM-Aufruf).
 *
 * Die UI-Komponente folgt durch die Umsetzung; bis dahin ist diese Spec rot. Der Modal-Heading bleibt
 * über beide Schritte hinweg „Neuen Task anlegen" (der Anlege-Kontext).
 *
 * **Mocks:** AC3 fängt `POST /api/v1/tasks/parse-text` gezielt per `page.route` ab (kein echtes LLM im
 * Test). Die spätere Registrierung gewinnt gegenüber dem `/auth/me`-Mock der Fixture — und da wir nur
 * `**\/api/v1/tasks/parse-text` abfangen, gehen alle übrigen Requests (Anlegen/Löschen von Tasks)
 * unverändert an das echte Backend.
 *
 * **Isolation:** AC2 und AC3 legen einen Task an; `afterEach` räumt alle Tasks über die echte API ab,
 * damit jeder Test von einem leeren Zustand startet (analog `crud.spec.ts`).
 */
test.describe('Schnellerfassungs-UI für Tasks (#236)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `QC ${label} #${(runId += 1)}-${Date.now()}`;

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

	test('AC1: Schnellerfassungs-Textarea erscheint als erster Schritt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		// Der Modal-Heading bleibt auch im Quick-Capture-Schritt „Neuen Task anlegen".
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Erster Schritt: Freitext-Textarea (Label enthält „Beschreibe") plus die beiden Aktionen.
		await expect(page.getByLabel(/Beschreibe/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Verarbeiten und weiter' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Überspringen' })).toBeVisible();

		// Das reguläre Formular ist noch nicht sichtbar: das Pflichtfeld „Titel" fehlt im ersten Schritt.
		await expect(page.getByLabel('Titel')).toBeHidden();
	});

	test('AC2: „Überspringen" öffnet das reguläre Formular mit leeren Feldern', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Regulärer Formular-Schritt: das Titel-Feld ist sichtbar und leer (kein vorausgefüllter Wert),
		// die Quick-Capture-Textarea ist verschwunden.
		await expect(page.getByLabel('Titel')).toBeVisible();
		await expect(page.getByLabel('Titel')).toHaveValue('');
		await expect(page.getByLabel(/Beschreibe/)).toBeHidden();

		// Der reguläre Weg funktioniert weiter: Titel ausfüllen, speichern → Task erscheint in der Liste.
		const title = uniqueTitle('Überspringen');
		await page.getByLabel('Titel').fill(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		await openTasksTab(page);
		await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();
	});

	test('AC2b: „Überspringen" mit Text setzt eingegebenen Text als Beschreibungs-Vorbelegung', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Text in die Textarea eingeben
		await page.getByLabel(/Beschreibe/).fill('Spontaner Einfall als Beschreibung');
		// „Überspringen" klicken
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Das reguläre Formular sollte sichtbar sein
		await expect(page.getByLabel('Titel')).toBeVisible();
		// Das Beschreibungsfeld sollte den eingegebenen Text enthalten
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Spontaner Einfall als Beschreibung');
		// Das Titel-Feld sollte leer sein
		await expect(page.getByLabel('Titel')).toHaveValue('');
		// Die Textarea sollte verschwunden sein
		await expect(page.getByLabel(/Beschreibe/)).toBeHidden();
	});

	test('AC3: „Verarbeiten und weiter" ruft parse-text auf und befüllt das Formular vor', async ({ page }) => {
		// LLM-Parsing gezielt mocken: der Endpoint liefert die vorausgefüllten Felder zurück.
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					title: 'Geparser Task-Titel',
					description: 'Auto-Beschreibung',
					priority: 4,
					estimatedEffort: 0.5,
				}),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel(/Beschreibe/).fill('Ich will eine wichtige Aufgabe erledigen');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();
		await waitForStableView(page);

		// Nach abgeschlossenem (gemocktem) LLM-Aufruf verschwindet der Schnellerfassungs-Schritt und
		// das reguläre Formular erscheint mit den vorausgefüllten Werten.
		await expect(page.getByLabel(/Beschreibe/)).toBeHidden();
		await expect(page.getByLabel('Titel')).toHaveValue('Geparser Task-Titel');
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Auto-Beschreibung');
		await expect(page.getByLabel('Priorität (Ganzzahl 1–5)')).toHaveValue('4');

		// afterEach räumt evtl. angelegte Tasks ab; hier wird nur vorausgefüllt, nicht zwingend gespeichert.
	});

	test('AK-Mobile: Quick-Capture-Schritt ist auf 375-px-Viewport bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await waitForStableView(page);

		// Textarea und beide Buttons müssen auf schmalem Viewport sichtbar und bedienbar sein.
		const textarea = page.getByLabel(/Beschreibe/);
		const processButton = page.getByRole('button', { name: 'Verarbeiten und weiter' });
		const skipButton = page.getByRole('button', { name: 'Überspringen' });
		await expect(textarea).toBeVisible();
		await expect(processButton).toBeVisible();
		await expect(skipButton).toBeVisible();

		// Kein horizontaler Overflow auf dem Modal-Inhalt.
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflow).toBe(true);
	});
});
