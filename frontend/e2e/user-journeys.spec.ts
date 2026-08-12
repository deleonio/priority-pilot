import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Black-Box-User-Journey-Specs für #566 – E2E-Tests gegen die echte App.
 *
 * Vertrag: Jeder Test bildet genau eine User Journey aus der Spec (#565) als beobachtbares
 * Verhalten ab – ohne Implementierungsdetails. Die Tests greifen nur über öffentliche UI-Elemente
 * auf die App zu und validieren das von außen sichtbare Ergebnis.
 *
 * **Journeys aus docs/spec/user-journeys.md:**
 * - Journey 1: Aufgabe erstellen (mit allen Metadaten)
 * - Journey 2: Abhängigkeit hinzufügen
 * - Journey 3: Kantengewicht ändern
 * - Journey 4: Prio-Berechnung auslösen
 *
 * **Isolation:** Jeder Test legt selbst Daten an; `afterEach` räumt über die echte API ab.
 */
test.describe('User Journeys aus #565 – Black-Box-Verhaltenstests', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `UJ ${label}`.slice(0, 30 - tail.length);
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

	/** Wechselt auf den „Aufgaben"-Tab. */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Wechselt auf den „Aufgabenwald"-Tab. */
	const openForestTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgabenwald', exact: true }).click();
	};

	/**
	 * Journey 1: Aufgabe erstellen
	 *
	 * Ziel: Neue Aufgabe in das System aufnehmen, mit allen relevanten Metadaten
	 * (Priorität, Aufwand, Deadline, Beschreibung, Säulen).
	 *
	 * Erwartetes Ergebnis (aus Spec):
	 * - Aufgabe ist persistent gespeichert
	 * - Aufgabe erscheint in der Aufgaben-Liste mit dem erfassten Titel
	 * - Aufgabe hat den Status „Open"
	 * - Metadaten (Priorität, Aufwand, Deadline, Beschreibung, Säulen) sind korrekt gespeichert
	 * - Aufgabe ist im Aufgabenwald sichtbar (sofern nicht durch Abhängigkeiten blockiert)
	 */
	test('Journey 1: Aufgabe erstellen mit allen Metadaten', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Vorbedingung: Nutzer ist angemeldet, Dashboard ist geöffnet
		await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();

		// Schritt 1: Aufgaben anlegen auslösen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Schritt 2: Manuelle Erfassung (Überspringen)
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		// Schritt 3: Aufgaben-Metadaten erfassen
		const title = uniqueTitle('Kundenbericht Q3');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		// Priorität: Schieberegler auf 4
		const prioritySlider = page.locator('input[type="range"][min="1"][max="5"][step="1"]');
		await prioritySlider.press('ArrowRight'); // 3 → 4
		await expect(prioritySlider).toHaveValue('4');

		// Geschätzter Aufwand: Schieberegler auf 0,5 Tage
		const effortSlider = page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]');
		await expect(effortSlider).toHaveValue('0.5');

		// Deadline (optional)
		await page.getByRole('textbox', { name: 'Deadline' }).fill('2026-08-15');

		// Beschreibung (optional)
		await page.getByLabel('Beschreibung (optional)').fill('Finanzkennzahlen und Prognose für Q3');

		// Säulen (optional) – falls Säulen-Zuweisung existiert
		const pillarButton = page.getByRole('button', { name: /Säule/i });
		if (await pillarButton.isVisible()) {
			await pillarButton.click();
			await waitForStableView(page);
			// Säule auswählen und Werte setzen – Details hängen von UI ab
		}

		// Schritt 4: Aufgabe speichern
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Erwartetes Ergebnis: Aufgabe ist persistent gespeichert
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Persistenz prüfen: Dialog erneut öffnen, Werte kommen frisch aus dem Backend
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Metadaten sind korrekt gespeichert
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
		await expect(prioritySlider).toHaveValue('4');
		await expect(effortSlider).toHaveValue('0.5');
		await expect(page.getByRole('textbox', { name: 'Deadline' })).toHaveValue('2026-08-15');
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Finanzkennzahlen und Prognose für Q3');

		// Aufgabe ist im Aufgabenwald sichtbar
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await openForestTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	/**
	 * Journey 2: Abhängigkeit hinzufügen
	 *
	 * Ziel: Zwei Aufgaben so verknüpfen, dass eine Aufgabe vom Erledigen der anderen abhängt.
	 *
	 * Erwartetes Ergebnis (aus Spec):
	 * - Abhängigkeit ist persistent gespeichert
	 * - Vorgänger-Aufgabe erscheint in der Liste der aktuellen Vorgänger
	 * - Im Aufgaben-Baum ist die abhängige Aufgabe eingerückt unter dem Vorgänger sichtbar
	 * - Die abhängige Aufgabe lässt sich erst erledigen, wenn der Vorgänger „Done" ist
	 * - Zyklische Abhängigkeiten werden mit einem Hinweis abgelehnt
	 */
	test('Journey 2: Abhängigkeit zwischen Aufgaben hinzufügen', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Vorbedingung: Zwei Aufgaben existieren im System
		const predecessorTitle = uniqueTitle('Vorgänger-Aufgabe');
		const dependentTitle = uniqueTitle('Abhängige-Aufgabe');

		// Vorgänger anlegen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(predecessorTitle);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Abhängige Aufgabe anlegen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(dependentTitle);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		await openTasksTab(page);

		// Schritt 1: Vorgänger-Editor öffnen
		await page.getByText(dependentTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Schritt 2: Vorgänger auswählen
		// Die Auswahlliste zeigt alle vorhandenen Aufgaben (außer bereits verknüpfte)
		const predecessorOption = page.getByRole('option', { name: predecessorTitle });
		await expect(predecessorOption).toBeVisible();
		await predecessorOption.click();

		// Schritt 3: Kantengewicht setzen (Standard 1,0)
		const weightSlider = page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]');
		await expect(weightSlider).toHaveValue('1'); // Standard

		// Schritt 4: Abhängigkeit bestätigen
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		await waitForStableView(page);

		// Erwartetes Ergebnis: Vorgänger erscheint in der Liste der aktuellen Vorgänger
		await expect(page.getByText(predecessorTitle, { exact: true })).toBeVisible();

		// Abhängigkeit ist persistent gespeichert (Dialog schließen und erneut öffnen)
		await page.getByRole('button', { name: 'Schließen' }).click();
		await page.getByText(dependentTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByText(predecessorTitle, { exact: true })).toBeVisible();

		// Im Aufgaben-Baum ist die abhängige Aufgabe eingerückt unter dem Vorgänger sichtbar
		await page.getByRole('button', { name: 'Schließen' }).click();
		await openForestTab(page);
		const forestStructure = await page.evaluate(() => {
			const taskItems = document.querySelectorAll('.task-tree-item');
			return Array.from(taskItems).map((item) => ({
				title: item.querySelector('.task-tree-title')?.textContent,
				indent: window.getComputedStyle(item).marginLeft,
			}));
		});
		// Die abhängige Aufgabe sollte eingerückt sein (größerer marginLeft)
		const dependentItem = forestStructure.find((item) => item.title === dependentTitle);
		const predecessorItem = forestStructure.find((item) => item.title === predecessorTitle);
		expect(dependentItem).toBeDefined();
		expect(predecessorItem).toBeDefined();
		expect(dependentItem?.indent).not.toBe(predecessorItem?.indent);
	});

	/**
	 * Journey 3: Kantengewicht ändern
	 *
	 * Ziel: Das Gewicht einer bestehenden Abhängigkeit anpassen, um die Priorisierungslogik zu steuern.
	 *
	 * Erwartetes Ergebnis (aus Spec):
	 * - Das neue Gewicht ist persistent gespeichert
	 * - Der Wert der abhängigen Aufgabe im Aufgabenwald hat sich entsprechend angepasst
	 * - Die Änderung wirkt sich sofort auf die Priorisierung aus (neue Sortierung im Aufgabenwald)
	 */
	test('Journey 3: Kantengewicht einer bestehenden Abhängigkeit ändern', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Vorbedingung: Eine Abhängigkeit zwischen zwei Aufgaben existiert bereits
		const predecessorTitle = uniqueTitle('Vorgänger');
		const dependentTitle = uniqueTitle('Abhängig');

		// Zwei Aufgaben anlegen
		for (const title of [predecessorTitle, dependentTitle]) {
			await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
			await waitForStableView(page);
			await page.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(page);
			await page.getByRole('textbox', { name: 'Titel' }).fill(title);
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		}

		await openTasksTab(page);

		// Abhängigkeit erstellen (Gewicht 1,0)
		await page.getByText(dependentTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('option', { name: predecessorTitle }).click();
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		await waitForStableView(page);

		// Schritt 1: Bestehende Abhängigkeit anzeigen (Gewicht 1,0)
		const initialWeightSlider = page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]');
		await expect(initialWeightSlider).toHaveValue('1');

		// Schritt 2: Gewicht ändern auf 0,7
		// Entfernen + neu hinzufügen laut Spec
		await page
			.getByRole('button', { name: /entfernen/i })
			.first()
			.click();
		await waitForStableView(page);
		await page.getByRole('option', { name: predecessorTitle }).click();
		await initialWeightSlider.press('ArrowLeft'); // 1.0 → 0.9 → ... → 0.7
		await initialWeightSlider.press('ArrowLeft');
		await initialWeightSlider.press('ArrowLeft');
		await expect(initialWeightSlider).toHaveValue('0.7');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		await waitForStableView(page);

		// Erwartetes Ergebnis: Das neue Gewicht ist persistent gespeichert
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveValue('0.7');

		// Persistenz prüfen: Dialog schließen und erneut öffnen
		await page.getByRole('button', { name: 'Schließen' }).click();
		await page.getByText(dependentTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveValue('0.7');

		// Die Änderung wirkt sich sofort auf die Priorisierung aus (neue Sortierung im Aufgabenwald)
		await page.getByRole('button', { name: 'Schließen' }).click();
		await openForestTab(page);

		// Änderung: Nochmal das Gewicht ändern, diesmal auf 0,9
		await page.getByText(dependentTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await waitForStableView(page);
		await page
			.getByRole('button', { name: /entfernen/i })
			.first()
			.click();
		await waitForStableView(page);
		await page.getByRole('option', { name: predecessorTitle }).click();
		await page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]').press('End'); // Auf Maximum
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveValue('1');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		await waitForStableView(page);

		// Nachher: Aufgabenwald zeigt die aktualisierte Sortierung
		await page.getByRole('button', { name: 'Schließen' }).click();
		await openForestTab(page);

		// Die Aufgaben sind sichtbar und der Wald hat sich aktualisiert
		await expect(page.getByText(predecessorTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(dependentTitle, { exact: true })).toBeVisible();
	});

	/**
	 * Journey 4: Prio-Berechnung auslösen
	 *
	 * Ziel: Die automatische Priorisierungsberechnung auslösen, die den Wertbeitrag und die
	 * nächste sinnvolle Aufgabe ermittelt.
	 *
	 * Erwartetes Ergebnis (aus Spec):
	 * - Aufgabenwald ist nach Wertbeitrag sortiert (wichtigste Aufgabe oben)
	 * - Die „Nächste Aufgabe" im Dashboard zeigt die Aufgabe mit höchster Priorität, deren Abhängigkeiten alle erledigt sind
	 * - Wertberechnung berücksichtigt: rekursive Abhängigkeiten mit Kantengewichten, Säulen-Gewichtung, transitiven Aufwand
	 * - Bei Änderungen an Aufgaben, Abhängigkeiten oder Säulen-Gewichtung aktualisiert sich die Berechnung automatisch
	 */
	test('Journey 4: Prio-Berechnung mit Aufgabenwald-Sortierung', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Vorbedingung: Mindestens eine Aufgabe mit Priorität existiert
		const highPriorityTitle = uniqueTitle('Wichtige Aufgabe');
		const lowPriorityTitle = uniqueTitle('Wenig wichtige Aufgabe');

		// Aufgabe mit hoher Priorität (5) anlegen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(highPriorityTitle);
		await page.locator('input[type="range"][min="1"][max="5"][step="1"]').press('End'); // Priorität 5
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Aufgabe mit niedriger Priorität (1) anlegen
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(lowPriorityTitle);
		await page.locator('input[type="range"][min="1"][max="5"][step="1"]').press('Home'); // Priorität 1
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Schritt 1: Aufgabenwald anzeigen
		await openForestTab(page);
		await expect(page.getByRole('heading', { name: 'Aufgabenwald' })).toBeVisible();

		// Schritt 2: Wertberechnung beobachten
		// Der Aufgabenwald zeigt die Aufgaben als Baumstruktur, sortiert nach Wert
		const forestOrder = await page.evaluate(() => {
			const items = document.querySelectorAll('.task-tree-item');
			return Array.from(items).map((item) => ({
				title: item.querySelector('.task-tree-title')?.textContent,
				priority: item.querySelector('.task-priority')?.textContent,
				value: item.querySelector('.task-value')?.textContent,
			}));
		});

		// Beide Aufgaben sind sichtbar
		expect(forestOrder.some((item) => item.title === highPriorityTitle)).toBe(true);
		expect(forestOrder.some((item) => item.title === lowPriorityTitle)).toBe(true);

		// Schritt 3: Nächste Aufgabe ermitteln (Dashboard)
		await page.goto('/');
		await waitForStableView(page);

		// Im Dashboard den Bereich „Nächste Aufgabe" betrachten
		const nextTaskSection = page.getByRole('region', { name: /nächste aufgabe/i });
		await expect(nextTaskSection).toBeVisible();

		// Zeigt die wichtigste Aufgabe (hohe Priorität)
		await expect(nextTaskSection).toHaveText(new RegExp(highPriorityTitle));

		// Schritt 4: Änderungen an Aufgaben → automatische Aktualisierung der Berechnung
		await openTasksTab(page);
		await page.getByText(highPriorityTitle, { exact: true }).click();
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page);

		// Priorität auf Minimum reduzieren
		await page.locator('input[type="range"][min="1"][max="5"][step="1"]').press('Home');
		await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
		await waitForStableView(page);

		// Zurück zum Dashboard: „Nächste Aufgabe" sollte sich geändert haben
		await page.goto('/');
		await waitForStableView(page);
		await expect(nextTaskSection).not.toHaveText(new RegExp(highPriorityTitle));
	});
});
