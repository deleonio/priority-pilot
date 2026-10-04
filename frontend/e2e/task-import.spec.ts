import { expect, test, type Page } from '@playwright/test';

/**
 * Rote Spec-E2E für #1969 (Spec `docs/spec/issue-1969.md`, AK6): Der Import ist als eigene
 * Einstellungs-Registerkarte „Import“ erreichbar; Datei-Auswahl → Vorschau (Zahlen mit Kontext)
 * → Übernahme erzeugt Aufgaben und meldet die Anzahl; bei 375px bleibt die Import-Karte im
 * Viewport (Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x: hidden).
 *
 * Session über `POST /auth/test-login` (nur NODE_ENV=test): `/tasks/import*` braucht eine echte
 * pro-Nutzer-Session, die `/auth/me`-Mock-Fixture liefert die nicht (Muster admin-invoices.spec.ts,
 * `test` direkt aus `@playwright/test`). Rot: Tab und Karte existieren noch nicht — erster roter
 * Zustand ist das Sichtbarkeits-Timeout der Registerkarte.
 */

const MOBILE = { width: 375, height: 812 } as const;
const USER = { email: 'import-1969@example.com', displayName: 'Ida Import' };

const TODOIST_CSV = [
	'TYPE,CONTENT,PRIORITY,DATE',
	'task,Steuererklärung,4,2026-11-02',
	'task,"Wocheneinkauf, auch Drogerie",2,2026-10-10',
	'note,Kurze Notiz,1,',
].join('\r\n');

const session = async (page: Page): Promise<void> => {
	const login = await page.request.post('/auth/test-login', { data: USER });
	expect(login.status(), 'test-login muss eine Session liefern').toBe(200);
};

test.describe('#1969 Import aus Todoist und CSV', () => {
	test('AK6: Import-Tab in den Einstellungen, Vorschau und Übernahme erzeugen Aufgaben', async ({ page }) => {
		await session(page);
		await page.goto('/app/settings/import');
		await expect(page.getByRole('tab', { name: 'Import', exact: true })).toBeVisible();

		await page.locator('.task-import-card input[type="file"]').setInputFiles({
			name: 'todoist.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(TODOIST_CSV, 'utf-8'),
		});

		// Vorschau mit Zahlen-Kontext: 2 valide von 3 Datenzeilen (note wird übersprungen).
		await expect(page.getByText(/2 von 3/)).toBeVisible();
		await page.getByRole('button', { name: /2 Aufgaben übernehmen/ }).click();
		await expect(page.locator('.task-import-card kol-alert')).toContainText('2');
	});

	test('AK6: bei 375px bleibt die Import-Karte im Viewport (Bounding-Box, kein Horizontal-Overflow)', async ({
		page,
	}) => {
		await session(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/import');
		const card = page.locator('.task-import-card');
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box, 'Import-Karte muss vermessen sein').not.toBeNull();
		expect(box!.x + box!.width, 'Import-Karte ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);
	});
});
