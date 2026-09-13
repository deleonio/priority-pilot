import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1335 — „Schnellerfassung und Berater verschmelzen" (AK4, AK5).
 *
 * Spezifikation: docs/spec/issue-1335.md
 *
 * Vertrag (ersetzt #1080/#1085): Im Settings-Tab „KI-Provider" gibt es nur noch EINEN Schalter
 * „KI-Features aktiv". Der bisherige Feinschalter „Schnellerfassung aktiv" und das Accordion
 * „Einzelne KI-Funktionen" existieren nicht mehr; der Storage-Key `pp-quick-capture-enabled` wird
 * nicht mehr gelesen oder geschrieben (AK4). Bei `pp-ai-enabled = false` öffnet „Neuen Task
 * anlegen" direkt das normale Task-Formular, ohne Freitext-Einstieg und ohne „Beraten lassen" (AK5).
 *
 * **Ersetzt:** Diese Datei ersetzt die #1080/#1085-Tests rund um den zweiten Schalter
 * „Schnellerfassung aktiv" (Test-Pflege-Bedarf, siehe PR-Beschreibung) — sie widersprechen AK4.
 */

/** Legacy-Key, der laut AK4 nicht mehr gelesen/geschrieben werden darf. */
const QUICK_CAPTURE_ENABLED_KEY = 'pp-quick-capture-enabled';

/** Schalter-Locator mit Rollen-Fallback: KoliBri exponiert `switch` bzw. `checkbox` je Version. */
const switchControl = (page: Page, name: RegExp) =>
	page.getByRole('switch', { name }).or(page.getByRole('checkbox', { name }));

/** Setzt die KI-Präferenz vor dem Seitenaufbau (Wert wie in localStorage: 'true'/'false'). */
const initAiEnabled = (page: Page, aiEnabled: boolean): void => {
	page.addInitScript((value: boolean) => {
		try {
			localStorage.setItem('pp-ai-enabled', String(value));
		} catch {
			/* ignore */
		}
	}, aiEnabled);
};

/** Öffnet den KI-Provider-Tab der Einstellungen. */
const openLlmTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/llm');
	await waitForStableView(page, 'Priority Pilot');
};

test.describe('#1335 KI-Features: ein einziger Schalter', () => {
	test('AK4: genau ein Schalter „KI-Features aktiv" — kein „Schnellerfassung aktiv", kein Accordion', async ({
		page,
	}) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await expect(aiSwitch).toBeVisible();
		await expect(aiSwitch).toBeChecked();

		// Der bisherige Feinschalter existiert nirgends mehr im Tab.
		await expect(switchControl(page, /^Schnellerfassung aktiv$/)).toHaveCount(0);
		// Das Accordion, das ausschließlich diesen Feinschalter enthielt, ist mit ihm verschwunden.
		await expect(page.getByRole('button', { name: /Einzelne KI-Funktionen/ })).toHaveCount(0);

		// Genau ein Schalter im gesamten Tab (kein zweiter Checkbox-/Switch-Input mehr im KI-Bereich).
		const switches = page.locator('.settings-llm kol-input-checkbox[_variant="switch"]');
		await expect(switches).toHaveCount(1);
	});

	test('AK4: der Legacy-Key „pp-quick-capture-enabled" wird beim Umschalten nicht mehr geschrieben', async ({
		page,
	}) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();
		await aiSwitch.click();
		await expect(aiSwitch).toBeChecked();

		const legacyValue = await page.evaluate((key: string) => localStorage.getItem(key), QUICK_CAPTURE_ENABLED_KEY);
		expect(legacyValue).toBeNull();
	});

	test('AK5: KI aus — „Neuen Task anlegen" öffnet direkt das Task-Formular, ohne Freitext-Einstieg', async ({
		page,
	}) => {
		initAiEnabled(page, false);

		await page.goto('/');
		await waitForStableView(page);

		// Toolbar: kein „Säulen-Berater"-Button (Vertrag aus AK1, hier als Randbedingung mitgeprüft).
		await expect(
			page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Säulen-Berater' }),
		).toHaveCount(0);

		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());

		// Direkt das Task-Formular (Feld „Titel") — kein Freitext-Capture-Schritt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveCount(0);
		// Und kein „Beraten lassen"-Weg, da bei KI-aus kein KI-Dialog existiert.
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toHaveCount(0);

		// Kein Lektorat-Button im Formular (unverändertes #1080-Verhalten für aiEnabled=false).
		await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
	});

	test('AK5: die KI-Präferenz übersteht das Neuladen unverändert', async ({ page }) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();

		await page.reload();
		await waitForStableView(page, 'Priority Pilot');

		await expect(switchControl(page, /^KI-Features aktiv$/)).not.toBeChecked();
	});
});
