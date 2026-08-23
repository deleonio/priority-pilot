import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';
import { TITLE_MAX_LENGTH } from '../src/lib/titleLengthValidation.ts';

/**
 * E2E-Spec-Tests für #935 „Säulen-Formular: Beschreibung als Textarea, Titel auf 30 Zeichen
 * begrenzt" — roter Test-Vertrag zu docs/spec/issue-935.md.
 *
 * Sie laufen gegen das echte Backend (kein API-Mock); `/auth/me` wird durch die Fixture
 * authentifiziert. Die generische Säulen-CRUD-Abdeckung (Anlegen/Bearbeiten/Löschen über
 * `getByRole('textbox', …)`) steht in `pillar-crud.spec.ts` und wird hier nicht dupliziert —
 * diese Spec prüft nur Elementtyp (Textarea statt Input) und Längenbeschränkung des Namens.
 */

/** Öffnet den Säulen-Tab über die Settings-Route und wartet auf die stabile, hydrierte Ansicht. */
const openPillarTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/pillars');
	await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
	await waitForStableView(page, 'Priority Pilot');
};

/** Löscht alle Säulen (außer den Default-Säulen) über die echte API — sauberer Start je Test. */
const deleteAllPillars = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/pillars');
	const pillars = (await response.json()) as { id: number }[];
	for (const pillar of pillars) {
		await page.request.delete(`/api/v1/pillars/${pillar.id}`);
	}
};

test.describe('#935 Säulen-Formular — Beschreibung als Textarea, Name auf 30 Zeichen', () => {
	let runId = 0;
	const uniqueName = (label: string): string => `E2E-P935-${label}-#${(runId += 1)}-${Date.now()}`;

	test.afterEach(async ({ page }) => {
		await deleteAllPillars(page);
	});

	/**
	 * AK1 / Spec-Schritt 1: Im Anlegen- UND Bearbeiten-Dialog ist die Beschreibung eine
	 * mehrzeilige KolTextarea (inneres <textarea>), der Name bleibt ein einzeiliger
	 * KolInputText (inneres <input>). Erst der Elementtyp macht mehrzeilige Beschreibungen
	 * möglich — role „textbox" allein matcht beide (daher dedizierter Struktur-Check).
	 */
	test('AK1: Beschreibung ist eine KolTextarea, Name bleibt KolInputText', async ({ page }) => {
		await openPillarTab(page);

		// Anlegen-Dialog
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		// Genau ein einzeiliges Input (Name) und genau eine Textarea (Beschreibung) im Dialog
		await expect(dialog.locator('kol-input-text input[type="text"]')).toHaveCount(1);
		await expect(dialog.locator('kol-textarea textarea')).toHaveCount(1);
		// Tag-Vertrag über die rollenbasierten Felder (textbox matcht Input UND Textarea):
		expect(await dialog.getByRole('textbox', { name: 'Name' }).evaluate((el) => el.tagName)).toBe('INPUT');
		expect(await dialog.getByRole('textbox', { name: 'Beschreibung' }).evaluate((el) => el.tagName)).toBe('TEXTAREA');
		await dialog.getByRole('button', { name: 'Abbrechen' }).click();

		// Bearbeiten-Dialog (Komponente identisch, aber gleicher Vertrag für den Edit-Pfad)
		const name = uniqueName('Struktur');
		await page.request.post('/api/v1/pillars', { data: { name, description: 'Dummy' } });
		await page.reload();
		await openPillarTab(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page, 'Priority Pilot');
		await expect(dialog.locator('kol-textarea textarea')).toHaveCount(1);
		await expect(dialog.locator('kol-input-text input[type="text"]')).toHaveCount(1);
	});

	/**
	 * AK1 / Spec-Schritt 2: Eine mehrzeilige Beschreibung (Zeilenumbruch) überlebt die
	 * Rundreise Anlegen → Reload → Bearbeiten-Dialog. Das ist der eigentliche Nutzen der
	 * Textarea: Zeilenumbrüche werden nicht plattgedrückt.
	 */
	test('AK1: Mehrzeilige Beschreibung überlebt Reload', async ({ page }) => {
		await openPillarTab(page);
		const name = uniqueName('Multiline');
		const description = 'Zeile 1\nZeile 2';

		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
		await dialog.getByRole('textbox', { name: 'Beschreibung' }).fill(description);
		await dialog.getByRole('button', { name: 'Anlegen' }).click();
		await expect(page.getByText(name, { exact: true })).toBeVisible();

		// Reload + Bearbeiten-Dialog: Zeilenumbruch muss im Textarea-Wert stehen
		await page.reload();
		await openPillarTab(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await waitForStableView(page, 'Priority Pilot');
		await expect(dialog.locator('kol-textarea').locator('textarea')).toHaveValue(description);
	});

	/**
	 * AK2 / Spec-Schritt 3: Der Name ist auf TITLE_MAX_LENGTH beschränkt — Sollwert aus der
	 * führenden Quelle (`titleLength.ts`, von TaskForm/Series geteilt) importiert, nicht als
	 * Literal. `maxlength` am nativen Input UND hartes Kappen realer Tastatur-Eingaben
	 * (`fill()` umgeht maxlength, daher pressSequentially).
	 */
	test('AK2: Name auf TITLE_MAX_LENGTH begrenzt', async ({ page }) => {
		await openPillarTab(page);

		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		const nameInput = dialog.getByRole('textbox', { name: 'Name' });
		await expect(nameInput).toHaveAttribute('maxlength', String(TITLE_MAX_LENGTH));

		// Reale Tastatur-Eingabe über die Grenze: Browser-Kappprüfung (hard behavior)
		await nameInput.click();
		await nameInput.pressSequentially('x'.repeat(TITLE_MAX_LENGTH + 5));
		await expect(nameInput).toHaveValue('x'.repeat(TITLE_MAX_LENGTH));
	});
});
