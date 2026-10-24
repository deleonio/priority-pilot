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
});
