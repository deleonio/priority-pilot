import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { headerAction, SPEECH_MOCK_INIT_SCRIPT, waitForStableView } from './helpers';

/**
 * E2E-Spec für den Säulen-Berater (Aktivitäten-Ratgeber): Über das Glühbirnen-Symbol im Header
 * öffnet sich ein Modal, das per `POST /api/v1/pillars/advisor` (Mistral) konkrete Aktivitäten
 * vorschlägt und zeigt, auf welche Säulen sie einzahlen würden.
 *
 * **Mocks:** Der Advisor-Endpoint wird gezielt per `page.route` abgefangen (kein echtes LLM im
 * Test — analog `quick-capture.spec.ts`). Alle übrigen Requests (insbesondere `GET /api/v1/pillars`
 * für die Säulen-Namen der Badges) gehen unverändert an das echte Backend mit den gesäten
 * Säulen-Stammdaten.
 */
test.describe('Säulen-Berater (Aktivitäten-Ratgeber)', () => {
	/** Öffnet den Säulen-Berater über die Kopf-Aktionen (auf Handy-Breite über das „⋮"-Menü). */
	const openAdvisor = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await (await headerAction(page, 'Säulen-Berater')).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
		await waitForStableView(page);
	};

	test('Toolbar-Button öffnet das Berater-Modal mit Fragefeld und CTA', async ({ page }) => {
		await openAdvisor(page);

		await expect(page.getByRole('textbox', { name: /Deine Frage oder Situation/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toBeVisible();
	});

	test('zeigt Vorschläge mit Aktivität, Säulen-Badges und Begründung an', async ({ page }) => {
		// Die realen Säulen-IDs aus dem Backend holen, damit die gemockte Antwort auf die vom
		// Frontend geladene Säulen-Liste passt (die Badges lösen pillarIds zu Namen auf).
		const response = await page.request.get('/api/v1/pillars');
		const pillars = (await response.json()) as { id: number; name: string }[];
		const koerper = pillars.find((pillar) => pillar.name === 'Körper');
		const beziehungen = pillars.find((pillar) => pillar.name === 'Beziehungen');
		expect(koerper).toBeDefined();
		expect(beziehungen).toBeDefined();

		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [
						{
							activity: 'Spaziergang mit einem Freund',
							reason: 'Bewegung und gemeinsame Zeit in einem.',
							pillarIds: [koerper!.id, beziehungen!.id],
						},
					],
				}),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir am Wochenende gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		// Bewusst NICHT auf role=dialog gescoped: der Modal-Inhalt ist ge-slottetes Light-DOM des
		// <kol-dialog>-Hosts und damit kein DOM-Nachfahre des nativen <dialog> im Shadow-DOM.
		const results = page.locator('.advisor-results');
		await expect(results.getByText('Spaziergang mit einem Freund')).toBeVisible();
		await expect(results.getByText('Bewegung und gemeinsame Zeit in einem.')).toBeVisible();
		// Die pillarIds werden zu den Säulen-Namen aufgelöst (Badges).
		await expect(results.getByText('Körper')).toBeVisible();
		await expect(results.getByText('Beziehungen')).toBeVisible();
	});

	/**
	 * Mic-Button im Berater-Fragefeld per aria-label selektieren.
	 * Muster aus voice-transcription.spec.ts — überlebt Label-Wechsel starten ↔ stoppen.
	 */
	const advisorMicButton = (page: Page) =>
		page.getByRole('button', {
			name: /^Aufnahme (starten \(Mikrofon\)|stoppen): Deine Frage oder Situation$/,
		});

	test('AK1 (#326): Mic-Button liegt vollständig INNERHALB der sichtbaren Textarea im Berater-Fragefeld (mit _hint)', async ({
		page,
	}) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await openAdvisor(page);

		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir gut?');

		const buttonBox = await advisorMicButton(page).boundingBox();
		// `getByRole('textbox')` liefert die native textarea im KoliBri-Shadow-DOM — die sichtbare Inputbox,
		// NICHT den .voice-field-Wrapper (der auch den _hint-Text umfasst). Deshalb bleibt der Vergleich
		// robust gegen variable Hint-Höhen.
		const fieldBox = await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		if (buttonBox === null || fieldBox === null) return;

		// Vollständig innerhalb der sichtbaren Inputbox (scheitert VOR dem Fix: Button ~14px darunter).
		expect(buttonBox.x).toBeGreaterThanOrEqual(fieldBox.x);
		expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width + 1);
		expect(buttonBox.y).toBeGreaterThanOrEqual(fieldBox.y);
		expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height + 1);
		// … und rechtsbündig unten (±10px Toleranz für 0.5rem-Abstand).
		expect(buttonBox.x + buttonBox.width).toBeGreaterThanOrEqual(fieldBox.x + fieldBox.width - 10);
		expect(buttonBox.y + buttonBox.height).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 10);
	});

	test('AK3 (#326): Mic-Button bleibt auf 375px-Viewport sauber in der Textarea, kein horizontales Scrollen', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await openAdvisor(page);

		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Mobile-Test');

		const buttonBox = await advisorMicButton(page).boundingBox();
		const fieldBox = await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		if (buttonBox === null || fieldBox === null) return;

		// Button vollständig in der Textarea (identische Assertion wie AK1, aber 375px-Viewport).
		expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height + 1);
		// Kein horizontales Scrollen (Muster aus AK18 / voice-transcription.spec.ts).
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});

	test('zeigt die Fehlermeldung des Servers, wenn die Beratung fehlschlägt', async ({ page }) => {
		await page.route('**/api/v1/pillars/advisor', (route: Route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'MISTRAL_API_KEY ist nicht gesetzt.' }),
			}),
		);

		await openAdvisor(page);
		await page.getByRole('button', { name: 'Beraten lassen' }).click();

		await expect(page.getByText('Beratung fehlgeschlagen')).toBeVisible();
	});
});
