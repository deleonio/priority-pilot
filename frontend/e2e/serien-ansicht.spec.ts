import { expect, test, type Page } from './fixtures';
import { registerOwnSession } from './helpers';

/**
 * Rote End-to-End-Spec für #2942 — Serien-/Vorlagenansicht `/app/serien/<id>` (Ansichten Teil 5).
 * Vertrag: docs/spec/issue-2942.md. Läuft gegen das echte Backend (In-Memory-DB), 375×812.
 * Rot, bis App.tsx die Route `/serien/<id>` auf die neue SeriesView-Leseseite schaltet
 * (bis dahin rendert der unbekannte Pfad das Dashboard — Muster aufgaben-ansicht.spec.ts).
 */

interface Seed {
	seriesId: number;
	openTitle: string;
	doneTitle: string;
}

/** Serie (autoCreate=true, Startdatum außerhalb des 30-Tage-Generierungshorizonts) + zwei Instanzen. */
const seedSeries = async (page: Page, label: string): Promise<Seed> => {
	const response = await page.request.post('/api/v1/series', {
		data: {
			title: `E2E 2942 ${label}`,
			rhythm: 'weekly',
			priority: 4,
			estimatedEffort: 0.5,
			description: 'Putzplan für die Woche',
			startDate: '2030-01-15T00:00:00.000Z',
			autoCreate: true,
		},
	});
	expect(response.ok(), 'Setup: Serien-Anlage muss 2xx liefern').toBeTruthy();
	const seriesId = ((await response.json()) as { id: number }).id;

	const createInstance = async (title: string): Promise<number> => {
		const res = await page.request.post(`/api/v1/series/${seriesId}/instances`, { data: { title } });
		expect(res.ok(), `Setup: Instanz "${title}" muss 2xx liefern`).toBeTruthy();
		return ((await res.json()) as { id: number }).id;
	};
	const openTitle = `Instanz offen ${label}`;
	const doneTitle = `Instanz erledigt ${label}`;
	await createInstance(openTitle);
	const doneId = await createInstance(doneTitle);
	const patch = await page.request.patch(`/api/v1/tasks/${doneId}`, { data: { status: 'Done' } });
	expect(patch.ok(), 'Setup: Erledigen muss 2xx liefern').toBeTruthy();
	return { seriesId, openTitle, doneTitle };
};

test.describe('Balamentum — Serien-/Vorlagenansicht #2942', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	// AK2/TF2: Serie — Kopf (h1 + Prioritäts-Badge), Rhythmus-Klartext mit Startdatum (keine
	// „Nächste:"-Termine, das ist Teil 6), „Offene Aufgaben" und „Zuletzt erledigt" (max. 5 mit
	// Erledigt-Datum); Instanz-Zeilen führen auf die Aufgabenansicht.
	test('AK2: Serie zeigt Kopf, Rhythmus-Klartext, offene und erledigte Instanzen', async ({ page }) => {
		await registerOwnSession(page, 'serien-ansicht-2942');
		const { seriesId, openTitle, doneTitle } = await seedSeries(page, 'Leseseite');

		await page.goto(`/app/serien/${seriesId}`);

		await expect(page.getByRole('heading', { level: 1, name: `E2E 2942 Leseseite` })).toBeVisible();
		await expect(page.getByText('P4', { exact: true })).toBeVisible();
		await expect(page.getByText('Wöchentlich')).toBeVisible();
		await expect(page.getByText('15.01.2030')).toBeVisible();
		await expect(page.getByText(/Nächste/)).toBeHidden();

		await expect(page.getByText('Offene Aufgaben')).toBeVisible();
		const openLink = page.getByRole('link', { name: openTitle });
		await expect(openLink).toBeVisible();
		await expect(openLink).toHaveAttribute('href', new RegExp(`/app/aufgaben/\\d+$`));

		await expect(page.getByText('Zuletzt erledigt')).toBeVisible();
		await expect(page.getByRole('link', { name: doneTitle })).toBeVisible();
		const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
		await expect(page.getByText(today)).toBeVisible();
	});

	// AK3/TF3: Vorlage (autoCreate=false) — kein Rhythmus-Block, „Entsteht nur auf Abruf.",
	// „Die Aufgabe bekommt" steht VOR „Daraus angelegt" (originSeriesId).
	test('AK3: Vorlage zeigt Abruf-Hinweis und „Daraus angelegt" unter „Die Aufgabe bekommt"', async ({ page }) => {
		await registerOwnSession(page, 'serien-ansicht-2942-vorlage');
		const response = await page.request.post('/api/v1/series', {
			data: {
				title: 'E2E 2942 Vorlage',
				rhythm: 'none',
				priority: 4,
				estimatedEffort: 0.5,
				autoCreate: false,
			},
		});
		expect(response.ok()).toBeTruthy();
		const seriesId = ((await response.json()) as { id: number }).id;
		const instanceTitle = 'Abruf-Aufgabe 2942';
		const instance = await page.request.post(`/api/v1/series/${seriesId}/instances`, {
			data: { title: instanceTitle },
		});
		expect(instance.ok()).toBeTruthy();

		await page.goto(`/app/serien/${seriesId}`);

		await expect(page.getByRole('heading', { level: 1, name: 'E2E 2942 Vorlage' })).toBeVisible();
		await expect(page.getByText('Entsteht nur auf Abruf.')).toBeVisible();
		await expect(page.getByText('Ohne Rhythmus')).toBeHidden();

		const gets = page.getByText('Die Aufgabe bekommt');
		const created = page.getByText('Daraus angelegt');
		await expect(gets).toBeVisible();
		await expect(created).toBeVisible();
		const getsBox = (await gets.boundingBox())!;
		const createdBox = (await created.boundingBox())!;
		expect(createdBox.y).toBeGreaterThanOrEqual(getsBox.y + getsBox.height);

		const instanceLink = page.getByRole('link', { name: instanceTitle });
		await expect(instanceLink).toBeVisible();
		await expect(instanceLink).toHaveAttribute('href', new RegExp(`/app/aufgaben/\\d+$`));
	});

	// AK4/TF4: Die eine Primäraktion unten öffnet den vorhandenen SeriesInstanceDialog; nach
	// erfolgreichem Anlegen navigiert die App auf die Aufgabenansicht der neuen Aufgabe.
	test('AK4: Primäraktion legt Aufgabe an und navigiert auf /aufgaben/<id>', async ({ page }) => {
		await registerOwnSession(page, 'serien-ansicht-2942-aktion');
		const { seriesId } = await seedSeries(page, 'Aktion');

		await page.goto(`/app/serien/${seriesId}`);
		await page.getByRole('button', { name: 'Aufgabe jetzt anlegen' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.locator('kol-dialog').getByRole('textbox', { name: 'Titel' }).fill('Neue Aufgabe E2E 2942');
		await page.locator('kol-dialog').getByRole('button', { name: 'Aufgabe anlegen' }).click();

		await expect(page).toHaveURL(/\/app\/aufgaben\/\d+$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Neue Aufgabe E2E 2942' })).toBeVisible();
	});

	// AK5/TF5 (e2e-Teil): unbekannte ID → Nicht-gefunden-Alert an Ort und Stelle (kein Redirect),
	// mit Rettungslink zu den Serien. Skelett/Refetch: SeriesView.test.tsx.
	test('AK5: unbekannte ID zeigt „Diese Serie gibt es nicht mehr." mit Link zu den Serien', async ({ page }) => {
		await registerOwnSession(page, 'serien-ansicht-2942-weg');
		await page.goto('/app/serien/999999');

		await expect(page.getByText('Diese Serie gibt es nicht mehr.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Zu den Serien' })).toBeVisible();
		await expect(page).toHaveURL(/\/app\/serien\/999999$/);
	});

	// AK6/TF6: Ab 48rem zwei Spalten (Inhalt links, Faktenspalte rechts — x-Versatz) und die
	// Primäraktion oben; bei 375 px eine Spalte (untereinander) mit Primäraktion unten.
	test('AK6: zwei Spalten ab 48rem mit Primäraktion oben, eine Spalte bei 375 px', async ({ page }) => {
		await registerOwnSession(page, 'serien-ansicht-2942-cols');
		const { seriesId } = await seedSeries(page, 'Spalten');

		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto(`/app/serien/${seriesId}`);
		const contentBox = await page.locator('.series-view-content').boundingBox();
		const factsBox = await page.locator('.series-view-facts').boundingBox();
		const actionBox = await page.getByRole('button', { name: 'Aufgabe jetzt anlegen' }).boundingBox();
		expect(contentBox).not.toBeNull();
		expect(factsBox).not.toBeNull();
		expect(actionBox).not.toBeNull();
		expect(factsBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width);
		expect(actionBox!.y).toBeLessThan(contentBox!.y);

		await page.setViewportSize({ width: 375, height: 812 });
		const stackedContent = await page.locator('.series-view-content').boundingBox();
		const stackedFacts = await page.locator('.series-view-facts').boundingBox();
		const bottomAction = await page.getByRole('button', { name: 'Aufgabe jetzt anlegen' }).boundingBox();
		expect(stackedContent).not.toBeNull();
		expect(stackedFacts).not.toBeNull();
		expect(bottomAction).not.toBeNull();
		expect(stackedFacts!.y).toBeGreaterThanOrEqual(stackedContent!.y + stackedContent!.height);
		expect(bottomAction!.y).toBeGreaterThan(stackedContent!.y);
	});
});
