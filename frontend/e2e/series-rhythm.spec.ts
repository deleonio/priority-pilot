import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #470 — Serien-Rhythmen: Werktags/Wochenende/Wochentag (Frontend).
 *
 * Das Backend (#469, gemergt) stellt `SeriesRhythm` als 12-wertige String-Union bereit
 * (`daily`, `weekly`, `monthly`, `weekdays`, `weekend`, `mon`…`sun`). Das Frontend muss diese
 * neuen Optionen in der Erfassung anbieten. Diese Spec prüft den Pfad direkt über die UI gegen das
 * **echte** Backend (In-Memory-DB, Vite-Proxy); nur `GET /auth/me` ist über die Fixture gemockt.
 *
 * Abgedeckte Akzeptanzkriterien:
 *  - AK1 (e2e): Beim Anlegen einer Serie bietet der Rhythmus-Select die neuen Optionen
 *    (Werktags/Wochenende/Mo–So) an.
 *  - AK2 (e2e): Eine über die UI mit neuem Rhythmus angelegte Serie wird im Backend gespeichert.
 *  - AK4 (Mobile-First): Bei 375×812 ist das (um neun Optionen gewachsene) Serien-Formular ohne
 *    horizontales Scrollen bedienbar.
 *
 * Diese Spec ist rot, solange `RHYTHM_OPTIONS` im `TaskForm` nur die drei alten Werte enthält und
 * der `onChange`-Guard neue Werte verwirft.
 *
 * `afterEach` räumt selbst angelegte Tasks und Serien über die echte API ab.
 */
test.describe('Priority Pilot — Serien-Rhythmen: Werktags/Wochenende/Wochentag (#470)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E #470 ${label} #${(runId += 1)}-${Date.now()}`;

	/** Räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	/**
	 * Öffnet den „Neuen Task anlegen"-Dialog, überspringt die Schnellerfassung und schaltet in den
	 * Serie-Modus, sodass die Rhythmus-Auswahl sichtbar ist.
	 */
	const openSeriesCreateForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		// In den Serie-Modus schalten (Switch mit data-testid="mode-switch").
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
		await expect(page.getByLabel('Rhythmus')).toBeVisible();
	};

	// AK1 (e2e): Beim Anlegen einer Serie bietet der Rhythmus-Select die neuen Optionen an.
	test('AK1 — Rhythmus-Select bietet Werktags/Wochenende/Mo–So an', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesCreateForm(page);

		// KoliBri `KolSingleSelect` → nativer `<select>` im Shadow-DOM. Die Optionen tragen ihre
		// Bezeichnungen als Text; hier prüfen wir stellvertretend die neuen Werte. Rot, solange
		// RHYTHM_OPTIONS nur Täglich/Wöchentlich/Monatlich enthält.
		const rhythmSelect = page.locator('kol-single-select').getByRole('listbox');
		// Fallback: KoliBri rendert die Optionen zugänglich über den Label-Text.
		for (const label of ['Werktags', 'Wochenende', 'Montags', 'Sonntags']) {
			await expect(
				page.locator('kol-single-select').filter({ hasText: label }),
				`Rhythmus-Option „${label}“ fehlt`,
			).toBeAttached();
			void rhythmSelect;
		}
	});

	// AK2 (e2e): Eine über die UI mit neuem Rhythmus angelegte Serie wird im Backend gespeichert.
	test('AK2 — Serie mit rhythm „weekdays" wird über die UI angelegt und im Backend gespeichert', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesCreateForm(page);

		const title = uniqueTitle('Werktags');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByLabel('Startdatum').fill('2026-09-07');

		// Den ausgehenden Serien-POST abfangen (Beweis für die korrekte Verzweigung).
		const seriesRequestPromise = page.waitForRequest(
			(req) => req.method() === 'POST' && /\/api\/v1\/series(\?|$)/.test(req.url()),
		);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		const seriesRequest = await seriesRequestPromise;
		const requestBody = seriesRequest.postDataJSON() as { rhythm?: string };
		// Rot, solange der onChange-Guard den neuen Wert verwirft (dann kommt der alte Default).
		expect(requestBody.rhythm).toBe('weekdays');

		// Persistenz gegenprüfen: die Serie liegt mit dem neuen Rhythmus im Backend.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		const series = (await (await page.request.get('/api/v1/series')).json()) as { title: string; rhythm: string }[];
		const created = series.find((entry) => entry.title === title);
		expect(created, 'Serie wurde nicht im Backend gespeichert').toBeTruthy();
		expect(created?.rhythm).toBe('weekdays');
	});

	// AK4 (Mobile-First): Bei 375×812 ist das (um neun Optionen gewachsene) Serien-Formular ohne
	// horizontales Scrollen bedienbar.
	test('AK4 — Serien-Formular ohne horizontales Scrollen auf 375px Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesCreateForm(page);

		// Die Rhythmus-Auswahl bleibt bedienbar.
		await expect(page.getByLabel('Rhythmus')).toBeVisible();
		await expect(page.getByLabel('Startdatum')).toBeVisible();

		// Kein horizontales Scrollen: die Scrollbreite überschreitet die Viewport-Breite nicht.
		const hasNoHorizontalScroll = await page.evaluate(
			() => document.scrollingElement !== null && document.scrollingElement.scrollWidth <= window.innerWidth,
		);
		expect(hasNoHorizontalScroll, 'Horizontales Scrollen auf 375px').toBeTruthy();
	});
});
