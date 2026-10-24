import { expect, test, type Page } from './fixtures';
import { registerOwnSession } from './helpers';

/**
 * Rote End-to-End-Spec für #2938 — Aufgaben-Ansicht `/aufgaben/<id>` (Schnitt-Teil 1).
 * Vertrag: docs/spec/issue-2938.md. Läuft gegen das echte Backend (In-Memory-DB).
 * Rot, bis App.tsx die Route `/aufgaben/<id>` auf die neue TaskView-Leseseite schaltet
 * (bis dahin rendert der unbekannte Pfad das Dashboard).
 */

const createViewTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: {
			title,
			description: 'Erste Zeile\nZweite Zeile',
			priority: 4,
			estimatedEffort: 0.75,
			// Voll ISO (toRawDeadline): formatDeadline zeigt UTC → fest „15.01.2030".
			deadline: '2030-01-15T12:00:00.000Z',
		},
	});
	expect(response.ok(), 'Setup: Task-Anlage muss 2xx liefern').toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

test.describe('Balamentum — Aufgaben-Ansicht #2938', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `${`E2E #2938 ${label}`.slice(0, 30 - tail.length)}${tail}`;
	};

	// AK1/TF1: Leseseite mit Kopf (h1 + Prioritäts-Badge), Kernzeile (Fälligkeit relativ und
	// absolut, Aufwand) und Beschreibung — Mobile-First 375×812. Der Aufgaben-Tab bleibt
	// markiert (Präfix-Match, Randbedingung).
	test('AK1: Route rendert Kopf, Kernzeile und Beschreibung bei 375×812', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938');
		const title = uniqueTitle('Leseseite');
		const id = await createViewTask(page, title);

		await page.goto(`/app/aufgaben/${id}`);

		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
		await expect(page.getByText('P4', { exact: true })).toBeVisible();
		await expect(page.getByText(/in \d+ Tagen/)).toBeVisible();
		await expect(page.getByText('15.01.2030')).toBeVisible();
		await expect(page.getByText('0,75')).toBeVisible();
		await expect(page.getByText('Erste Zeile')).toBeVisible();
		await expect(page.getByText('Zweite Zeile')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Aufgaben' })).toHaveAttribute('aria-selected', 'true');
	});

	// AK2/TF2: Unbekannte ID → Zustand „nicht gefunden" an Ort und Stelle (kein Redirect, kein
	// Formular), mit Link zurück zu den Aufgaben.
	test('AK2: unbekannte ID zeigt „nicht gefunden" ohne Weiterleitung', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-gone');
		await createViewTask(page, uniqueTitle('Hintergrund'));
		await page.goto('/app/aufgaben/999999');

		await expect(page.getByText('Diese Aufgabe gibt es nicht mehr.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Zu den Aufgaben' })).toBeVisible();
		await expect(page).toHaveURL(/\/app\/aufgaben\/999999$/);
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
	});

	// AK3/TF3: „Bearbeiten" öffnet das vorhandene TaskFormModal mit der Aufgabe; „Zurück" führt
	// zur vorherigen Hauptansicht — ohne Vorgänger (Kaltstart) auf den Fallback `/`.
	test('AK3: Bearbeiten öffnet TaskFormModal, Zurück fällt auf / zurück', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-edit');
		const title = uniqueTitle('Bearbeiten');
		const id = await createViewTask(page, title);

		await page.goto(`/app/aufgaben/${id}`);
		await page.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: `Aufgabe bearbeiten: ${title}` })).toBeVisible();

		// Test-Pflege #2938: Der native TaskForm-Dialog liegt im Top-Layer und fängt Pointer-Events
		// ab — ein Klick auf "Zurück" hinter dem offenen Dialog ist browserseitig unmöglich
		// (document.elementsFromPoint an der Button-Position liefert kol-dialog). Der Nutzer
		// schließt den Dialog zuerst (Escape, Modal-Vertrag), dann erst geht es zurück.
		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: `Aufgabe bearbeiten: ${title}` })).toBeHidden();

		await page.getByRole('button', { name: 'Zurück' }).click();
		await expect(page).toHaveURL(/\/app\/?$/);
	});

	// AK5/TF5: Ab 48rem zwei Spalten (Inhalt links, Faktenspalte rechts — x-Versatz), darunter
	// eine Spalte (untereinander, y-Versatz).
	test('AK5: zwei Spalten ab 48rem, eine Spalte bei 375 px', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-cols');
		const id = await createViewTask(page, uniqueTitle('Spalten'));

		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto(`/app/aufgaben/${id}`);
		const contentBox = await page.locator('.task-view-content').boundingBox();
		const factsBox = await page.locator('.task-view-facts').boundingBox();
		expect(contentBox).not.toBeNull();
		expect(factsBox).not.toBeNull();
		expect(factsBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width);

		await page.setViewportSize({ width: 375, height: 812 });
		const stackedContent = await page.locator('.task-view-content').boundingBox();
		const stackedFacts = await page.locator('.task-view-facts').boundingBox();
		expect(stackedContent).not.toBeNull();
		expect(stackedFacts).not.toBeNull();
		expect(stackedFacts!.y).toBeGreaterThanOrEqual(stackedContent!.y + stackedContent!.height);
	});

	// ── #2940 (Teil 3): Unteraufgaben, Blockiert, Herkunft, Ort — Vertrag: docs/spec/issue-2940.md ──

	const createDependency = async (page: Page, taskId: number, dependingTaskId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${taskId}/dependencies`, {
			data: { dependingTaskId },
		});
		expect(response.ok(), 'Setup: Abhängigkeits-Kante muss 2xx liefern').toBeTruthy();
	};

	const createSeries = async (page: Page, title: string, autoCreate: boolean): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				autoCreate,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(response.ok(), 'Setup: Serie muss 2xx liefern').toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const createSeriesInstance = async (page: Page, seriesId: number): Promise<number> => {
		const response = await page.request.post(`/api/v1/series/${seriesId}/instances`, { data: {} });
		expect(response.ok(), 'Setup: Serien-Instanz muss 2xx liefern').toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	// AK1/TF1: Block „Unteraufgaben" mit Titel-Link je Kind und Zähler „X von Y" — erledigte
	// Kinder zählen mit (der Server liefert Done-Kinder, archivierte nicht).
	test('AK1: Unteraufgaben-Block mit Link und Zähler „1 von 1"', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2940-sub');
		const parentId = await createViewTask(page, uniqueTitle('Eltern'));
		const childTitle = uniqueTitle('Kind');
		const childId = await createViewTask(page, childTitle);
		await createDependency(page, parentId, childId);
		const done = await page.request.patch(`/api/v1/tasks/${childId}`, { data: { status: 'Done' } });
		expect(done.ok(), 'Setup: Kind auf Done muss 2xx liefern').toBeTruthy();

		await page.goto(`/app/aufgaben/${parentId}`);
		await expect(page.getByRole('heading', { level: 2, name: 'Unteraufgaben' })).toBeVisible();
		const childLink = page.getByRole('link', { name: childTitle });
		await expect(childLink).toBeVisible();
		await expect(childLink).toHaveAttribute('href', new RegExp(`/aufgaben/${childId}$`));
		await expect(page.getByText('1 von 1')).toBeVisible();
	});

	// AK2/TF2: Ohne Kanten keine Blöcke („Leer bleibt leer"); wer andere blockiert, listet im
	// Block „Blockiert" die wartenden Aufgaben mit Link auf deren Ansicht.
	test('AK2: ohne Kanten keine Blöcke, als Blockierer listet „Blockiert" die wartende Aufgabe', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2940-block');
		const plainTitle = uniqueTitle('Blank');
		const plainId = await createViewTask(page, plainTitle);
		const blockedId = await createViewTask(page, uniqueTitle('Blockierer'));
		const waitingTitle = uniqueTitle('Wartend');
		const waitingId = await createViewTask(page, waitingTitle);
		await createDependency(page, waitingId, blockedId);

		await page.goto(`/app/aufgaben/${plainId}`);
		await expect(page.getByRole('heading', { level: 1, name: plainTitle })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Unteraufgaben' })).toHaveCount(0);
		await expect(page.getByRole('heading', { level: 2, name: 'Blockiert' })).toHaveCount(0);

		await page.goto(`/app/aufgaben/${blockedId}`);
		const waitingLink = page.getByRole('link', { name: waitingTitle });
		await expect(waitingLink).toBeVisible();
		await expect(waitingLink).toHaveAttribute('href', new RegExp(`/aufgaben/${waitingId}$`));
	});

	// AK3/TF3: Serien-Instanz → Herkunfts-Block mit Link auf /serien/<id>; Klick wechselt die
	// URL (die Zielansicht selbst kommt mit #2942 — bis dahin Dashboard-Tab als Fallback).
	test('AK3: Herkunfts-Block mit Serien-Link, Klick wechselt die URL', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2940-series');
		const seriesTitle = uniqueTitle('Serie');
		const seriesId = await createSeries(page, seriesTitle, true);
		const taskId = await createSeriesInstance(page, seriesId);

		await page.goto(`/app/aufgaben/${taskId}`);
		const seriesLink = page.getByRole('link', { name: `Aus Serie „${seriesTitle}"` });
		await expect(seriesLink).toBeVisible();
		await expect(seriesLink).toHaveAttribute('href', new RegExp(`/serien/${seriesId}$`));
		await seriesLink.click();
		await expect(page).toHaveURL(new RegExp(`/serien/${seriesId}$`));
	});

	// AK3/TF3: Serie mit autoCreate = false heißt „Vorlage" (ADR 0020) → anderes Block-Label.
	test('AK3: Vorlage (autoCreate = false) zeigt „Aus Vorlage"', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2940-tpl');
		const templateTitle = uniqueTitle('Vorlage');
		const seriesId = await createSeries(page, templateTitle, false);
		const taskId = await createSeriesInstance(page, seriesId);

		await page.goto(`/app/aufgaben/${taskId}`);
		await expect(page.getByRole('link', { name: `Aus Vorlage „${templateTitle}"` })).toBeVisible();
	});

	// AK4/TF4: Adresse wird eigener „Ort"-Block mit Karten-Link bei Koordinaten; „Mehr Details"
	// entfällt ganz; ohne Adresse erscheint kein Ort-Block.
	test('AK4: Ort-Block mit Karten-Link, ohne Adresse kein Ort und kein „Mehr Details"', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2940-ort');
		const plainTitle = uniqueTitle('Ohne Ort');
		const plainId = await createViewTask(page, plainTitle);
		const withPlace = await page.request.post('/api/v1/tasks', {
			data: {
				title: uniqueTitle('Mit Ort'),
				priority: 3,
				address: 'Mauerstraße 1, 10117 Berlin',
				latitude: 52.52,
				longitude: 13.405,
			},
		});
		expect(withPlace.ok(), 'Setup: Task mit Adresse muss 2xx liefern').toBeTruthy();
		const withPlaceId = ((await withPlace.json()) as { id: number }).id;

		await page.goto(`/app/aufgaben/${withPlaceId}`);
		await expect(page.getByRole('heading', { level: 2, name: 'Ort' })).toBeVisible();
		await expect(page.getByText('Mauerstraße 1, 10117 Berlin')).toBeVisible();
		await expect(page.getByRole('link', { name: /In Karten öffnen/ })).toBeVisible();
		await expect(page.getByText('Mehr Details')).toHaveCount(0);

		await page.goto(`/app/aufgaben/${plainId}`);
		await expect(page.getByRole('heading', { level: 2, name: 'Ort' })).toHaveCount(0);
	});
});
