import { expect, test, type Page, type Route } from '@playwright/test';
import { openAccordionSection } from './helpers';

/**
 * #1676: Konto löschen in den Einstellungen mit sequenzieller Bestätigung. Echte Session über
 * `/auth/test-login` und echtes Backend (Muster `issue-1356-token-scope.spec.ts`); die Datei
 * importiert bewusst NICHT aus `./fixtures`, deren `/auth/me`-Mock auch das `DELETE` abfinge.
 *
 * Die E2E-Umgebung läuft ohne Auth-Konfiguration: dort liefert `GET /auth/me` ohne Session einen
 * synthetischen Nutzer statt 401. Nach dem Löschen stellt der Test deshalb den Produktionsfall her
 * (401 ohne Session), damit die Login-Seite erscheint.
 */

const login = async (page: Page, email: string): Promise<number> => {
	expect((await page.request.post('/auth/test-login', { data: { email } })).status()).toBe(200);
	return ((await (await page.request.get('/api/v1/auth/me')).json()) as { id: number }).id;
};

const taskCount = async (page: Page): Promise<number> =>
	((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length;

const openAccountSettings = async (page: Page, email: string): Promise<number> => {
	const id = await login(page, email);
	expect(
		(await page.request.post('/api/v1/tasks', { data: { title: 'Vorher', priority: 3, estimatedEffort: 1 } })).ok(),
	).toBe(true);
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/app/settings/general');
	// #1802: Der Auslöser sitzt hinter dem zugeklappten Accordion und wird erst durch Aufklappen sichtbar.
	await openAccordionSection(page, 'Konto und Daten');
	await expect(page.getByRole('button', { name: 'Konto löschen' })).toBeVisible();
	return id;
};

/** Kein horizontaler Überlauf und jedes Touch-Ziel im Dialog mindestens 44 px hoch. */
const expectMobileFit = async (page: Page, buttons: string[]): Promise<void> => {
	for (const name of buttons) {
		const box = await page.getByRole('button', { name, exact: true }).boundingBox();
		expect(box?.height ?? 0, `${name}: Touch-Ziel`).toBeGreaterThanOrEqual(44);
		expect((box?.x ?? 0) + (box?.width ?? 0), `${name}: innerhalb des Viewports`).toBeLessThanOrEqual(375);
	}
	const overflow = await page.evaluate(() => {
		const el = document.scrollingElement;
		return (el?.scrollWidth ?? 0) - (el?.clientWidth ?? 0);
	});
	expect(overflow).toBeLessThanOrEqual(1);
};

test.describe('Balamentum — #1676: Konto löschen', () => {
	test('vollständige Bestätigung meldet ab, zeigt die Login-Seite, erneuter Login startet leer', async ({ page }) => {
		const email = 'konto-weg@example.com';
		const oldId = await openAccountSettings(page, email);

		await page.getByRole('button', { name: 'Konto löschen' }).click();
		await expectMobileFit(page, ['Abbrechen', 'Löschen']);
		await page.getByRole('button', { name: 'Löschen', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeFocused();
		await expectMobileFit(page, ['Abbrechen', 'Endgültig löschen']);

		await page.route('**/auth/me', (route: Route) =>
			route.request().method() === 'GET'
				? route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Nicht eingeloggt."}' })
				: route.fallback(),
		);
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();

		await expect(page).toHaveURL(/\/app\/login$/);
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();

		const newId = await login(page, email);
		expect(newId).not.toBe(oldId);
		expect(await taskCount(page)).toBe(0);
	});

	test('Abbruch in jedem Schritt lässt das Konto unverändert', async ({ page }) => {
		const id = await openAccountSettings(page, 'konto-bleibt@example.com');
		const trigger = page.getByRole('button', { name: 'Konto löschen' });

		await trigger.click();
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);

		await trigger.click();
		await page.getByRole('button', { name: 'Löschen', exact: true }).click();
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0);

		expect(((await (await page.request.get('/api/v1/auth/me')).json()) as { id: number }).id).toBe(id);
		expect(await taskCount(page)).toBe(1);
	});

	test('#1802 AK1: vor dem Aufklappen ist der Auslöser in keinem Tab sichtbar', async ({ page }) => {
		await login(page, 'konto-versteckt@example.com');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/general');
		await expect(page.getByRole('button', { name: 'Konto löschen' })).not.toBeVisible();
		await page.goto('/app/settings/gruppen');
		await expect(page.getByRole('button', { name: 'Konto löschen' })).not.toBeVisible();
	});

	test('#1802 AK2: nach dem Aufklappen ist der Auslöser sichtbar und öffnet den Dialog', async ({ page }) => {
		await login(page, 'konto-accordion@example.com');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/general');
		await openAccordionSection(page, 'Konto und Daten');
		const trigger = page.getByRole('button', { name: 'Konto löschen' });
		await expect(trigger).toBeVisible();
		await trigger.click();
		await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toBeVisible();
	});

	test('#1802 AK5: aufgeklappter Bereich bleibt bei 375px innerhalb des Viewports', async ({ page }) => {
		await login(page, 'konto-breite@example.com');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/settings/general');
		await openAccordionSection(page, 'Konto und Daten');
		// Bounding-Box des Accordion-Hosts (Light DOM). Test-Pflege: `xpath=ancestor::details[1]` vom
		// Button aus greift nie — KolAccordion rendert <details> im Shadow-Root, der Button ist
		// geslotetes Light-DOM-Kind (nachgetragen in der PR-Beschreibung). hasText pierct Shadow-DOM.
		const box = await page.locator('kol-accordion', { hasText: 'Konto und Daten' }).boundingBox();
		expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
	});
});
