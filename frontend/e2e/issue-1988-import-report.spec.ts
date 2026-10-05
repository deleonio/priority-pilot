import { expect, test, type Page } from '@playwright/test';

/**
 * E2E für #1988 (Spec `docs/spec/issue-1988.md`, TF7): Nach dem Übernehmen zeigt die
 * Import-Karte den Analyse-Bericht (Anzahl, Aufgaben ohne Frist, exakte Dubletten mit
 * Begründung) und der Dubletten-Merge läuft gegen das echte Backend. KI-Abhängigkeits-Vorschläge
 * kann das e2e-Backend nicht echt erzeugen (kein LLM-Provider — der Server degradiert still),
 * die Vorschlags-Struktur wird gezielt injiziert (Muster #373/#1077); das Übernehmen läuft gegen
 * den echten Dependencies-Endpunkt inklusive Zyklus-Schutz.
 *
 * Session über `POST /auth/test-login` (nur NODE_ENV=test, Muster task-import.spec.ts).
 */

const MOBILE = { width: 375, height: 812 } as const;

const CSV = ['TYPE,CONTENT,PRIORITY,DATE', 'task,Einkaufen,2,2026-11-02', 'task,einkaufen ,3,', 'task,Sport,4,'].join(
	'\r\n',
);

const session = async (page: Page, email: string): Promise<void> => {
	const login = await page.request.post('/auth/test-login', { data: { email, displayName: 'Immo Import' } });
	expect(login.status(), 'test-login muss eine Session liefern').toBe(200);
};

const importCsv = async (page: Page, email: string): Promise<void> => {
	await session(page, email);
	await page.goto('/app/settings/daten');
	await page.locator('.task-import-card input[type="file"]').setInputFiles({
		name: 'todoist.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(CSV, 'utf-8'),
	});
	await page.getByRole('button', { name: /3 Aufgaben übernehmen/ }).click();
};

test.describe('#1988 Import-Bericht', () => {
	test('AK1/AK6: Bericht mit Anzahl, ohne-Frist-Liste und Dubletten; Merge lässt genau einen Task übrig', async ({
		page,
	}) => {
		await importCsv(page, 'import-1988-a@example.com');

		const card = page.locator('.task-import-card');
		await expect(card.locator('kol-alert').first()).toContainText('3 Aufgaben übernommen');
		const report = card.locator('.task-import-report');
		await expect(report).toBeVisible();
		// Zwei der drei Zeilen ohne Frist — Zahlen mit Kontext.
		await expect(report.getByText('2 von 3 Aufgaben ohne Frist')).toBeVisible();
		await expect(report.getByText('Sport')).toBeVisible();
		// Exakte Dublette (Kopie im CSV) mit Begründung und Objekt im Aktions-Namen.
		await expect(report.getByText('Exakte Dubletten')).toBeVisible();
		const mergeButton = page.getByRole('button', { name: /Dublette ‚.*‘ zusammenführen/ });
		await expect(mergeButton).toBeVisible();

		await mergeButton.click();
		// Nach dem Merge ist die Dubletten-Liste leer und der Bestand hat genau zwei Tasks.
		await expect(report.getByText('Exakte Dubletten')).toHaveCount(0);
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as unknown[];
		expect(tasks.length, 'genau ein Task der Dublette bleibt übrig').toBe(2);
	});

	test('AK7: bei 375px ist der Bericht einspaltig bedienbar und die Karte bleibt im Viewport', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await importCsv(page, 'import-1988-b@example.com');

		const card = page.locator('.task-import-card');
		await expect(card.locator('.task-import-report')).toBeVisible();
		await expect(page.getByRole('button', { name: /Dublette ‚.*‘ zusammenführen/ })).toBeVisible();
		const box = await card.boundingBox();
		expect(box, 'Import-Karte muss vermessen sein').not.toBeNull();
		expect(box!.x + box!.width, 'Import-Karte ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);
	});

	test('AK4/AK5: KI-Vorschläge übernehmen (echte Kante) und verwerfen; Zyklus wird inline abgelehnt', async ({
		page,
	}) => {
		// Das e2e-Backend hat keinen LLM-Provider — die Vorschlags-Struktur wird in die echte
		// Analyse-Antwort injiziert, das Übernehmen läuft gegen den echten Endpunkt.
		await page.route('**/tasks/import/analysis', async (route) => {
			const response = await route.fetch();
			const base = (await response.json()) as {
				total: number;
				missingDeadlines: unknown[];
				duplicates: unknown[];
				suggestions: unknown[];
			};
			// Auf die angelegten Aufgaben warten — der Import läuft vor der Analyse, aber der
			// Handler darf nicht von der Commit-Reihenfolge überrascht werden.
			let einkaufen: { id: number; title: string } | undefined;
			let sport: { id: number; title: string } | undefined;
			for (let attempt = 0; attempt < 50 && !(einkaufen && sport); attempt++) {
				const res = await page.request.get('/api/v1/tasks');
				if (res.ok()) {
					const list = (await res.json()) as Array<{ id: number; title: string }>;
					einkaufen = list.find((task) => task.title === 'Einkaufen');
					sport = list.find((task) => task.title === 'Sport');
				}
				if (!(einkaufen && sport)) await new Promise((resolve) => setTimeout(resolve, 100));
			}
			expect(einkaufen, 'angelegte Aufgaben für die Injektion').toBeDefined();
			expect(sport, 'angelegte Aufgaben für die Injektion').toBeDefined();
			await route.fulfill({
				response,
				json: {
					...base,
					suggestions: [
						{
							dependentTaskId: einkaufen!.id,
							dependingTaskId: sport!.id,
							title: 'Einkaufen',
							reason: 'Erst einkaufen, dann Sport',
						},
						{
							dependentTaskId: sport!.id,
							dependingTaskId: einkaufen!.id,
							title: 'Sport',
							reason: 'Gegenprobe: wäre ein Zyklus',
						},
					],
				},
			});
		});

		await importCsv(page, 'import-1988-c@example.com');
		const report = page.locator('.task-import-report');
		await expect(report.getByText('Abhängigkeits-Vorschläge')).toBeVisible();

		// Übernehmen: echte Kante über POST /tasks/{id}/dependencies → Vorschlag verschwindet.
		await page.getByRole('button', { name: 'Abhängigkeit ‚Einkaufen‘ übernehmen' }).click();
		await expect(report.getByText('Erst einkaufen, dann Sport')).toHaveCount(0);

		// Zyklus-Gegenprobe: Ablehnung erscheint inline am Vorschlag, der Vorschlag bleibt.
		await page.getByRole('button', { name: 'Abhängigkeit ‚Sport‘ übernehmen' }).click();
		const cycleAlert = report.locator('kol-alert[_type="error"], kol-alert');
		await expect(cycleAlert.filter({ hasText: 'Zyklus' })).toBeVisible();
		await expect(report.getByText('Gegenprobe: wäre ein Zyklus')).toBeVisible();

		// Verwerfen: Vorschlag verschwindet, Abschlusszustand statt leerem Rest.
		await page.getByRole('button', { name: 'Abhängigkeit ‚Sport‘ verwerfen' }).click();
		await expect(report.getByText('Alle Vorschläge bearbeitet.')).toBeVisible();
	});
});
