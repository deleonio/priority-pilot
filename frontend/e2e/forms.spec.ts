import { expect, test } from '@playwright/test';
import type { RecordedRequest } from './helpers';
import { filledFixture } from './fixtures';
import { mockApi, mockMutations, waitForStableView } from './helpers';

/**
 * Funktionale Klick-Tests („Clicktests") für alle Formulare der App (#85). Anders als die reinen
 * Visual-Snapshots (`snapshots.spec.ts`) füllen diese Tests Felder aus, senden ab und prüfen den
 * **tatsächlich abgesetzten** Mutations-Request (Methode, Pfad, Body) sowie den Fehlerpfad
 * (Mutation → 500 → sichtbarer `KolAlert`). Die API ist vollständig gemockt (kein Backend).
 */
test.describe('Priority Pilot — Formular-Klicktests', () => {
	// Feste Zeit wie in den Snapshots, damit Deadline-Defaults/Anzeige nicht datumsabhängig driften.
	test.beforeEach(async ({ page }) => {
		await page.clock.setFixedTime(new Date('2026-07-09T12:00:00.000Z'));
	});

	/** Wartet, bis (mindestens) ein Request auf den erwarteten Endpunkt aufgezeichnet wurde. */
	const waitForRequest = async (
		requests: RecordedRequest[],
		predicate: (request: RecordedRequest) => boolean,
	): Promise<RecordedRequest> => {
		await expect.poll(() => requests.find(predicate) ?? null).not.toBeNull();
		return requests.find(predicate) as RecordedRequest;
	};

	/** Öffnet die Hauptansicht mit gemockten Lade- **und** Mutations-Endpunkten. */
	const openApp = async (page: import('@playwright/test').Page, options: { fail?: boolean } = {}) => {
		await mockApi(page, filledFixture);
		const requests = await mockMutations(page, filledFixture, options);
		await page.goto('/');
		await waitForStableView(page);
		return requests;
	};

	test('Task anlegen: füllt Titel, sendet POST /tasks und schließt den Dialog', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Titel').fill('Test-Task aus Klicktest');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		const created = await waitForRequest(requests, (r) => r.method === 'POST' && r.pathname.endsWith('/tasks'));
		expect((created.body as { title?: string }).title).toBe('Test-Task aus Klicktest');
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	});

	test('Task anlegen: „Abbrechen" schließt ohne Request', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		expect(requests).toHaveLength(0);
	});

	test('Task anlegen: Server-Fehler (500) zeigt „Speichern fehlgeschlagen"', async ({ page }) => {
		await openApp(page, { fail: true });

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Titel').fill('Schlägt fehl');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		await expect(page.getByText('Speichern fehlgeschlagen', { exact: false })).toBeVisible();
		// Der Dialog bleibt geöffnet, damit der Nutzer es erneut versuchen kann.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	});

	test('Task bearbeiten: ändert den Titel und sendet PATCH /tasks/{id}', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Titel').fill('Aktualisierter Titel');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		const patched = await waitForRequest(requests, (r) => r.method === 'PATCH' && /\/tasks\/\d+$/.test(r.pathname));
		expect((patched.body as { title?: string }).title).toBe('Aktualisierter Titel');
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();
	});

	test('Task löschen: Bestätigung sendet DELETE /tasks/{id}', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		await waitForRequest(requests, (r) => r.method === 'DELETE' && /\/tasks\/\d+$/.test(r.pathname));
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();
	});

	test('Task löschen: Server-Fehler (500) zeigt „Löschen fehlgeschlagen"', async ({ page }) => {
		await openApp(page, { fail: true });

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		await expect(page.getByText('Löschen fehlgeschlagen', { exact: false })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
	});

	test('Abhängigkeiten: Vorgänger hinzufügen sendet POST /tasks/{id}/dependencies', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten:/ })).toBeVisible();
		await waitForStableView(page);

		// Einen Vorgänger aus der Auswahl wählen (erste verfügbare Option) und mit Gewicht hinzufügen.
		await page.getByLabel('Vorgänger-Task').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		const added = await waitForRequest(
			requests,
			(r) => r.method === 'POST' && /\/tasks\/\d+\/dependencies$/.test(r.pathname),
		);
		const body = added.body as { dependingTaskId?: number; weight?: number };
		expect(typeof body.dependingTaskId).toBe('number');
		expect(body.weight).toBe(1);
	});

	test('Abhängigkeiten: Server-Fehler (500) zeigt „Aktion fehlgeschlagen"', async ({ page }) => {
		await openApp(page, { fail: true });

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('button', { name: 'Abhängigkeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten:/ })).toBeVisible();
		await waitForStableView(page);

		await page.getByLabel('Vorgänger-Task').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await expect(page.getByText('Aktion fehlgeschlagen', { exact: false })).toBeVisible();
	});

	test('Säulen-Gewichtung: Speichern sendet PUT /pillars/weights', async ({ page }) => {
		const requests = await openApp(page);

		await page.getByRole('button', { name: 'Einstellungen' }).click();
		await page.getByRole('button', { name: 'Persönliche Säulen-Verteilung' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		const saved = await waitForRequest(requests, (r) => r.method === 'PUT' && r.pathname.endsWith('/pillars/weights'));
		const weights = (saved.body as { weights?: unknown[] }).weights;
		expect(Array.isArray(weights)).toBe(true);
		expect((weights as unknown[]).length).toBe(filledFixture.pillars.length);
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden();
	});

	test('Säulen-Gewichtung: Server-Fehler (500) zeigt „Speichern fehlgeschlagen"', async ({ page }) => {
		await openApp(page, { fail: true });

		await page.getByRole('button', { name: 'Einstellungen' }).click();
		await page.getByRole('button', { name: 'Persönliche Säulen-Verteilung' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Speichern', exact: true }).click();

		await expect(page.getByText('Speichern fehlgeschlagen', { exact: false })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
	});
});
