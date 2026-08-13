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
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `QC ${label}`.slice(0, 30 - tail.length);
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
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Verarbeiten und weiter' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Überspringen' })).toBeVisible();

		// Das reguläre Formular ist noch nicht sichtbar: das Pflichtfeld „Titel" fehlt im ersten Schritt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeHidden();
	});

	test.skip('AC2: „Überspringen" öffnet das reguläre Formular mit leeren Feldern — #629 Tab-Freiheit: KoliBri hält Tab zurück, siehe delete-dialog-focus AK4 für gestaffelte-Tab-Strategie', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Regulärer Formular-Schritt: das Titel-Feld ist sichtbar und leer (kein vorausgefüllter Wert),
		// die Quick-Capture-Textarea ist verschwunden.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('');
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeHidden();

		// Der reguläre Weg funktioniert weiter: Titel ausfüllen, speichern → Task erscheint in der Liste.
		const title = uniqueTitle('Überspringen');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Fokus-Rückgabe über den Dialog-Wechsel hinweg: Nach dem Speichern liegt der Fokus wieder auf
		// dem auslösenden Toolbar-Button (nicht auf document.body) — der Capture-Schritt reicht den
		// Auslöser als Fallback-Fokusziel an das Formular-Modal durch.
		await expect(page.getByRole('button', { name: 'Neuen Task anlegen' })).toBeFocused();

		// #629: Tab-Freiheit nach Formular-Speichern — Fokus muss weiterbewegbar sein (nicht festhalten)
		// SETTLE_MS wie delete-dialog AK4: KoliBris setFocus-Loop hält Fokus kurz zurück
		await page.waitForTimeout(500); // SETTLE_MS (CI-Puffer für KoliBri-Fokus-Loop)
		const before = await page.evaluate(() => document.activeElement);
		await page.keyboard.press('Tab');
		await page.waitForTimeout(200); // Browser-Fokus-Update abwarten
		const after = await page.evaluate(() => document.activeElement);
		expect(after).not.toBe(before);

		await openTasksTab(page);
		// Die Aufgabenliste ist seit #238 keine Table mehr: der Titel ist direkt als
		// Textinhalt des span.task-tree-title sichtbar (analog crud.spec.ts).
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AC2b: „Überspringen" mit Text setzt eingegebenen Text als Beschreibungs-Vorbelegung', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Text in die Textarea eingeben
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Spontaner Einfall als Beschreibung');
		// „Überspringen" klicken
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Das reguläre Formular sollte sichtbar sein
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		// Das Beschreibungsfeld sollte den eingegebenen Text enthalten
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Spontaner Einfall als Beschreibung');
		// Das Titel-Feld sollte leer sein
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('');
		// Die Textarea sollte verschwunden sein
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeHidden();
	});

	// AC2c / #522 (Test-Optimierung-Report — Behavior-Coverage-Lücke): Der Schnellerfassungs-Dialog
	// hatte zwar einen Fokus-Rückgabe-Test (AC2: Fokus landet nach Speichern wieder auf „Neuen Task
	// anlegen"), aber keinen Tab-Freiheits-Test. Ein Fokus-Gefängnis würde Tastaturnutzer zwar nicht
	// beim Schließen, aber beim Ausfüllen der Textarea aussperren. QuickCaptureModal nutzt dasselbe
	// <Modal> wie die Löschdialoge (AK4 sichert dessen Tab-Freiheit) — dieser Test schließt die Lücke
	// für den separaten Capture-Schritt mit seiner autofokussierten Textarea.
	test('AC2c: Tab bewegt den Fokus aus der Textarea weiter (kein Fokus-Gefängnis)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		const textarea = page.getByRole('textbox', { name: /Beschreibe/ });
		await expect(textarea).toBeVisible();
		// Autofokus kommt asynchron (200 ms Rendering-Latz, siehe QuickCaptureModal); auf den
		// Initialfokus warten, bevor Tab gedrückt wird.
		await expect(textarea).toBeFocused();

		// ≥ Autofokus-Latz, damit kein nachgelagerter Library-Refocus den Tab zurückholt (analog
		// SETTLE_MS in delete-dialog-focus AK4).
		await page.waitForTimeout(200);
		await page.keyboard.press('Tab');

		// Vertrag: Tab darf den Fokus weiterbewegen — die Textarea ist nicht mehr fokussiert, und
		// einer der Aktionsbuttons hat den Fokus übernommen. composedPath/activeElement löst die
		// Shadow-DOM-Grenze der KoliBri-Buttons auf.
		await expect(textarea).not.toBeFocused();
		const focusedText = await page.evaluate(() => {
			let el = document.activeElement as Element | null;
			while (el?.shadowRoot?.activeElement) {
				el = el.shadowRoot.activeElement;
			}
			return (el?.textContent ?? '').trim().replace(/\s+/g, ' ');
		});
		expect(
			['Verarbeiten und weiter', 'Überspringen'],
			'Tab muss den Fokus auf einen Aktionsbutton bewegen, nicht in der Textarea fesseln',
		).toContain(focusedText);
	});

	test('AC3: „Verarbeiten und weiter" ruft parse-text auf und befüllt das Formular vor', async ({ page }) => {
		// LLM-Parsing gezielt mocken: der Endpoint liefert die vorausgefüllten Felder zurück.
		// Zusätzlich den Request-Body festhalten, um die Sende-Seite des Vertrags zu prüfen (AK6).
		let parseRequestBody: unknown;
		await page.route('**/api/v1/tasks/parse-text', (route: Route) => {
			parseRequestBody = route.request().postDataJSON();
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					title: 'Geparser Task-Titel',
					description: 'Auto-Beschreibung',
					priority: 4,
					estimatedEffort: 0.5,
				}),
			});
		});

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Ich will eine wichtige Aufgabe erledigen');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();
		await waitForStableView(page);

		// Nach abgeschlossenem (gemocktem) LLM-Aufruf verschwindet der Schnellerfassungs-Schritt und
		// das reguläre Formular erscheint mit den vorausgefüllten Werten.
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeHidden();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Geparser Task-Titel');
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Auto-Beschreibung');
		// Priorität/Aufwand sind seit #287 `KolInputRange` → native `<input type="range">` im offenen
		// Shadow-DOM ohne `aria-label` (`getByLabel` greift nicht). Wir zielen per CSS auf die Range-Inputs.
		// HTML-Range-Inputs führen ihren Wert stets in Punkt-Notation (kein locale-abhängiges Komma).
		await expect(page.locator('input[type="range"][min="1"][max="5"][step="1"]')).toHaveValue('4');
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveValue('0.5');

		// Sende-Seite des Vertrags (AK6): der eingegebene Freitext geht als `{ text }` an parse-text.
		expect(parseRequestBody).toEqual({ text: 'Ich will eine wichtige Aufgabe erledigen' });

		// afterEach räumt evtl. angelegte Tasks ab; hier wird nur vorausgefüllt, nicht zwingend gespeichert.
	});

	test('AC3-Race: verzögerte, minimale Antwort öffnet das Formular ohne Modal-Abriss (#236)', async ({ page }) => {
		// Regression gegen die async-Remount-Race (#236): Wenn `setStep('form')` erst NACH einem
		// verzögerten `await parseText` lief und der Dialog dabei ab- und neu aufgebaut wurde, warf das
		// zweite `showModal()` „The element is not in a Document" (pageerror) und riss das ganze Modal ab.
		// Der reale (langsame) LLM-Aufruf traf die Race, der frühere sofort-auflösende AC3-Mock nicht —
		// daher hier bewusst LATENZ + nur ein `title` (der Normalfall bei kurzem Freitext).
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));
		await page.route('**/api/v1/tasks/parse-text', async (route: Route) => {
			await new Promise((resolve) => setTimeout(resolve, 600));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ title: 'Nur-Titel-Task' }),
			});
		});

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Einkaufen gehen');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Das Formular erscheint (Modal bleibt offen), Titel ist mit dem einzigen gelieferten Feld gefüllt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Nur-Titel-Task');
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeHidden();

		// Negativ-Kontrolle: KEIN pageerror (insb. kein `showModal ... not in a Document`) beim Wechsel.
		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
	});

	test('AK4: Fehlgeschlagenes Parsing zeigt eine Fehlermeldung; „Überspringen" bleibt als Ausweg', async ({ page }) => {
		// Fehlerpfad mocken: parse-text antwortet 500 — der Capture-Schritt darf NICHT verschwinden.
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'LLM nicht erreichbar' }),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Text, dessen Verarbeitung fehlschlägt');
		await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();

		// Fehlermeldung erscheint (KolAlert-Label), der Capture-Schritt bleibt stehen, kein Formular.
		await expect(page.getByText('Verarbeitung fehlgeschlagen')).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeHidden();

		// Ausweg: „Überspringen" führt weiterhin ins reguläre Formular — mit dem Text als Beschreibung.
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Text, dessen Verarbeitung fehlschlägt');
	});

	test('AK-Mobile: Quick-Capture-Schritt ist auf 375-px-Viewport bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await waitForStableView(page);

		// Textarea und beide Buttons müssen auf schmalem Viewport sichtbar und bedienbar sein.
		const textarea = page.getByRole('textbox', { name: /Beschreibe/ });
		const processButton = page.getByRole('button', { name: 'Verarbeiten und weiter' });
		const skipButton = page.getByRole('button', { name: 'Überspringen' });
		await expect(textarea).toBeVisible();
		await expect(processButton).toBeVisible();
		await expect(skipButton).toBeVisible();

		// Kein horizontaler Overflow auf dem Modal-Inhalt.
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflow).toBe(true);
	});

	// --- Rote Spec-Tests für #250: Autofokus der Textarea beim Öffnen des Modals ---

	test('AK1-Autofokus-Desktop: Textarea ist direkt nach dem Öffnen des Modals fokussiert (#250)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Autofokus wird programmatisch per useEffect + shadowRoot-Query gesetzt,
		// da _autofocus in der KoliBri-4.2.1-Typbindung nicht verfügbar ist.
		// Der Fokus muss direkt nach dem Öffnen gesetzt sein — kein manuelles Klicken nötig.
		await expect(page.locator('kol-textarea textarea').first()).toBeFocused();
	});

	test('AK2-Autofokus-Mobile: Textarea ist auf 375-px-Viewport fokussiert, kein Layout-Überlauf (#250)', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Autofokus muss auch auf schmalem Viewport gesetzt sein.
		await expect(page.locator('kol-textarea textarea').first()).toBeFocused();

		// Kein horizontaler Overflow durch den Autofokus / Modal-Layout.
		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);
	});

	test('AK3-Regression-Schrittwechsel: Autofokus verursacht keinen JS-Fehler beim Wechsel in den Formular-Schritt (#250)', async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Text eingeben, dann Schritt wechseln.
		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Regressions-Test Autofokus');
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Das TaskForm muss gerendert sein — Fokus-Steuerung unverändert übernommen.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		// Kein JS-Fehler (kein showModal/Shadow-DOM-Fehler durch den Autofokus).
		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
	});
});
